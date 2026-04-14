import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DashboardStats, Pipe, PressureRecord, Valve } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, AlertTriangle, Droplets, Map, Upload, Download, Power, Zap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useImportGeoJson, getListValvesQueryKey, getListPipesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DashboardSidebarProps {
  stats?: DashboardStats;
  pressureHistory?: PressureRecord[];
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  valves: Valve[];
  pipes: Pipe[];
}

export function DashboardSidebar({
  stats,
  pressureHistory,
  editMode,
  setEditMode,
  searchTerm,
  setSearchTerm,
  valves,
  pipes
}: DashboardSidebarProps) {
  const [minimized, setMinimized] = useState(false);
  const queryClient = useQueryClient();
  const importGeoJson = useImportGeoJson();
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importGeoJson.mutate({ data: json }, {
          onSuccess: (res) => {
            toast.success(`Berhasil impor ${res.valvesImported} valve dan ${res.pipesImported} pipa`);
            queryClient.invalidateQueries({ queryKey: getListValvesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListPipesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          },
          onError: () => {
            toast.error("Gagal mengimpor GeoJSON");
          }
        });
      } catch {
        toast.error("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
  };

  const handleExportGeoJson = () => {
    window.open('/api/export/geojson', '_blank');
  };

  const handleExportCsv = () => {
    window.open('/api/export/csv', '_blank');
  };

  if (minimized) {
    return (
      <aside className="z-20 flex h-full w-16 flex-col items-center border-r border-slate-200 bg-white py-4 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => setMinimized(false)} title="Buka sidebar">
          <PanelLeftOpen className="h-5 w-5 text-slate-700" />
        </Button>
        <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-blue-50">
          <Droplets className="h-5 w-5 text-blue-700" />
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
    <aside className="z-20 flex h-full w-[380px] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-blue-50">
              <Droplets className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Smart Water</h1>
              <p className="text-sm text-slate-500">Sistem Monitoring Distribusi Air</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMinimized(true)} title="Minimalkan sidebar">
            <PanelLeftClose className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-7 p-5">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Cari Data Jaringan
          </h2>
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
                      <div className="font-medium text-slate-900">{valve.valveId} - {valve.name}</div>
                      <div className="text-xs text-slate-500">Valve, tekanan {valve.pressure.toFixed(2)} bar</div>
                    </div>
                  ))}
                  {matchingPipes.map((pipe) => (
                    <div key={`search-pipe-${pipe.id}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{pipe.name}</div>
                      <div className="text-xs text-slate-500">Pipa{pipe.material ? `, material ${pipe.material}` : ""}</div>
                    </div>
                  ))}
                  {matchingValves.length === 0 && matchingPipes.length === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      Data tidak ditemukan
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Masukkan nama, ID valve, material, atau node pipa.</p>
            )}
          </div>
        </section>

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
               <p className="text-4xl font-semibold text-blue-700">{stats?.avgPressure?.toFixed(2) || '0.00'}</p>
               <span className="mb-1 text-slate-500">bar</span>
             </div>
          </div>
        </section>

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
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} width={30} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'white', borderColor: '#cbd5e1', color: '#0f172a' }}
                    itemStyle={{ color: '#1d4ed8' }}
                  />
                  <Line type="monotone" dataKey="pressure" stroke="#1d4ed8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#1d4ed8' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                Data belum tersedia
              </div>
            )}
          </div>
        </section>

        <section className="pb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Power className="h-4 w-4" /> Kontrol Jaringan
          </h2>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-mode" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Map className="h-4 w-4 text-blue-700" /> Mode Edit Peta
              </Label>
              <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} className="data-[state=checked]:bg-blue-700" />
            </div>

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
          </div>
        </section>
      </div>
    </aside>
  );
}
