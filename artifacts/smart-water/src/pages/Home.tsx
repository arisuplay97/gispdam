import { useState, useEffect } from "react";
import { RadioReceiver, Layers, Activity, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  useListValves,
  useListPipes,
  useListSources,
  useGetDashboardStats,
  useGetPressureHistory,
} from "@workspace/api-client-react";

import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ScadaMap } from "@/components/ScadaMap";
import { TelemetryPanel } from "@/components/TelemetryPanel";

interface SelectedCoords {
  lat: number;
  lng: number;
}

export default function Home() {
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [addValveMode, setAddValveMode] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<SelectedCoords | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [pipelineWeight, setPipelineWeight] = useState(5);
  const [pipelineColor, setPipelineColor] = useState("#38bdf8");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Data queries
  const { data: valves } = useListValves();
  const { data: pipes } = useListPipes();
  const { data: sources } = useListSources();
  const { data: stats } = useGetDashboardStats();
  const { data: pressureHistory } = useGetPressureHistory();

  // Pipeline GeoJSON
  const { data: pipelineGeoJSON } = useQuery({
    queryKey: ["pipelines-geojson"],
    queryFn: async () => {
      const res = await fetch("/api/pipelines/geojson");
      if (!res.ok) throw new Error("Failed to fetch pipeline GeoJSON");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
  };

  const query = searchTerm.trim().toLowerCase();
  const safeValves = Array.isArray(valves) ? valves : [];
  const filteredValves = safeValves.filter((valve) => {
    if (!query) return true;
    return (
      valve.valveId.toLowerCase().includes(query) ||
      valve.name.toLowerCase().includes(query) ||
      valve.status.toLowerCase().includes(query)
    );
  });
  const safePipes = Array.isArray(pipes) ? pipes : [];
  const filteredPipes = safePipes.filter((pipe) => {
    if (!query) return true;
    return (
      pipe.name.toLowerCase().includes(query) ||
      (pipe.fromNode || "").toLowerCase().includes(query) ||
      (pipe.toNode || "").toLowerCase().includes(query) ||
      (pipe.material || "").toLowerCase().includes(query)
    );
  });

  const statusCounts = {
    normal: safeValves.filter((v) => v.status === "normal").length,
    warning: safeValves.filter((v) => v.status === "warning").length,
    critical: safeValves.filter((v) => v.status === "critical").length,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900">
      <DashboardSidebar
        stats={stats}
        pressureHistory={Array.isArray(pressureHistory) ? pressureHistory : []}
        editMode={editMode}
        setEditMode={setEditMode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        valves={safeValves}
        pipes={safePipes}
        addValveMode={addValveMode}
        setAddValveMode={setAddValveMode}
        selectedCoords={selectedCoords}
        setSelectedCoords={setSelectedCoords}
        showHeatmap={showHeatmap}
        setShowHeatmap={setShowHeatmap}
      />

      <main className="relative flex-1">
        <div className="absolute inset-0 z-0">
          <ScadaMap
            valves={filteredValves}
            pipes={filteredPipes}
            sources={Array.isArray(sources) ? sources : []}
            editMode={editMode}
            addValveMode={addValveMode}
            onMapClick={handleMapClick}
            pipelineGeoJSON={pipelineGeoJSON}
            pressureHistory={Array.isArray(pressureHistory) ? pressureHistory : []}
            showHeatmap={showHeatmap}
            pipelineWeight={pipelineWeight}
            pipelineColor={pipelineColor}
          />
        </div>

        {/* ── Top Left (beside sidebar): Telemetry button (repositioned, no overlap) ── */}
        <div className="absolute left-[340px] top-4 z-[1000] flex flex-col items-start gap-2">
          {telemetryOpen ? (
            <div className="w-80 space-y-4">
              <TelemetryPanel valves={safeValves} onClose={() => setTelemetryOpen(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTelemetryOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-md hover:bg-slate-50 transition-colors"
            >
              <RadioReceiver className="h-4 w-4 text-blue-700" />
              Telemetri
            </button>
          )}
        </div>

        {/* ── Status bar top center ── */}
        <div className="absolute top-3 left-1/2 z-[999] -translate-x-1/2 flex items-center gap-3 rounded-full border border-white/30 bg-slate-900/80 px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
          <Clock className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-slate-300">
            {currentTime.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span className="text-white font-mono">
            {currentTime.toLocaleTimeString("id-ID")}
          </span>
          <span className="mx-1 h-3 w-px bg-white/20" />
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            <span>{statusCounts.normal} Normal</span>
          </span>
          {statusCounts.warning > 0 && (
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {statusCounts.warning} Peringatan
            </span>
          )}
          {statusCounts.critical > 0 && (
            <span className="flex items-center gap-1.5 text-red-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {statusCounts.critical} Kritis!
            </span>
          )}
        </div>

        {/* ── Pipeline Control (bottom right, above zoom) ── */}
        <div className="absolute bottom-20 right-3 z-[1000] rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm w-48">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-slate-600">Garis Distribusi</span>
            </div>
            {/* Color Picker */}
            <input
              type="color"
              value={pipelineColor}
              onChange={(e) => setPipelineColor(e.target.value)}
              className="h-6 w-6 cursor-pointer border-0 p-0 bg-transparent rounded-sm overflow-hidden"
              title="Warna Utama"
            />
          </div>
          
          <div>
            <span className="text-[10px] font-medium text-slate-500 mb-1 block">Ketebalan: {pipelineWeight}px</span>
            <input
              type="range"
              min={2}
              max={15}
              step={1}
              value={pipelineWeight}
              onChange={(e) => setPipelineWeight(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-blue-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>Tipis</span>
              <span>Tebal</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
