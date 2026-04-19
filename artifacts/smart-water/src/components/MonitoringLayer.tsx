/**
 * MonitoringLayer.tsx
 * Marker titik monitoring Reservoir + Makrometer di peta.
 * Data disimpan di localStorage sampai backend tersedia.
 */
import React, { useState } from "react";
import { Marker, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { X, Send, Droplets, Gauge, TrendingUp, Plus, Pencil, Trash2, Check } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import {
  useListMonitoringPoints,
  useCreateMonitoringPoint,
  useUpdateMonitoringPoint,
  useDeleteMonitoringPoint,
  getListMonitoringPointsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Tipe Data ──────────────────────────────────────────────────────────────
export interface MonitoringPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SessionData {
  tinggiAir?: number;   // cm
  tekanan?: number;     // bar
}

export interface MonitoringData {
  pagi?: SessionData;
  sore?: SessionData;
}

// ─── Lokasi titik monitoring (sementara) ────────────────────────────────────
export const MONITORING_POINTS: MonitoringPoint[] = [
  { id: "MON-01", name: "Reservoir Induk (IPA)",    lat: -8.6650, lng: 116.3150 },
  { id: "MON-02", name: "BPT Airvale",              lat: -8.6720, lng: 116.3080 },
  { id: "MON-03", name: "Reservoir Airbaku",        lat: -8.6590, lng: 116.3220 },
  { id: "MON-04", name: "BPT Montong Terep",        lat: -8.6680, lng: 116.3000 },
  { id: "MON-05", name: "Reservoir Pagesangan",     lat: -8.6750, lng: 116.3300 },
];

type AnalysisStatus = "empty" | "normal" | "warning" | "critical";

function getAnalysisStatus(data?: MonitoringData): AnalysisStatus {
  if (!data) return "empty";
  
  // Ambil data terbaru (Sore jika ada, kalau tidak ada Pagi)
  const latest = (data.sore?.tinggiAir || data.sore?.tekanan) ? data.sore : data.pagi;
  
  if (!latest) return "empty";
  if (latest.tinggiAir == null && latest.tekanan == null) return "empty";

  let isCritical = false;
  let isWarning = false;

  // Analisa Tekanan (Bar)
  if (latest.tekanan !== undefined && latest.tekanan !== null) {
    if (latest.tekanan < 0.5) isCritical = true;
    else if (latest.tekanan < 1.0) isWarning = true;
  }

  // Analisa Tinggi Air (cm)
  if (latest.tinggiAir !== undefined && latest.tinggiAir !== null) {
    if (latest.tinggiAir < 50) isCritical = true;
    else if (latest.tinggiAir < 100) isWarning = true;
  }

  // Analisa Anomali Tinggi Air (Penurunan Ekstrem)
  if (data.pagi?.tinggiAir != null && data.sore?.tinggiAir != null) {
    const drop = data.pagi.tinggiAir - data.sore.tinggiAir;
    if (drop > 100) isWarning = true; // Drop > 1 meter dalam setengah hari = Indikasi Bocor
  }

  if (isCritical) return "critical";
  if (isWarning) return "warning";
  return "normal";
}

const STATUS_COLORS: Record<string, string> = {
  empty:    "#94a3b8", // Abu-abu salju (Belum Input)
  normal:   "#10b981", // Hijau (Aman)
  warning:  "#f59e0b", // Kuning (Waspada/Tekanan Mulai Turun)
  critical: "#ef4444", // Merah (Bahaya/Bocor Besar/Tekanan Drop)
};

const STATUS_GLOW: Record<string, string> = {
  empty:    "0 4px 6px rgba(148,163,184,0.3), 0 0 0 3px rgba(148,163,184,0.15)",
  normal:   "0 0 12px rgba(16,185,129,0.9), 0 0 0 4px rgba(16,185,129,0.3)",
  warning:  "0 0 12px rgba(245,158,11,0.9), 0 0 0 4px rgba(245,158,11,0.3)",
  critical: "0 0 15px rgba(239,68,68,1), 0 0 0 5px rgba(239,68,68,0.4)",
};

function createMonitoringIcon(status: AnalysisStatus) {
  const color = STATUS_COLORS[status];
  const glow  = STATUS_GLOW[status];
  return L.divIcon({
    className: "bg-transparent",
    html: `
      <div style="
        width: 36px; height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${color};
        border: 2px solid white;
        box-shadow: ${glow};
        display: flex; align-items: center; justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
             viewBox="0 0 24 24" fill="none" stroke="white"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
             style="transform: rotate(45deg)">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `,
    iconSize:   [36, 36],
    iconAnchor: [18, 36],
  });
}

// ─── Modal Input Terpadu ─────────────────────────────────────────────────────
interface ModalProps {
  point: MonitoringPoint;
  initial?: MonitoringData;
  onSave:  (id: string, session: "pagi" | "sore", data: { tinggiAir?: number; tekanan?: number }) => void;
  onClose: () => void;
  macroUrl?: string;
}

function MonitoringModal({ point, initial, onSave, onClose, macroUrl }: ModalProps) {
  const [activeTab, setActiveTab] = useState<"reservoir" | "makrometer" | "tren">("reservoir");
  const [sesi,      setSesi]      = useState<"pagi" | "sore">("pagi");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate 7-day dummy data for the premium trend chart
  const [trendData] = useState(() => {
    const data = [];
    const now = new Date();
    const baseTinggi = Number(initial?.sore?.tinggiAir) || Number(initial?.pagi?.tinggiAir) || 180;
    const baseTekanan = Number(initial?.sore?.tekanan) || Number(initial?.pagi?.tekanan) || 2.1;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = d.toLocaleDateString("id-ID", { weekday: 'short' });
      
      const noise = Math.sin(i) * 1.5; 
      const tnggi = Math.max(0, baseTinggi + (Math.random() * 30 - 15) + noise * 10);
      const tknan = Math.max(0, baseTekanan + (Math.random() * 0.5 - 0.25) + noise * 0.2);
      
      data.push({
        name: dayName,
        "Tinggi Air": Number(tnggi.toFixed(1)),
        "Tekanan": Number(tknan.toFixed(2)),
      });
    }
    return data;
  });

  const getInsightAnalysis = () => {
    if (trendData.length < 2) return "Data tidak cukup untuk analisa historis.";
    const today = trendData[trendData.length - 1];
    const prev = trendData[trendData.length - 2];
    
    // Average pressure past 6 days
    const avgTekanan = trendData.slice(0, 6).reduce((a, b) => a + Number(b.Tekanan), 0) / 6;

    if (Number(today.Tekanan) < 0.5) {
      return "⚠️ KRITIS: Tekanan darurat sangat lemah (< 0.5 Bar). Harap segera cek Valve utama atau kebocoran massif pipa.";
    }
    if (Number(today.Tekanan) < Number(prev.Tekanan) - 0.4 && Number(today.Tekanan) < avgTekanan * 0.7) {
      return "⚠️ WASPADA: Terdeteksi tren penurunan tekanan yang curam kemarin ke hari ini. Cek indikasi hilangnya air (NRW).";
    }
    if (Number(today["Tinggi Air"]) < 80) {
      return "⚠️ WASPADA: Cadangan volume Tinggi Air sangat tipis. Risiko sedot udara / kavitasi pompa bertekanan.";
    }

    return "✓ STABIL: Fluktuasi tekanan dan ketersediaan tinggi fluida air berada dalam batas normal sepanjang minggu.";
  };

  // Form fields — keduanya (reservoir + makrometer) dalam satu sesi
  const [tinggiAir,  setTinggiAir]  = useState<string>(String(initial?.[sesi]?.tinggiAir  ?? ""));
  const [tekanan,    setTekanan]    = useState<string>(String(initial?.[sesi]?.tekanan    ?? ""));

  // Sync fields ketika sesi berubah
  const handleSesiChange = (s: "pagi" | "sore") => {
    setSesi(s);
    setTinggiAir(String(initial?.[s]?.tinggiAir  ?? ""));
    setTekanan(   String(initial?.[s]?.tekanan    ?? ""));
  };

  const handleSubmit = async () => {
    const updated: MonitoringData = {
      ...initial,
      [sesi]: {
        ...(initial?.[sesi] ?? {}),
        tinggiAir:  tinggiAir  !== "" ? Number(tinggiAir)  : undefined,
        tekanan:    tekanan    !== "" ? Number(tekanan)    : undefined,
      },
    };

    if (macroUrl && macroUrl.trim().startsWith("https://script.google.com/")) {
      setIsSubmitting(true);
      try {
        await fetch(macroUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            lokasi: point.name,
            sesi: sesi,
            tinggiAir: updated[sesi]?.tinggiAir ?? "",
            tekanan: updated[sesi]?.tekanan ?? "",
          })
        });
      } catch (err: any) {
        console.error("Error to Google Sheet:", err);
        alert("Gagal mengirim ke Spreadsheet: " + err.message);
      } finally {
        setIsSubmitting(false);
      }
    }

    onSave(point.id, sesi, {
      tinggiAir: tinggiAir !== "" ? Number(tinggiAir) : undefined,
      tekanan:   tekanan   !== "" ? Number(tekanan)   : undefined,
    });
    onClose();
  };

  const inputCls = "w-full h-11 bg-transparent border-b-2 border-slate-200 px-1 text-sm text-slate-800 outline-none focus:border-slate-900 transition-colors placeholder:text-slate-300";
  const labelCls = "block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-[400px] max-w-[95vw] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
              Titik Monitoring
            </p>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{point.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sesi Toggle (Pill style) */}
        <div className="px-6 pb-4">
          <div className="p-1 bg-slate-100 rounded-lg flex">
            {(["pagi", "sore"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleSesiChange(s)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  sesi === s 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s === "pagi" ? "Sesi Pagi" : "Sesi Sore"}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-6 border-b border-slate-100 mt-2">
          {([
            { key: "reservoir",  label: "Reservoir",  Icon: Droplets },
            { key: "makrometer", label: "Makrometer", Icon: Gauge    },
            { key: "tren",       label: "Tren Data",  Icon: TrendingUp },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors relative ${
                activeTab === key ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon size={14} /> {label}
              {activeTab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Form Content / Chart View */}
        <div className="p-6 h-[175px] relative">
          {activeTab === "reservoir" && (
            <div className="absolute inset-0 p-6 space-y-5 animate-in slide-in-from-left-2 duration-300">
              <div>
                <label className={labelCls}>Tinggi Air (cm)</label>
                <input
                  type="number" min="0" max="999" step="0.1"
                  placeholder="0.0"
                  value={tinggiAir}
                  onChange={(e) => setTinggiAir(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
          {activeTab === "makrometer" && (
            <div className="absolute inset-0 p-6 space-y-5 animate-in slide-in-from-right-2 duration-300">
              <div>
                <label className={labelCls}>Tekanan (Bar)</label>
                <input
                  type="number" min="0" max="20" step="0.01"
                  placeholder="0.00"
                  value={tekanan}
                  onChange={(e) => setTekanan(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
          {activeTab === "tren" && (
            <div className="absolute inset-0 p-4 -ml-2 -mt-1 animate-in fade-in zoom-in-95 duration-500 flex flex-col">
              <ResponsiveContainer width="100%" height={105}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTinggi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTekanan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={5} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 600 }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="Tinggi Air" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTinggi)" activeDot={{ r: 4, strokeWidth: 0, fill: '#0ea5e9' }} />
                  <Area yAxisId="right" type="monotone" dataKey="Tekanan" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTekanan)" activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5 mx-2 shadow-sm">
                <p className="text-[10px] font-bold text-slate-800 leading-snug">
                  {getInsightAnalysis()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Ringkasan & Actions */}
        {activeTab !== "tren" ? (
          <>
            <div className="mx-6 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100/50">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">
                Ringkasan Sesi {sesi === "pagi" ? "Pagi" : "Sore"}
              </p>
              <div className="flex items-center justify-between text-xs">
                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-500 font-medium">Tinggi Air</span>
                  <span className="font-semibold text-slate-900">{tinggiAir !== "" ? `${tinggiAir} cm` : "—"}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-500 font-medium">Tekanan</span>
                  <span className="font-semibold text-slate-900">{tekanan !== "" ? `${tekanan} Bar` : "—"}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 mt-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  isSubmitting 
                    ? "bg-slate-100 text-slate-400 cursor-wait" 
                    : "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.98]"
                }`}
              >
                {isSubmitting ? <span>Menyimpan...</span> : <><Send size={15} /> Simpan Data</>}
              </button>
            </div>
          </>
        ) : (
          <div className="px-6 pb-6 pt-2">
             <button
                onClick={() => setActiveTab("reservoir")}
                className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                Kembali ke Input Form
             </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Komponen Utama Layer ────────────────────────────────────────────────────────
interface MonitoringLayerProps {
  data:      Record<string, MonitoringData>;
  onSave:    (id: string, session: "pagi" | "sore", d: { tinggiAir?: number; tekanan?: number }) => void;
  macroUrl?: string;
  editMode?: boolean;
}

// ─── Helper: listen for map clicks when in add mode
function AddClickListener({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export function MonitoringLayer({ data, onSave, macroUrl, editMode = false }: MonitoringLayerProps) {
  const queryClient = useQueryClient();
  const { data: dbPoints } = useListMonitoringPoints();
  const createPoint  = useCreateMonitoringPoint();
  const updatePoint  = useUpdateMonitoringPoint();
  const deletePoint  = useDeleteMonitoringPoint();

  // Gunakan titik dari DB; jika kosong fallback ke MONITORING_POINTS
  const points: MonitoringPoint[] = (dbPoints && dbPoints.length > 0)
    ? dbPoints.map(p => ({ id: p.pointId, name: p.name, lat: p.lat, lng: p.lng, dbId: p.id }))
    : MONITORING_POINTS.map(p => ({ ...p, dbId: undefined }));

  const [openModal,    setOpenModal]    = useState<string | null>(null);
  const [addMode,      setAddMode]      = useState(false);
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [editName,     setEditName]     = useState("");
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [newName,      setNewName]      = useState("");

  const invalidatePoints = () =>
    queryClient.invalidateQueries({ queryKey: getListMonitoringPointsQueryKey() });

  // ─── Tambah titik baru
  const handleMapClick = (lat: number, lng: number) => {
    if (!addMode) return;
    setPendingCoord({ lat, lng });
    setAddMode(false);
  };

  const handleConfirmAdd = () => {
    if (!pendingCoord || !newName.trim()) { toast.error("Nama tidak boleh kosong"); return; }
    const auto = `MON-${String(Date.now()).slice(-4)}`;
    createPoint.mutate(
      { data: { pointId: auto, name: newName.trim(), lat: pendingCoord.lat, lng: pendingCoord.lng } },
      {
        onSuccess: () => { invalidatePoints(); setPendingCoord(null); setNewName(""); toast.success(`Titik "${newName}" berhasil ditambahkan`); },
        onError:   () => toast.error("Gagal menambahkan titik"),
      },
    );
  };

  // ─── Edit nama
  const handleSaveName = (dbId: number) => {
    if (!editName.trim()) { toast.error("Nama tidak boleh kosong"); return; }
    updatePoint.mutate(
      { id: dbId, data: { name: editName.trim() } },
      {
        onSuccess: () => { invalidatePoints(); setEditingId(null); toast.success("Nama titik diperbarui"); },
        onError:   () => toast.error("Gagal mengubah nama"),
      },
    );
  };

  // ─── Update koordinat via drag
  const handleDragEnd = (dbId: number, lat: number, lng: number) => {
    updatePoint.mutate(
      { id: dbId, data: { lat, lng } },
      {
        onSuccess: () => { invalidatePoints(); toast.success("Koordinat diperbarui"); },
        onError:   () => toast.error("Gagal update koordinat"),
      },
    );
  };

  // ─── Hapus titik
  const handleDelete = (dbId: number, name: string) => {
    if (!confirm(`Hapus titik "${name}"? Data monitoring terkait tidak ikut terhapus.`)) return;
    deletePoint.mutate(
      { id: dbId },
      {
        onSuccess: () => { invalidatePoints(); toast.success(`Titik "${name}" dihapus`); },
        onError:   () => toast.error("Gagal menghapus titik"),
      },
    );
  };

  return (
    <>
      {/* Add mode banner + click listener */}
      {editMode && addMode && (
        <>
          <AddClickListener onMapClick={handleMapClick} />
        </>
      )}

      {points.map((pt) => {
        const ptData = data[pt.id];
        const status = getAnalysisStatus(ptData);
        const dbPt   = dbPoints?.find(p => p.pointId === pt.id);

        return (
          <Marker
            key={pt.id}
            position={[pt.lat, pt.lng]}
            icon={createMonitoringIcon(status)}
            draggable={editMode && !!dbPt}
            eventHandlers={{
              click:   () => { if (!editMode) setOpenModal(pt.id); },
              dragend: (e) => {
                if (!dbPt) return;
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                handleDragEnd(dbPt.id, lat, lng);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={1} className="font-sans font-medium text-slate-800 shadow-xl rounded-lg">
              <div className="flex flex-col gap-1 text-center p-1">
                {editMode && dbPt && editingId === dbPt.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="border border-blue-300 rounded px-1 py-0.5 text-xs w-28"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveName(dbPt.id); }}
                    />
                    <button onClick={() => handleSaveName(dbPt.id)} className="text-green-600 hover:text-green-800"><Check className="h-3 w-3" /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <span className="font-bold text-sm tracking-tight">{pt.name}</span>
                )}
                {status === "empty" ? (
                  <span className="text-xs text-slate-400 italic">Belum ada input</span>
                ) : (
                  <span className={`text-xs font-semibold ${
                    status === "normal" ? "text-emerald-600" :
                    status === "warning" ? "text-amber-600" : "text-red-600"
                  }`}>
                    Status: {status.toUpperCase()}
                  </span>
                )}
                {editMode && dbPt ? (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <button
                      onClick={() => { setEditingId(dbPt.id); setEditName(pt.name); }}
                      className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> Edit Nama
                    </button>
                    <button
                      onClick={() => handleDelete(dbPt.id, pt.name)}
                      className="flex items-center gap-0.5 text-[10px] text-red-500 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Hapus
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-1">(Klik untuk input)</span>
                )}
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Pending new point preview */}
      {pendingCoord && (
        <Marker position={[pendingCoord.lat, pendingCoord.lng]} icon={createMonitoringIcon("empty")}>
          <Tooltip permanent direction="top" offset={[0, -20]}>
            <div className="p-1 text-xs">
              <p className="font-semibold text-blue-700 mb-1">📍 Titik Baru</p>
              <input
                autoFocus
                placeholder="Nama titik..."
                className="border border-gray-300 rounded px-2 py-1 text-xs w-36 block mb-1"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleConfirmAdd(); }}
              />
              <div className="flex gap-1">
                <button onClick={handleConfirmAdd} className="flex-1 bg-blue-600 text-white rounded px-2 py-1 text-[10px] font-semibold">Simpan</button>
                <button onClick={() => setPendingCoord(null)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </Tooltip>
        </Marker>
      )}

      {/* Edit mode: Add button floating badge */}
      {editMode && !addMode && !pendingCoord && (
        <Marker
          position={[-8.660, 116.290]}
          icon={L.divIcon({
            className: "bg-transparent",
            html: `<div style="background:#2563eb;color:white;border-radius:9999px;padding:4px 12px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.25);cursor:pointer;">+ Tambah Titik Monitoring</div>`,
            iconAnchor: [0, 0],
          })}
          eventHandlers={{ click: () => { setAddMode(true); toast.info("Klik pada peta untuk meletakkan titik baru"); } }}
        />
      )}

      {/* Add mode banner */}
      {editMode && addMode && (
        <Marker
          position={[-8.660, 116.290]}
          icon={L.divIcon({
            className: "bg-transparent",
            html: `<div style="background:#d97706;color:white;border-radius:9999px;padding:4px 12px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.25);">🎯 Klik pada peta untuk letakkan titik — Klik ini untuk batal</div>`,
            iconAnchor: [0, 0],
          })}
          eventHandlers={{ click: () => setAddMode(false) }}
        />
      )}

      {/* Data input modal */}
      {openModal && (() => {
        const found = points.find(p => p.id === openModal);
        if (!found) return null;
        return (
          <MonitoringModal
            point={found}
            initial={data[openModal]}
            onSave={onSave}
            onClose={() => setOpenModal(null)}
            macroUrl={macroUrl}
          />
        );
      })()}
    </>
  );
}
