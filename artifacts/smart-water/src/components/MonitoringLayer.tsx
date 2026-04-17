/**
 * MonitoringLayer.tsx
 * Marker titik monitoring Reservoir + Makrometer di peta.
 * Data disimpan di localStorage sampai backend tersedia.
 */
import React, { useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { X, Send, Droplets, Gauge } from "lucide-react";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCompletionStatus(data?: MonitoringData): "empty" | "partial" | "complete" {
  if (!data) return "empty";
  const pagiOk = !!(data.pagi?.tinggiAir != null && data.pagi?.tekanan != null);
  const soreOk  = !!(data.sore?.tinggiAir != null && data.sore?.tekanan  != null);
  if (pagiOk && soreOk) return "complete";
  if (pagiOk || soreOk) return "partial";
  return "empty";
}

const STATUS_COLORS: Record<string, string> = {
  empty:    "#ef4444", // merah
  partial:  "#f59e0b", // kuning
  complete: "#16a34a", // hijau
};
const STATUS_GLOW: Record<string, string> = {
  empty:    "0 0 10px rgba(239,68,68,0.8), 0 0 0 4px rgba(239,68,68,0.2)",
  partial:  "0 0 10px rgba(245,158,11,0.8), 0 0 0 4px rgba(245,158,11,0.2)",
  complete: "0 0 10px rgba(22,163,74,0.8),  0 0 0 4px rgba(22,163,74,0.2)",
};

function createMonitoringIcon(status: "empty" | "partial" | "complete") {
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
  onSave:  (id: string, data: MonitoringData) => void;
  onClose: () => void;
  macroUrl?: string;
}

function MonitoringModal({ point, initial, onSave, onClose, macroUrl }: ModalProps) {
  const [activeTab, setActiveTab] = useState<"reservoir" | "makrometer">("reservoir");
  const [sesi,      setSesi]      = useState<"pagi" | "sore">("pagi");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    onSave(point.id, updated);
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
        <div className="px-6 flex gap-6 border-b border-slate-100">
          {([
            { key: "reservoir",  label: "Reservoir",  Icon: Droplets },
            { key: "makrometer", label: "Makrometer", Icon: Gauge    },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors relative ${
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

        {/* Form Content */}
        <div className="p-6">
          {activeTab === "reservoir" && (
            <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
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
            <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
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
        </div>

        {/* Ringkasan */}
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

        {/* Footer */}
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
            {isSubmitting ? (
              <span>Menyimpan...</span>
            ) : (
              <>
                <Send size={15} /> Simpan Data
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Komponen Utama Layer ────────────────────────────────────────────────────
interface MonitoringLayerProps {
  data:    Record<string, MonitoringData>;
  onSave:  (id: string, data: MonitoringData) => void;
  macroUrl?: string;
}

export function MonitoringLayer({ data, onSave, macroUrl }: MonitoringLayerProps) {
  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <>
      {MONITORING_POINTS.map((point) => {
        const status = getCompletionStatus(data[point.id]);
        return (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={createMonitoringIcon(status)}
            eventHandlers={{
              click: () => setOpenModal(point.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -36]} opacity={1}>
              <div style={{ textAlign: "center", padding: "2px 4px" }}>
                <p style={{ fontWeight: 700, margin: "0 0 4px 0", color: "#1e293b", fontSize: 13 }}>
                  {point.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                  Status:{" "}
                  <span style={{ color: STATUS_COLORS[status], fontWeight: "bold" }}>
                    {status === "complete" ? "✅ Lengkap" : status === "partial" ? "⚠️ Sebagian" : "❌ Belum Diisi"}
                  </span>
                </p>
                <p style={{ margin: "6px 0 0 0", fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>
                  (Klik untuk input data)
                </p>
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Portal-like modal — rendered outside map */}
      {openModal && (
        <MonitoringModal
          point={MONITORING_POINTS.find((p) => p.id === openModal)!}
          initial={data[openModal]}
          onSave={onSave}
          onClose={() => setOpenModal(null)}
          macroUrl={macroUrl}
        />
      )}
    </>
  );
}
