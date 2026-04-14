import { useState } from "react";
import { RadioReceiver } from "lucide-react";
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

  // New states for Tambah Valve mode
  const [addValveMode, setAddValveMode] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<SelectedCoords | null>(null);

  // Heatmap toggle
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Data queries
  const { data: valves } = useListValves();
  const { data: pipes } = useListPipes();
  const { data: sources } = useListSources();
  const { data: stats } = useGetDashboardStats();
  const { data: pressureHistory } = useGetPressureHistory();

  // Pipeline GeoJSON — live topological network from /api/pipelines/geojson
  const { data: pipelineGeoJSON } = useQuery({
    queryKey: ["pipelines-geojson"],
    queryFn: async () => {
      const res = await fetch("/api/pipelines/geojson");
      if (!res.ok) throw new Error("Failed to fetch pipeline GeoJSON");
      return res.json();
    },
    // Refetch whenever valves are updated (after add/delete)
    refetchInterval: 30_000,
  });

  // Map click handler — fills selectedCoords for the Add Valve form
  const handleMapClick = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
  };

  // Filter valves & pipes by search term
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
          />
        </div>

        {/* Telemetry panel */}
        {telemetryOpen ? (
          <div className="absolute right-4 top-4 z-10 w-80 space-y-4">
            <TelemetryPanel valves={safeValves} onClose={() => setTelemetryOpen(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTelemetryOpen(true)}
            className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-md hover:bg-slate-50 transition-colors"
          >
            <RadioReceiver className="h-4 w-4 text-blue-700" />
            Buka Telemetri
          </button>
        )}
      </main>
    </div>
  );
}
