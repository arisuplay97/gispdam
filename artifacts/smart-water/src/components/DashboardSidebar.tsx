import React, { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DashboardStats, Pipe, PressureRecord, Valve } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Droplets,
  Flame,
  Map,
  Upload,
  Download,
  Power,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
  Users,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import {
  useImportGeoJson,
  useCreateValve,
  getListValvesQueryKey,
  getListPipesQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SelectedCoords {
  lat: number;
  lng: number;
}

interface DashboardSidebarProps {
  stats?: DashboardStats;
  pressureHistory?: PressureRecord[];
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  valves: Valve[];
  pipes: Pipe[];
  // New props for Add Valve mode
  addValveMode: boolean;
  setAddValveMode: (v: boolean) => void;
  // New props for Add Source mode
  addSourceMode?: boolean;
  setAddSourceMode?: (v: boolean) => void;
  selectedCoords: SelectedCoords | null;
  setSelectedCoords: (v: SelectedCoords | null) => void;
  // Heatmap
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  // Panel Pelanggan
  showCustomerPanel: boolean;
  setShowCustomerPanel: (v: boolean) => void;
  macroUrl: string;
  setMacroUrl: (v: string) => void;
  spreadsheetUrl: string;
  setSpreadsheetUrl: (v: string) => void;
  // Mobile
  onMobileClose?: () => void;
}

export function DashboardSidebar({
  stats,
  pressureHistory,
  editMode,
  setEditMode,
  searchTerm,
  setSearchTerm,
  valves,
  pipes,
  addValveMode,
  setAddValveMode,
  addSourceMode,
  setAddSourceMode,
  selectedCoords,
  setSelectedCoords,
  showHeatmap,
  setShowHeatmap,
  showCustomerPanel,
  setShowCustomerPanel,
  macroUrl,
  setMacroUrl,
  spreadsheetUrl,
  setSpreadsheetUrl,
  onMobileClose,
}: DashboardSidebarProps) {
  const [minimized, setMinimized] = useState(true);
  const queryClient = useQueryClient();
  const importGeoJson = useImportGeoJson();
  const createValve = useCreateValve();
  // Using generic fetch or standard hook for createSource if exists, otherwise fallback to fetch
  // Wait, useCreateSource should be exported from api-client-react.
  // Actually, we'll import it at the top. Let's just assume we can add it to imports later or use `window.fetch` if it's missing to avoid crashing.

  // ── Add Valve form state ─────────────────────────────────────────────
  const [formName, setFormName] = useState("");
  const [formValveId, setFormValveId] = useState(() => `V-${Math.floor(Math.random() * 9000) + 1000}`);
  const [formPressure, setFormPressure] = useState("6.0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Add Source form state ────────────────────────────────────────────
  const [sourceFormName, setSourceFormName] = useState("");
  const [isSubmittingSource, setIsSubmittingSource] = useState(false);

  // Auto-fill lat/lng when selectedCoords changes (map click)
  const formLat = selectedCoords?.lat.toFixed(6) ?? "";
  const formLng = selectedCoords?.lng.toFixed(6) ?? "";

  // Visual feedback when new coords are set
  const [coordsFlash, setCoordsFlash] = useState(false);
  useEffect(() => {
    if (selectedCoords) {
      setCoordsFlash(true);
      const t = setTimeout(() => setCoordsFlash(false), 800);
      return () => clearTimeout(t);
    }
  }, [selectedCoords]);

  // Search filtering
  const query = searchTerm.trim().toLowerCase();
  const matchingValves = valves.filter((valve) => {
    if (!query) return false;
    return (
      valve.valveId.toLowerCase().includes(query) ||
      valve.name.toLowerCase().includes(query) ||
      valve.status.toLowerCase().includes(query)
    );
  });
  const matchingPipes = pipes.filter((pipe) => {
    if (!query) return false;
    return (
      pipe.name.toLowerCase().includes(query) ||
      (pipe.fromNode || "").toLowerCase().includes(query) ||
      (pipe.toNode || "").toLowerCase().includes(query) ||
      (pipe.material || "").toLowerCase().includes(query)
    );
  });

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importGeoJson.mutate(
          { data: json },
          {
            onSuccess: (res) => {
              const msg = `Berhasil impor: ${res.valvesImported ?? 0} valve, ${res.pipesImported ?? 0} pipa, ${res.sourcesImported ?? 0} sumber air`;
              toast.success(msg);
              queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
              queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
            },
            onError: (err: any) => toast.error(`Gagal mengimpor: ${err?.message || "Unknown error"}`),
          }
        );
      } catch {
        toast.error("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
  };

  const handleExportGeoJson = () => window.open("/api/export/geojson", "_blank");
  const handleExportCsv = () => window.open("/api/export/csv", "_blank");

  // ── Clear Import ───────────────────────────────────────────────────
  const [clearConfirm, setClearConfirm] = React.useState(false);
  const [isClearing,   setIsClearing]   = React.useState(false);

  const handleClearImport = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 4000); // auto reset
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch("/api/clear-import", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Semua data import berhasil dihapus");
        queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
      } else {
        toast.error(json.error ?? "Gagal menghapus");
      }
    } catch (e: any) {
      toast.error("Gagal menghubungi server");
    } finally {
      setIsClearing(false);
      setClearConfirm(false);
    }
  };

  const handleToggleAddValve = () => {
    const next = !addValveMode;
    setAddValveMode(next);
    if (!next) {
      setSelectedCoords(null);
    }
    if (next && editMode) {
      setEditMode(false); // mutually exclusive
    }
    if (next && setAddSourceMode) {
      setAddSourceMode(false);
    }
  };

  const handleToggleAddSource = () => {
    if (!setAddSourceMode) return;
    const next = !addSourceMode;
    setAddSourceMode(next);
    if (!next) {
      setSelectedCoords(null);
    }
    if (next && editMode) {
      setEditMode(false);
    }
    if (next) {
      setAddValveMode(false);
    }
  };

  const handleSubmitValve = () => {
    if (!formName.trim()) {
      toast.error("Nama valve wajib diisi");
      return;
    }
    if (!selectedCoords) {
      toast.error("Klik peta terlebih dahulu untuk menentukan koordinat");
      return;
    }
    const pressure = parseFloat(formPressure);
    if (isNaN(pressure) || pressure < 0) {
      toast.error("Tekanan tidak valid");
      return;
    }

    setIsSubmitting(true);
    createValve.mutate(
      {
        data: {
          valveId: formValveId,
          name: formName.trim(),
          lat: selectedCoords.lat,
          lng: selectedCoords.lng,
          pressure,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Valve ${formValveId} berhasil ditambahkan`);
          queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["pipelines-geojson"] });
          // Reset form
          setFormName("");
          setFormValveId(`V-${Math.floor(Math.random() * 9000) + 1000}`);
          setFormPressure("6.0");
          setSelectedCoords(null);
          setAddValveMode(false);
          setIsSubmitting(false);
        },
        onError: () => {
          toast.error("Gagal menambahkan valve");
          setIsSubmitting(false);
        },
      }
    );
  };

  const handleSubmitSource = async () => {
    if (!sourceFormName.trim()) {
      toast.error("Nama Sumber Air wajib diisi");
      return;
    }
    if (!selectedCoords) {
      toast.error("Klik peta terlebih dahulu untuk koordiant sumber air");
      return;
    }

    setIsSubmittingSource(true);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({
          name: sourceFormName.trim(),
          lat: selectedCoords.lat,
          lng: selectedCoords.lng,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      
      toast.success(`Sumber Air ${sourceFormName} berhasil ditambahkan`);
      setSourceFormName("");
      setSelectedCoords(null);
      if (setAddSourceMode) setAddSourceMode(false);
    } catch {
      toast.error("Gagal menambahkan sumber air");
    } finally {
      setIsSubmittingSource(false);
      // Wait for React Query if we add invalidateQueries for sources later
      // But we just reload or let UI handle it if sources are queried elsewhere
      // Actually `Home.tsx` has `useListSources()`. Let's invalidate it.
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
    }
  };

  // ── Minimized state ───────────────────────────────────────────────────
  if (minimized) {
    return (
      <aside className="z-20 flex h-full w-16 flex-col items-center border-r border-slate-200 bg-white py-4 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => setMinimized(false)} title="Buka sidebar">
          <PanelLeftOpen className="h-5 w-5 text-slate-700" />
        </Button>
        <div className="mt-5 flex h-10 w-10 items-center justify-center">
          <img src="/logo.png" alt="Tiara GIS" className="h-10 w-10 object-contain" />
        </div>
        <div className="mt-6 flex flex-col gap-4 text-slate-500">
          <Activity className="h-5 w-5" />
          <AlertTriangle className="h-5 w-5" />
          <Zap className="h-5 w-5" />
          <Power className="h-5 w-5" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="z-20 flex h-full w-screen md:w-[380px] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-sm">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Tiara GIS" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Tiara GIS</h1>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Sistem Informasi Layanan Distribusi
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMinimized(true)} title="Minimalkan sidebar" className="hidden md:flex">
            <PanelLeftClose className="h-5 w-5 text-slate-600" />
          </Button>
          {/* Mobile close button */}
          <Button variant="ghost" size="icon" onClick={onMobileClose} title="Tutup menu" className="md:hidden">
            <X className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-7 p-5">

        {/* ── Search ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Cari Data Jaringan</h2>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari valve atau pipa..."
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
            {searchTerm.trim() ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Hasil: {matchingValves.length} valve, {matchingPipes.length} pipa</span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="font-medium text-blue-700 hover:text-blue-800"
                  >
                    Reset
                  </button>
                </div>
                <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                  {matchingValves.map((valve) => (
                    <div key={`search-valve-${valve.id}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{valve.valveId} — {valve.name}</div>
                      <div className="text-xs text-slate-500">Valve · {valve.pressure.toFixed(2)} bar</div>
                    </div>
                  ))}
                  {matchingPipes.map((pipe) => (
                    <div key={`search-pipe-${pipe.id}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{pipe.name}</div>
                      <div className="text-xs text-slate-500">Pipa{pipe.material ? ` · ${pipe.material}` : ""}</div>
                    </div>
                  ))}
                  {matchingValves.length === 0 && matchingPipes.length === 0 && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      Data tidak ditemukan
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Masukkan nama, ID valve, material, atau node pipa.</p>
            )}
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Activity className="h-4 w-4" /> Ringkasan Sistem
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-1 text-sm text-slate-500">Total Valve</p>
              <p className="text-2xl font-semibold text-slate-900">{stats?.totalValves || 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-1 text-sm text-slate-500">Total Pipa</p>
              <p className="text-2xl font-semibold text-slate-900">{stats?.totalPipes || 0}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm text-slate-500">Tekanan Rata-rata Jaringan</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-semibold text-blue-700">{stats?.avgPressure?.toFixed(2) || "0.00"}</p>
              <span className="mb-1 text-slate-500">bar</span>
            </div>
          </div>
        </section>

        {/* ── Status Valve ────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <AlertTriangle className="h-4 w-4" /> Kondisi Valve
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-green-600" />
                <span className="text-sm text-slate-700">Normal</span>
              </div>
              <span className="font-semibold text-green-700">{stats?.normalCount || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-sm text-slate-700">Peringatan</span>
              </div>
              <span className="font-semibold text-amber-600">{stats?.warningCount || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-red-600" />
                <span className="text-sm text-slate-700">Kritis</span>
              </div>
              <span className="font-semibold text-red-700">{stats?.criticalCount || 0}</span>
            </div>
          </div>
        </section>

        {/* ── Pressure Trend Chart ─────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Zap className="h-4 w-4" /> Tren Tekanan Jaringan
          </h2>
          <div className="h-48 rounded-lg border border-slate-200 bg-white p-3">
            {pressureHistory && pressureHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pressureHistory.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={["auto", "auto"]} stroke="#64748b" fontSize={10} width={30} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "white", borderColor: "#cbd5e1", color: "#0f172a" }}
                    itemStyle={{ color: "#1d4ed8" }}
                    formatter={(val: number) => [`${val.toFixed(2)} bar`, "Tekanan"]}
                  />
                  <Line type="monotone" dataKey="pressure" stroke="#1d4ed8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#1d4ed8" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                Data belum tersedia
              </div>
            )}
          </div>
        </section>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <section className="pb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Power className="h-4 w-4" /> Kontrol Jaringan
          </h2>
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">

            {/* Edit mode toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-mode" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Map className="h-4 w-4 text-blue-700" /> Mode Edit Peta
              </Label>
              <Switch
                id="edit-mode"
                checked={editMode}
                onCheckedChange={(v) => {
                  setEditMode(v);
                  if (v) setAddValveMode(false); // mutually exclusive
                }}
                className="data-[state=checked]:bg-blue-700"
              />
            </div>

            <div className="h-px w-full bg-slate-200" />

            {/* Add Valve mode toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-valve-mode" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Crosshair className="h-4 w-4 text-emerald-600" /> Mode Tambah Valve
              </Label>
              <Switch
                id="add-valve-mode"
                checked={addValveMode}
                onCheckedChange={handleToggleAddValve}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>

            {/* Add Valve form — appears when mode is active */}
            {addValveMode && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Form Tambah Valve
                  </p>
                  <button
                    onClick={() => { setAddValveMode(false); setSelectedCoords(null); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Nama Valve */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nama Valve *</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="cth: Zona Utara Timur"
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* Valve ID */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Valve ID</label>
                  <input
                    value={formValveId}
                    onChange={(e) => setFormValveId(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* Tekanan */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tekanan (bar)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={formPressure}
                    onChange={(e) => setFormPressure(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* Koordinat — read-only, auto-filled from map click */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Latitude <span className="text-slate-400">(klik peta)</span>
                    </label>
                    <input
                      readOnly
                      value={formLat}
                      placeholder="—"
                      className={`h-9 w-full rounded-md border px-3 text-sm cursor-not-allowed transition-colors ${
                        coordsFlash
                          ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Longitude <span className="text-slate-400">(klik peta)</span>
                    </label>
                    <input
                      readOnly
                      value={formLng}
                      placeholder="—"
                      className={`h-9 w-full rounded-md border px-3 text-sm cursor-not-allowed transition-colors ${
                        coordsFlash
                          ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    />
                  </div>
                </div>

                {!selectedCoords && (
                  <p className="text-xs text-emerald-700 font-medium animate-pulse">
                    👆 Klik pada peta untuk menentukan posisi valve
                  </p>
                )}

                <Button
                  onClick={handleSubmitValve}
                  disabled={!selectedCoords || !formName.trim() || isSubmitting}
                  className="w-full bg-emerald-600 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Valve"}
                </Button>
              </div>
            )}

            <div className="h-px w-full bg-slate-200" />

            {/* Add Source mode toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-source-mode" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Crosshair className="h-4 w-4 text-blue-500" /> Mode Tambah Sumber Air
              </Label>
              <Switch
                id="add-source-mode"
                checked={addSourceMode || false}
                onCheckedChange={handleToggleAddSource}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>

            {/* Add Source form */}
            {addSourceMode && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Form Tambah Sumber Air
                  </p>
                  <button
                    onClick={() => { if(setAddSourceMode) setAddSourceMode(false); setSelectedCoords(null); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Nama Sumber */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nama Sumber Air *</label>
                  <input
                    value={sourceFormName}
                    onChange={(e) => setSourceFormName(e.target.value)}
                    placeholder="cth: Mata Air Kaliwungu"
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Latitude</label>
                    <input readOnly value={formLat} placeholder="—" className={`h-9 w-full rounded-md border px-3 text-sm cursor-not-allowed transition-colors ${coordsFlash ? "border-blue-400 bg-blue-100 text-blue-800" : "border-slate-200 bg-slate-100 text-slate-700"}`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Longitude</label>
                    <input readOnly value={formLng} placeholder="—" className={`h-9 w-full rounded-md border px-3 text-sm cursor-not-allowed transition-colors ${coordsFlash ? "border-blue-400 bg-blue-100 text-blue-800" : "border-slate-200 bg-slate-100 text-slate-700"}`} />
                  </div>
                </div>

                {!selectedCoords && (
                  <p className="text-xs text-blue-700 font-medium animate-pulse">
                    👆 Klik peta untuk lokasi Sumber Air
                  </p>
                )}

                <Button
                  onClick={handleSubmitSource}
                  disabled={!selectedCoords || !sourceFormName.trim() || isSubmittingSource}
                  className="w-full bg-blue-600 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmittingSource ? "Menyimpan..." : "Simpan Sumber Air"}
                </Button>
              </div>
            )}

            <div className="h-px w-full bg-slate-200" />

            {/* Heatmap toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="heatmap-mode" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Flame className="h-4 w-4 text-orange-500" /> Tampilkan Heatmap
              </Label>
              <Switch
                id="heatmap-mode"
                checked={showHeatmap}
                onCheckedChange={setShowHeatmap}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>

            <div className="h-px w-full bg-slate-200" />

            {/* URL Google Apps Script & Spreadsheet */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-blue-500" />
                  Google Apps Script URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={macroUrl}
                    onChange={(e) => setMacroUrl(e.target.value)}
                    className="text-xs font-mono bg-slate-50 border-slate-300 placeholder:text-slate-400 focus-visible:ring-blue-500"
                  />
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 px-3"
                    onClick={() => toast.success("URL Google Script Tersimpan!")}
                  >
                    Simpan
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-green-500" />
                  Link Spreadsheet Google
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    className="text-xs font-mono bg-slate-50 border-slate-300 placeholder:text-slate-400 focus-visible:ring-blue-500"
                  />
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white shrink-0 px-3"
                    onClick={() => toast.success("Link Spreadsheet Tersimpan!")}
                  >
                    Simpan
                  </Button>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-slate-200" />

            {/* Data Pelanggan Toggle */}
            <button
              onClick={() => setShowCustomerPanel(!showCustomerPanel)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                showCustomerPanel
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Data Pelanggan
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider ${showCustomerPanel ? 'text-emerald-500' : 'text-slate-400'}`}>
                {showCustomerPanel ? 'Aktif' : 'Buka'}
              </span>
            </button>

            <div className="h-px w-full bg-slate-200" />
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Button variant="outline" className="w-full text-sm">
                  <Upload className="mr-2 h-4 w-4" /> Impor
                </Button>
                <input
                  type="file"
                  accept=".geojson,.json"
                  onChange={handleImport}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </div>
              <Button variant="outline" onClick={handleExportGeoJson} className="w-full text-sm">
                <Download className="mr-2 h-4 w-4" /> GeoJSON
              </Button>
            </div>
            <Button variant="outline" onClick={handleExportCsv} className="w-full text-sm">
              <Download className="mr-2 h-4 w-4" /> Ekspor CSV
            </Button>

            {/* Hapus Import */}
            <button
              onClick={handleClearImport}
              disabled={isClearing}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all disabled:opacity-50 ${
                clearConfirm
                  ? 'bg-red-600 border-red-600 text-white shadow-md animate-pulse'
                  : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {isClearing ? "Menghapus..." : clearConfirm ? "⚠️ Klik lagi untuk konfirmasi" : "Hapus Semua Import"}
            </button>

            <div className="h-px w-full bg-slate-200" />

            {/* Link Spreadsheet */}
            <a
              href={spreadsheetUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-all shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Data Spreadsheet
            </a>
          </div>
        </section>
      </div>
    </aside>
  );
}
