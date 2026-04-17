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

  const inputCls = "w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition";
  const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: 20, width: 380, maxWidth: "95vw",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#1e40af,#0ea5e9)",
          padding: "18px 20px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ color: "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              Titik Monitoring
            </p>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: 0 }}>{point.name}</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 9999, padding: 6, cursor: "pointer", color: "white", display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Sesi Selector */}
        <div style={{ display: "flex", gap: 8, padding: "14px 20px 0" }}>
          {(["pagi", "sore"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleSesiChange(s)}
              style={{
                flex: 1, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
                background: sesi === s ? "#1e40af" : "#f1f5f9",
                color: sesi === s ? "white" : "#64748b",
                transition: "all .2s",
              }}
            >
              {s === "pagi" ? "🌅 Pagi" : "🌇 Sore"}
            </button>
          ))}
        </div>

        {/* Tab Selector */}
        <div style={{ display: "flex", gap: 0, padding: "12px 20px 0" }}>
          {([
            { key: "reservoir",  label: "Reservoir",  Icon: Droplets },
            { key: "makrometer", label: "Makrometer", Icon: Gauge    },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1, height: 40, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 13,
                borderBottom: activeTab === key ? "3px solid #0ea5e9" : "3px solid #e2e8f0",
                background: "transparent",
                color: activeTab === key ? "#0ea5e9" : "#94a3b8",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all .2s",
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Form Fields */}
        <div style={{ padding: "18px 20px" }}>
          {activeTab === "reservoir" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className={labelCls}>Tinggi Air (cm)</label>
                <input
                  type="number" min="0" max="999" step="0.1"
                  placeholder="cth: 180.5"
                  value={tinggiAir}
                  onChange={(e) => setTinggiAir(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
          {activeTab === "makrometer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className={labelCls}>Tekanan (Bar)</label>
                <input
                  type="number" min="0" max="20" step="0.01"
                  placeholder="cth: 3.5"
                  value={tekanan}
                  onChange={(e) => setTekanan(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Ring kasan data sesi saat ini */}
        <div style={{ margin: "0 20px 14px", padding: "10px 14px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}>
          <p style={{ fontWeight: 700, color: "#475569", marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Ringkasan Sesi {sesi === "pagi" ? "Pagi" : "Sore"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 0" }}>
            {[
              { label: "Tinggi Air", value: tinggiAir  !== "" ? `${tinggiAir} cm`  : "—" },
              { label: "Tekanan",    value: tekanan    !== "" ? `${tekanan} bar`   : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <span style={{ color: "#94a3b8" }}>{label}: </span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ padding: "0 20px 20px" }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: "100%", height: 48, border: "none", borderRadius: 14, cursor: isSubmitting ? "wait" : "pointer",
              background: isSubmitting ? "#94a3b8" : "linear-gradient(135deg,#1e40af,#0ea5e9)",
              color: "white", fontWeight: 700, fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: isSubmitting ? "none" : "0 4px 15px rgba(14,165,233,0.4)",
              transition: "transform .1s, box-shadow .1s",
            }}
            onMouseDown={(e) => (!isSubmitting && (e.currentTarget.style.transform = "scale(0.97)"))}
            onMouseUp={(e)   => (!isSubmitting && (e.currentTarget.style.transform = "scale(1)"))}
          >
            {isSubmitting ? (
              <span style={{ fontSize: 14 }}>Sedang Mengirim...</span>
            ) : (
              <>
                <Send size={17} /> Kirim Semua
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
