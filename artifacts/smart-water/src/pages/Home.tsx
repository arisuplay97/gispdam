import { useState, useEffect } from "react";
import { RadioReceiver, Layers, Activity, Clock, ChevronDown, ChevronUp, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  useListValves,
  useListPipes,
  useListSources,
  useGetDashboardStats,
  useGetPressureHistory,
  useGetMonitoringData,
  useAddMonitoringData,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ScadaMap } from "@/components/ScadaMap";
import { TelemetryPanel } from "@/components/TelemetryPanel";
import { CustomerPanel } from "@/components/CustomerPanel";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { MonitoringData } from "@/components/MonitoringLayer";

interface SelectedCoords {
  lat: number;
  lng: number;
}

export default function Home() {
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [addValveMode, setAddValveMode] = useState(false);
  const [addSourceMode, setAddSourceMode] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<SelectedCoords | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [mapSelectCustomerCallback, setMapSelectCustomerCallback] = useState<((lat: number, lng: number) => void) | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPipeControl, setShowPipeControl] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Persistent settings (localStorage) ─────────────────────────────────
  const [pipelineWeight, setPipelineWeight] = useLocalStorage<number>("gis-pipeline-weight", 5);
  const [pipelineColor,  setPipelineColor]  = useLocalStorage<string>("gis-pipeline-color",  "#38bdf8");
  const [pipeWeight, setPipeWeight] = useLocalStorage<number>("gis-db-pipe-weight", 3);
  const [pipeColor, setPipeColor] = useLocalStorage<string>("gis-db-pipe-color", "#a855f7");

  const queryClient = useQueryClient();
  const { data: rawMonitoringData } = useGetMonitoringData();
  const { mutateAsync: addMonitoringData } = useAddMonitoringData();

  const [monitoringDate, setMonitoringDate] = useLocalStorage<string>("gis-monitoring-date", "");
  const [macroUrl, setMacroUrl] = useLocalStorage<string>("gis-macro-url", "");
  const [spreadsheetUrl, setSpreadsheetUrl] = useLocalStorage<string>("gis-spreadsheet-url", "https://docs.google.com/spreadsheets/d/1BKrBd0DaX5pohahUeUxsiTptFyYA9XXaKFqWLX2FKHE/");

  const todayDateStr = new Date().toISOString().split("T")[0];
  const monitoringData: Record<string, MonitoringData> = {};
  
  if (rawMonitoringData) {
    rawMonitoringData.forEach((row) => {
      const rowDateStr = new Date(row.date).toISOString().split("T")[0];
      if (rowDateStr === todayDateStr) {
        if (!monitoringData[row.pointId]) {
          monitoringData[row.pointId] = {};
        }
        monitoringData[row.pointId][row.session] = {
          tinggiAir: row.tinggiAir ?? undefined,
          tekanan: row.tekanan ?? undefined,
        };
      }
    });
  }

  const handleMonitoringSave = async (
    id: string,
    session: "pagi" | "sore",
    sessionData: { tinggiAir?: number; tekanan?: number }
  ) => {
    try {
      await addMonitoringData({
        data: {
          pointId: id,
          session,
          date: todayDateStr,
          tinggiAir: sessionData.tinggiAir,
          tekanan: sessionData.tekanan,
        }
      });
      // Use the exact query key Orval generates
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring'] });
    } catch (e) {
      console.error("Failed to save monitoring data", e);
    }
  };

  const [visibleLayers, setVisibleLayers] = useState({
    valves: true,
    pipelines: true,
    customers: true,
    serviceLines: true,
    sources: true,
    pipes: true,
    monitoring: true,
  });
  const toggleLayer = (key: keyof typeof visibleLayers) =>
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-update date for monitoring (used as reference for manual date display)
  useEffect(() => {
    const d = new Date(currentTime);
    const offset = d.getTimezoneOffset() * 60000;
    const currentMonitoringDay = new Date(d.getTime() - offset).toISOString().split("T")[0];
    if (monitoringDate !== currentMonitoringDay) {
      setMonitoringDate(currentMonitoringDay);
    }
  }, [currentTime, monitoringDate, setMonitoringDate]);

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
    if (mapSelectCustomerCallback) {
      mapSelectCustomerCallback(lat, lng);
    } else {
      setSelectedCoords({ lat, lng });
    }
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
    normal:   safeValves.filter((v) => v.status === "normal").length,
    warning:  safeValves.filter((v) => v.status === "warning").length,
    critical: safeValves.filter((v) => v.status === "critical").length,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900">

      {/* ── Mobile Sidebar Backdrop ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar: desktop = inline, mobile = slide-in drawer ── */}
      <div className={`
        fixed inset-y-0 left-0 z-[100] h-full
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-20
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
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
          addSourceMode={addSourceMode}
          setAddSourceMode={setAddSourceMode}
          selectedCoords={selectedCoords}
          setSelectedCoords={setSelectedCoords}
          showHeatmap={showHeatmap}
          setShowHeatmap={setShowHeatmap}
          showCustomerPanel={showCustomerPanel}
          setShowCustomerPanel={setShowCustomerPanel}
          macroUrl={macroUrl}
          setMacroUrl={setMacroUrl}
          spreadsheetUrl={spreadsheetUrl}
          setSpreadsheetUrl={setSpreadsheetUrl}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      <main className="relative flex-1">
        <div className="absolute inset-0 z-0">
          <ScadaMap
            valves={filteredValves}
            pipes={filteredPipes}
            sources={Array.isArray(sources) ? sources : []}
            editMode={editMode}
            addValveMode={addValveMode}
            addSourceMode={addSourceMode}
            onMapClick={handleMapClick}
            pipelineGeoJSON={pipelineGeoJSON}
            pressureHistory={Array.isArray(pressureHistory) ? pressureHistory : []}
            showHeatmap={showHeatmap}
            pipelineWeight={pipelineWeight}
            pipelineColor={pipelineColor}
            pipeWeight={pipeWeight}
            pipeColor={pipeColor}
            visibleLayers={visibleLayers}
            onToggleLayer={(key) => toggleLayer(key as keyof typeof visibleLayers)}
            monitoringData={monitoringData}
            onMonitoringSave={handleMonitoringSave}
            macroUrl={macroUrl}
          />
        </div>

        {/* ── Customer Panel Floating Overlay ── */}
        {showCustomerPanel && (
          <CustomerPanel
            onClose={() => setShowCustomerPanel(false)}
            onActivateMapSelect={(cb) => setMapSelectCustomerCallback(() => cb)}
            onDeactivateMapSelect={() => setMapSelectCustomerCallback(null)}
          />
        )}

        {/* ── Mobile: Hamburger button (top-left on mobile, hidden on desktop) ── */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="absolute left-2 top-2 z-[1001] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 shadow-md backdrop-blur-sm md:hidden"
          aria-label="Buka Menu"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>

        {/* ── Top Left (beside sidebar): Telemetry button — hidden on mobile ── */}
        <div className="absolute left-4 top-4 z-[1000] hidden md:flex flex-col items-start gap-2">
          {telemetryOpen ? (
            <div className="w-72 space-y-4">
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
        <div className="absolute top-3 left-1/2 z-[999] -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/30 bg-slate-900/80 px-3 py-1.5 text-[10px] md:text-xs font-medium text-white shadow-lg backdrop-blur-sm max-w-[90vw] overflow-hidden">
          <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 text-blue-400 shrink-0" />
          <span className="text-slate-300 hidden sm:inline">
            {currentTime.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span className="text-white font-mono">
            {currentTime.toLocaleTimeString("id-ID")}
          </span>
          <span className="mx-0.5 h-3 w-px bg-white/20" />
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            <span>{statusCounts.normal} Normal</span>
          </span>
          {statusCounts.warning > 0 && (
            <span className="flex items-center gap-1 text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {statusCounts.warning} Waspada
            </span>
          )}
          {statusCounts.critical > 0 && (
            <span className="flex items-center gap-1 text-red-300 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {statusCounts.critical} Kritis!
            </span>
          )}
        </div>

        {/* ── Pipeline Control (bottom right, above zoom) — hidden on mobile ── */}
        <div className="absolute bottom-20 right-3 z-[1000] rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm w-52 hidden sm:block">

          {/* Header (always visible) */}
          <button
            onClick={() => setShowPipeControl(!showPipeControl)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              Gaya Pipa
            </div>
            {showPipeControl
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            }
          </button>

          {/* Collapsible body */}
          {showPipeControl && (
            <div className="px-4 pb-3 flex flex-col gap-4 border-t border-slate-100">

              {/* Pipa Utama */}
              <div className="pt-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3 text-blue-500" />
                    <span className="text-[11px] font-semibold text-slate-600">Pipa Utama</span>
                  </div>
                  <input
                    type="color"
                    value={pipelineColor}
                    onChange={(e) => setPipelineColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer border-0 p-0 bg-transparent rounded-sm overflow-hidden"
                    title="Warna Pipa Utama"
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-400 mb-1 block">Ketebalan: {pipelineWeight}px</span>
                <input
                  type="range" min={2} max={15} step={1}
                  value={pipelineWeight}
                  onChange={(e) => setPipelineWeight(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer accent-blue-600"
                />
              </div>

              {/* Pipa Tambahan */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3 text-purple-500" />
                    <span className="text-[11px] font-semibold text-slate-600">Pipa Tambahan</span>
                  </div>
                  <input
                    type="color"
                    value={pipeColor}
                    onChange={(e) => setPipeColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer border-0 p-0 bg-transparent rounded-sm overflow-hidden"
                    title="Warna Pipa Tambahan"
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-400 mb-1 block">Ketebalan: {pipeWeight}px</span>
                <input
                  type="range" min={2} max={15} step={1}
                  value={pipeWeight}
                  onChange={(e) => setPipeWeight(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer accent-purple-600"
                />
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
