/**
 * MonitoringLayer.tsx
 * Marker titik monitoring Reservoir + Makrometer di peta.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { X, Send, Droplets, Gauge, TrendingUp, Plus, Pencil, Trash2, MapPin, Save } from "lucide-react";
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

// ─── Tipe Data ───────────────────────────────────────────────────────────────
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

// ─── Hardcoded fallback points ───────────────────────────────────────────────
export const MONITORING_POINTS: MonitoringPoint[] = [
  { id: "MON-01", name: "Reservoir Induk (IPA)",  lat: -8.6650, lng: 116.3150 },
  { id: "MON-02", name: "BPT Airvale",            lat: -8.6720, lng: 116.3080 },
  { id: "MON-03", name: "Reservoir Airbaku",      lat: -8.6590, lng: 116.3220 },
  { id: "MON-04", name: "BPT Montong Terep",      lat: -8.6680, lng: 116.3000 },
  { id: "MON-05", name: "Reservoir Pagesangan",   lat: -8.6750, lng: 116.3300 },
];

type AnalysisStatus = "empty" | "normal" | "warning" | "critical";

function getAnalysisStatus(data?: MonitoringData): AnalysisStatus {
  if (!data) return "empty";
  const latest = (data.sore?.tinggiAir || data.sore?.tekanan) ? data.sore : data.pagi;
  if (!latest) return "empty";
  if (latest.tinggiAir == null && latest.tekanan == null) return "empty";
  let isCritical = false, isWarning = false;
  if (latest.tekanan != null) {
    if (latest.tekanan < 0.5) isCritical = true;
    else if (latest.tekanan < 1.0) isWarning = true;
  }
  if (latest.tinggiAir != null) {
    if (latest.tinggiAir < 50) isCritical = true;
    else if (latest.tinggiAir < 100) isWarning = true;
  }
  if (data.pagi?.tinggiAir != null && data.sore?.tinggiAir != null) {
    if (data.pagi.tinggiAir - data.sore.tinggiAir > 100) isWarning = true;
  }
  if (isCritical) return "critical";
  if (isWarning) return "warning";
  return "normal";
}

// ─── Status display helpers ───────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  empty: "Belum Input", normal: "Normal", warning: "Waspada", critical: "Kritis",
};
const STATUS_BADGE: Record<string, string> = {
  empty:    "bg-slate-100 text-slate-500",
  normal:   "bg-emerald-50 text-emerald-700",
  warning:  "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
};

// ─── Point type detection ─────────────────────────────────────────────────────
type PointType = "reservoir" | "bpt" | "ipa";

function getPointType(name: string): PointType {
  const n = name.toLowerCase();
  if (n.includes("bpt")) return "bpt";
  if (n.includes("ipa") || n.includes("instalasi") || n.includes("sumber") || n.includes("intake")) return "ipa";
  return "reservoir";
}

// ─── Color palettes per status ────────────────────────────────────────────────
const STATUS_PALETTE: Record<AnalysisStatus, { bg: string; roof: string; stroke: string; water: string }> = {
  empty:    { bg: "#1f2937", roof: "#111827", stroke: "#6b7280", water: "#6b7280" },
  normal:   { bg: "#166534", roof: "#15803d", stroke: "#22c55e", water: "#22c55e" },
  warning:  { bg: "#78350f", roof: "#92400e", stroke: "#f59e0b", water: "#f59e0b" },
  critical: { bg: "#7f1d1d", roof: "#991b1b", stroke: "#ef4444", water: "#ef4444" },
};

// ─── SVG builders ─────────────────────────────────────────────────────────────
function buildReservoirSVG(c: typeof STATUS_PALETTE["normal"], status: AnalysisStatus): string {
  const badgeDot = status === "empty"
    ? `<circle cx="52" cy="18" r="5" fill="${c.stroke}" opacity="0.5"/>`
    : status === "normal"
    ? `<circle cx="52" cy="18" r="5" fill="${c.stroke}"/>
       <circle cx="52" cy="18" r="5" fill="${c.stroke}" opacity="0.4">
         <animate attributeName="r" from="5" to="11" dur="2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
       </circle>`
    : status === "warning"
    ? `<circle cx="52" cy="18" r="5" fill="${c.stroke}"/>
       <text x="52" y="22" text-anchor="middle" fill="white" font-size="7" font-weight="bold">!</text>`
    : `<circle cx="52" cy="18" r="5" fill="${c.stroke}">
         <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
       </circle>
       <text x="52" y="22" text-anchor="middle" fill="white" font-size="7" font-weight="bold">✕</text>`;

  const waterLevel = status === "empty"
    ? `<text x="32" y="42" text-anchor="middle" fill="${c.stroke}" font-size="16" font-weight="bold">?</text>`
    : status === "warning"
    ? `<rect x="9" y="42" width="46" height="11" rx="0" fill="${c.stroke}" opacity="0.15"/>
       <line x1="9" y1="42" x2="55" y2="42" stroke="${c.stroke}" stroke-width="1.5" stroke-dasharray="4,2"/>
       <path d="M32 28 C32 28 26 35 26 39 C26 42.3 28.7 45 32 45 C35.3 45 38 42.3 38 39 C38 35 32 28 32 28Z" fill="${c.water}" opacity="0.9"/>
       <ellipse cx="29.5" cy="37" rx="2" ry="3" fill="white" opacity="0.3" transform="rotate(-15 29.5 37)"/>`
    : status === "critical"
    ? `<rect x="9" y="50" width="46" height="3" rx="0" fill="${c.stroke}" opacity="0.15"/>
       <line x1="9" y1="50" x2="55" y2="50" stroke="${c.stroke}" stroke-width="1.5"/>
       <path d="M32 28 C32 28 26 35 26 39 C26 42.3 28.7 45 32 45 C35.3 45 38 42.3 38 39 C38 35 32 28 32 28Z" fill="${c.water}" opacity="0.9"/>
       <ellipse cx="29.5" cy="37" rx="2" ry="3" fill="white" opacity="0.3" transform="rotate(-15 29.5 37)"/>`
    : `<path d="M32 28 C32 28 26 35 26 39 C26 42.3 28.7 45 32 45 C35.3 45 38 42.3 38 39 C38 35 32 28 32 28Z" fill="${c.water}" opacity="0.9"/>
       <ellipse cx="29.5" cy="37" rx="2" ry="3" fill="white" opacity="0.3" transform="rotate(-15 29.5 37)"/>`;

  const dashStyle = status === "empty" ? `stroke-dasharray="5,3"` : "";

  return `<svg width="40" height="45" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="22" width="48" height="32" rx="4" fill="${c.bg}" stroke="${c.stroke}" stroke-width="2" ${dashStyle}/>
    <rect x="4" y="16" width="56" height="8" rx="3" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1.5"/>
    <line x1="8" y1="32" x2="56" y2="32" stroke="${c.stroke}" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.4"/>
    <line x1="8" y1="42" x2="56" y2="42" stroke="${c.stroke}" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.4"/>
    ${waterLevel}
    <rect x="26" y="54" width="6" height="8" rx="1" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="36" y="54" width="6" height="8" rx="1" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="20" y="62" width="24" height="4" rx="2" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1"/>
    ${badgeDot}
  </svg>`;
}

function buildBptSVG(c: typeof STATUS_PALETTE["normal"], status: AnalysisStatus): string {
  const badgeDot = status === "normal"
    ? `<circle cx="50" cy="20" r="5" fill="${c.stroke}"/>
       <circle cx="50" cy="20" r="5" fill="${c.stroke}" opacity="0.4">
         <animate attributeName="r" from="5" to="11" dur="2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
       </circle>`
    : status === "warning"
    ? `<circle cx="50" cy="20" r="5" fill="${c.stroke}"/>
       <text x="50" y="24" text-anchor="middle" fill="white" font-size="7" font-weight="bold">!</text>`
    : status === "critical"
    ? `<circle cx="50" cy="20" r="5" fill="${c.stroke}">
         <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
       </circle>
       <text x="50" y="24" text-anchor="middle" fill="white" font-size="7" font-weight="bold">✕</text>`
    : `<circle cx="50" cy="20" r="5" fill="${c.stroke}" opacity="0.5"/>`;

  return `<svg width="40" height="45" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="26" width="36" height="28" rx="4" fill="${c.bg}" stroke="${c.stroke}" stroke-width="2"/>
    <rect x="10" y="20" width="44" height="8" rx="3" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1.5"/>
    <path d="M32 30 L32 44 M28 40 L32 44 L36 40" stroke="${c.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="24" y="54" width="6" height="8" rx="1" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="34" y="54" width="6" height="8" rx="1" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="18" y="62" width="28" height="4" rx="2" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1"/>
    <text x="32" y="19" text-anchor="middle" fill="${c.stroke}" font-size="5.5" font-weight="bold" font-family="monospace">BPT</text>
    ${badgeDot}
  </svg>`;
}

function buildIpaSVG(c: typeof STATUS_PALETTE["normal"], status: AnalysisStatus): string {
  const badgeDot = status === "normal"
    ? `<circle cx="52" cy="18" r="5" fill="${c.stroke}"/>
       <circle cx="52" cy="18" r="5" fill="${c.stroke}" opacity="0.4">
         <animate attributeName="r" from="5" to="11" dur="2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
       </circle>`
    : status === "warning"
    ? `<circle cx="52" cy="18" r="5" fill="${c.stroke}"/>
       <text x="52" y="22" text-anchor="middle" fill="white" font-size="7" font-weight="bold">!</text>`
    : status === "critical"
    ? `<circle cx="52" cy="18" r="5" fill="${c.stroke}">
         <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
       </circle>
       <text x="52" y="22" text-anchor="middle" fill="white" font-size="7" font-weight="bold">✕</text>`
    : `<circle cx="52" cy="18" r="5" fill="${c.stroke}" opacity="0.5"/>`;

  return `<svg width="40" height="45" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="28" width="52" height="26" rx="4" fill="${c.bg}" stroke="${c.stroke}" stroke-width="2"/>
    <path d="M4 28 L32 12 L60 28Z" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="14" y="36" width="10" height="10" rx="2" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1"/>
    <rect x="40" y="36" width="10" height="10" rx="2" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1"/>
    <rect x="28" y="18" width="8" height="12" rx="1" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1"/>
    <path d="M32 36 C32 36 29 40 29 42 C29 43.7 30.3 45 32 45 C33.7 45 35 43.7 35 42 C35 40 32 36 32 36Z" fill="${c.stroke}"/>
    <rect x="22" y="54" width="6" height="8" rx="1" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="36" y="54" width="6" height="8" rx="1" fill="${c.bg}" stroke="${c.stroke}" stroke-width="1.5"/>
    <rect x="16" y="62" width="32" height="4" rx="2" fill="${c.roof}" stroke="${c.stroke}" stroke-width="1"/>
    <text x="32" y="25" text-anchor="middle" fill="${c.stroke}" font-size="5" font-weight="bold" font-family="monospace">IPA</text>
    ${badgeDot}
  </svg>`;
}

// ─── Main icon factory ────────────────────────────────────────────────────────
function createMonitoringIcon(status: AnalysisStatus, pointType: PointType = "reservoir") {
  const c = STATUS_PALETTE[status];

  let svgHtml: string;
  if (pointType === "bpt")      svgHtml = buildBptSVG(c, status);
  else if (pointType === "ipa") svgHtml = buildIpaSVG(c, status);
  else                          svgHtml = buildReservoirSVG(c, status);

  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="filter:drop-shadow(0 4px 12px ${c.stroke}66)">${svgHtml}</div>`,
    iconSize:   [40, 45],
    iconAnchor: [20, 45],
  });
}

// ─── CSS Animation injection ──────────────────────────────────────────────────
const MODAL_STYLE = `
  @keyframes mon-modal-in {
    from { opacity:0; transform:scale(0.95) translateY(8px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  .mon-modal-enter { animation: mon-modal-in 0.2s cubic-bezier(0.16,1,0.3,1) forwards; }
`;

// ─── Unified Modal (view data + optionally edit point) ───────────────────────
interface UnifiedModalProps {
  point:      MonitoringPoint & { dbId?: number };
  initial?:   MonitoringData;
  status:     AnalysisStatus;
  editMode:   boolean;
  onSave:     (id: string, session: "pagi" | "sore", d: { tinggiAir?: number; tekanan?: number }) => void;
  onClose:    () => void;
  onDeleted:  () => void;
  onUpdated:  (newPt: { name: string; lat: number; lng: number }) => void;
  macroUrl?:  string;
}

function UnifiedModal({ point, initial, status, editMode, onSave, onClose, onDeleted, onUpdated, macroUrl }: UnifiedModalProps) {
  type Tab = "reservoir" | "makrometer" | "tren" | "edit";
  const [activeTab, setActiveTab] = useState<Tab>("reservoir");
  const [sesi,      setSesi]      = useState<"pagi" | "sore">("pagi");
  const [submitting, setSubmitting] = useState(false);

  // Data input fields
  const [tinggiAir, setTinggiAir] = useState(String(initial?.[sesi]?.tinggiAir ?? ""));
  const [tekanan,   setTekanan]   = useState(String(initial?.[sesi]?.tekanan ?? ""));

  // Edit fields
  const [editName, setEditName] = useState(point.name);
  const [editLat,  setEditLat]  = useState(String(point.lat));
  const [editLng,  setEditLng]  = useState(String(point.lng));
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updatePoint = useUpdateMonitoringPoint();
  const deletePoint = useDeleteMonitoringPoint();
  const queryClient = useQueryClient();
  const invalidate  = () => queryClient.invalidateQueries({ queryKey: getListMonitoringPointsQueryKey() });

  const handleSesiChange = (s: "pagi" | "sore") => {
    setSesi(s);
    setTinggiAir(String(initial?.[s]?.tinggiAir ?? ""));
    setTekanan(String(initial?.[s]?.tekanan ?? ""));
  };

  const handleSubmitData = async () => {
    if (macroUrl?.trim().startsWith("https://script.google.com/")) {
      setSubmitting(true);
      try {
        await fetch(macroUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ lokasi: point.name, sesi, tinggiAir: tinggiAir || "", tekanan: tekanan || "" }),
        });
      } catch (err: any) {
        toast.error("Gagal kirim ke Spreadsheet: " + err.message);
      } finally { setSubmitting(false); }
    }
    onSave(point.id, sesi, {
      tinggiAir: tinggiAir !== "" ? Number(tinggiAir) : undefined,
      tekanan:   tekanan   !== "" ? Number(tekanan)   : undefined,
    });
    onClose();
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) { toast.error("Nama tidak boleh kosong"); return; }
    const lat = parseFloat(editLat), lng = parseFloat(editLng);
    if (isNaN(lat) || isNaN(lng)) { toast.error("Koordinat tidak valid"); return; }
    if (!point.dbId) { toast.error("Titik ini tidak ada di database"); return; }
    setSaving(true);
    updatePoint.mutate(
      { id: point.dbId, data: { name: editName.trim(), lat, lng } },
      {
        onSuccess: () => {
          invalidate();
          onUpdated({ name: editName.trim(), lat, lng });
          toast.success("Titik berhasil diperbarui");
          onClose();
        },
        onError: () => { toast.error("Gagal memperbarui titik"); setSaving(false); },
      }
    );
  };

  const handleDelete = () => {
    if (!point.dbId) { toast.error("Titik tidak ada di database"); return; }
    if (!confirm(`Hapus titik "${point.name}"?\nData monitoring terkait TIDAK ikut terhapus.`)) return;
    setDeleting(true);
    deletePoint.mutate(
      { id: point.dbId },
      {
        onSuccess: () => { invalidate(); toast.success(`Titik "${point.name}" dihapus`); onDeleted(); onClose(); },
        onError:   () => { toast.error("Gagal menghapus titik"); setDeleting(false); },
      }
    );
  };

  // 7-day simulated trend
  const trendData = (() => {
    const base = initial?.sore ?? initial?.pagi;
    const bT = base?.tinggiAir ?? 180, bP = base?.tekanan ?? 2.1;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return {
        name: d.toLocaleDateString("id-ID", { weekday: "short" }),
        "Tinggi Air": +(bT + Math.sin(i) * 15 + (Math.random() * 20 - 10)).toFixed(1),
        Tekanan:      +(bP + Math.sin(i) * 0.3 + (Math.random() * 0.4 - 0.2)).toFixed(2),
      };
    });
  })();

  const inputCls = "w-full h-11 bg-transparent border-b-2 border-slate-200 px-1 text-sm text-slate-800 outline-none focus:border-slate-900 transition-colors placeholder:text-slate-300";
  const labelCls = "block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1";

  const tabs: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: "reservoir",  label: "Reservoir",   Icon: Droplets },
    { key: "makrometer", label: "Makrometer",  Icon: Gauge },
    { key: "tren",       label: "Tren Data",   Icon: TrendingUp },
    ...(editMode && point.dbId ? [{ key: "edit" as Tab, label: "Edit Titik", Icon: Pencil }] : []),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <style>{MODAL_STYLE}</style>
      <div
        className="mon-modal-enter w-[420px] max-w-[95vw] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Titik Monitoring</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{point.name}</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Sesi toggle (only for data tabs) */}
        {activeTab !== "tren" && activeTab !== "edit" && (
          <div className="px-6 pb-3">
            <div className="p-1 bg-slate-100 rounded-lg flex">
              {(["pagi", "sore"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => handleSesiChange(s)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                    sesi === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s === "pagi" ? "Sesi Pagi" : "Sesi Sore"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 flex gap-5 border-b border-slate-100">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors relative ${
                activeTab === key ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon size={13} /> {label}
              {activeTab === key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Reservoir */}
          {activeTab === "reservoir" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tinggi Air (cm)</label>
                <input type="number" min="0" max="999" step="0.1" placeholder="0.0"
                  value={tinggiAir} onChange={e => setTinggiAir(e.target.value)} className={inputCls} />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between text-xs">
                <div><p className="text-slate-400 mb-0.5">Tinggi Air</p><p className="font-semibold text-slate-900">{tinggiAir ? `${tinggiAir} cm` : "—"}</p></div>
                <div><p className="text-slate-400 mb-0.5">Tekanan</p><p className="font-semibold text-slate-900">{tekanan ? `${tekanan} Bar` : "—"}</p></div>
              </div>
              <button onClick={handleSubmitData} disabled={submitting}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-50">
                {submitting ? "Menyimpan..." : <><Send size={14} /> Simpan Data</>}
              </button>
            </div>
          )}

          {/* Makrometer */}
          {activeTab === "makrometer" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tekanan (Bar)</label>
                <input type="number" min="0" max="20" step="0.01" placeholder="0.00"
                  value={tekanan} onChange={e => setTekanan(e.target.value)} className={inputCls} />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between text-xs">
                <div><p className="text-slate-400 mb-0.5">Tinggi Air</p><p className="font-semibold text-slate-900">{tinggiAir ? `${tinggiAir} cm` : "—"}</p></div>
                <div><p className="text-slate-400 mb-0.5">Tekanan</p><p className="font-semibold text-slate-900">{tekanan ? `${tekanan} Bar` : "—"}</p></div>
              </div>
              <button onClick={handleSubmitData} disabled={submitting}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-50">
                {submitting ? "Menyimpan..." : <><Send size={14} /> Simpan Data</>}
              </button>
            </div>
          )}

          {/* Tren */}
          {activeTab === "tren" && (
            <div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cT2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="cP2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} dy={5} />
                  <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 25px rgba(0,0,0,.1)", fontSize: 12 }} />
                  <Area yAxisId="l" type="monotone" dataKey="Tinggi Air" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#cT2)" activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area yAxisId="r" type="monotone" dataKey="Tekanan" stroke="#f59e0b" strokeWidth={2.5} fill="url(#cP2)" activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-slate-700">✓ Data tren 7 hari terakhir ditampilkan di atas.</p>
              </div>
              <button onClick={() => setActiveTab("reservoir")}
                className="mt-3 w-full py-3 rounded-xl font-semibold text-sm border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all">
                Kembali ke Form Input
              </button>
            </div>
          )}

          {/* Edit Titik */}
          {activeTab === "edit" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nama Titik</label>
                <input type="text" placeholder="Nama titik monitoring"
                  value={editName} onChange={e => setEditName(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Latitude</label>
                  <input type="number" step="0.00001" placeholder="-8.000000"
                    value={editLat} onChange={e => setEditLat(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Longitude</label>
                  <input type="number" step="0.00001" placeholder="116.000000"
                    value={editLng} onChange={e => setEditLng(e.target.value)} className={inputCls} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin size={10} /> Ubah koordinat — marker akan otomatis berpindah setelah disimpan.
              </p>

              <div className="flex gap-3 pt-1">
                <button onClick={handleSaveEdit} disabled={saving || deleting}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50">
                  {saving ? "Menyimpan..." : <><Save size={14} /> Simpan Perubahan</>}
                </button>
                <button onClick={handleDelete} disabled={saving || deleting}
                  className="px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition-all disabled:opacity-50 border border-red-100">
                  {deleting ? "..." : <><Trash2 size={14} /> Hapus</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Add New Point Form (clean overlay, not Leaflet Tooltip) ──────────────────
interface AddPointFormProps {
  coord:     { lat: number; lng: number };
  onCreate:  (name: string) => void;
  onCancel:  () => void;
  loading:   boolean;
}
function AddPointForm({ coord, onCreate, onCancel, loading }: AddPointFormProps) {
  const [name, setName] = useState("");
  const [lat,  setLat]  = useState(coord.lat.toFixed(6));
  const [lng,  setLng]  = useState(coord.lng.toFixed(6));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const labelCls = "block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1";
  const inputCls = "w-full h-10 bg-transparent border-b-2 border-slate-200 px-1 text-sm text-slate-800 outline-none focus:border-slate-900 transition-colors placeholder:text-slate-300";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onCancel}>
      <style>{MODAL_STYLE}</style>
      <div
        className="mon-modal-enter w-[380px] max-w-[95vw] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Plus size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Titik Baru</p>
              <h2 className="text-base font-bold text-slate-900">Tambah Titik Monitoring</h2>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className={labelCls}>Nama Titik</label>
            <input ref={inputRef} type="text" placeholder="Contoh: BPT Narmada, Reservoir Sukamaju..."
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && name.trim()) onCreate(name.trim()); }}
              className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Latitude</label>
              <input type="number" step="0.00001" value={lat} onChange={e => setLat(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Longitude</label>
              <input type="number" step="0.00001" value={lng} onChange={e => setLng(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
            <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700 font-medium">
              Koordinat sudah terisi dari klik peta. Anda dapat mengubahnya secara manual jika perlu.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
              Batal
            </button>
            <button
              onClick={() => { if (name.trim()) onCreate(name.trim()); else toast.error("Nama tidak boleh kosong"); }}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? "Menyimpan..." : <><Plus size={14} /> Buat Titik</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── AddClickListener ────────────────────────────────────────────────────────
function AddClickListener({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// ─── Main MonitoringLayer ────────────────────────────────────────────────────
interface MonitoringLayerProps {
  data:      Record<string, MonitoringData>;
  onSave:    (id: string, session: "pagi" | "sore", d: { tinggiAir?: number; tekanan?: number }) => void;
  macroUrl?: string;
  editMode?: boolean;
}

type ActivePoint = MonitoringPoint & { dbId?: number };

export function MonitoringLayer({ data, onSave, macroUrl, editMode = false }: MonitoringLayerProps) {
  const queryClient  = useQueryClient();
  const { data: dbPoints } = useListMonitoringPoints();
  const createPoint  = useCreateMonitoringPoint();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMonitoringPointsQueryKey() });

  // Build active points list (DB-backed or fallback)
  const points: ActivePoint[] = (dbPoints && dbPoints.length > 0)
    ? dbPoints.map(p => ({ id: p.pointId, name: p.name, lat: p.lat, lng: p.lng, dbId: p.id }))
    : MONITORING_POINTS.map(p => ({ ...p, dbId: undefined }));

  const [openId,       setOpenId]       = useState<string | null>(null);
  const [addMode,      setAddMode]      = useState(false);
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [creating,     setCreating]     = useState(false);

  const handleMapClick = (lat: number, lng: number) => {
    if (!addMode) return;
    setPendingCoord({ lat, lng });
    setAddMode(false);
  };

  const handleCreate = (name: string) => {
    if (!pendingCoord) return;
    setCreating(true);
    const auto = `MON-${String(Date.now()).slice(-5)}`;
    createPoint.mutate(
      { data: { pointId: auto, name, lat: pendingCoord.lat, lng: pendingCoord.lng } },
      {
        onSuccess: () => { invalidate(); setPendingCoord(null); setCreating(false); toast.success(`Titik "${name}" berhasil dibuat`); },
        onError:   () => { toast.error("Gagal membuat titik"); setCreating(false); },
      }
    );
  };

  const openPoint = openId ? points.find(p => p.id === openId) : null;

  return (
    <>
      {/* Map click listener in add mode */}
      {editMode && addMode && <AddClickListener onMapClick={handleMapClick} />}

      {/* Markers */}
      {points.map(pt => {
        const status = getAnalysisStatus(data[pt.id]);
        return (
          <Marker
            key={pt.id}
            position={[pt.lat, pt.lng]}
            icon={createMonitoringIcon(status, getPointType(pt.name))}
            eventHandlers={{ click: () => setOpenId(pt.id) }}
          >
            <Tooltip direction="top" offset={[0, -22]} opacity={1}
              className="!bg-white !border-0 !shadow-xl !rounded-xl !font-sans !px-3 !py-2">
              <div className="text-center">
                <p className="font-bold text-sm text-slate-900">{pt.name}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_BADGE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                {editMode && <p className="text-[10px] text-slate-400 mt-1">Klik untuk lihat/edit</p>}
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Unified modal for viewing & editing */}
      {openPoint && (
        <UnifiedModal
          point={openPoint}
          initial={data[openPoint.id]}
          status={getAnalysisStatus(data[openPoint.id])}
          editMode={editMode}
          onSave={onSave}
          onClose={() => setOpenId(null)}
          onDeleted={() => setOpenId(null)}
          onUpdated={() => {}}
          macroUrl={macroUrl}
        />
      )}

      {/* Add new point form */}
      {pendingCoord && (
        <AddPointForm
          coord={pendingCoord}
          onCreate={handleCreate}
          onCancel={() => setPendingCoord(null)}
          loading={creating}
        />
      )}

      {/* Edit mode: floating Add button overlay (rendered via React portal) */}
      {editMode && createPortal(
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 1500 }}>
          {!addMode && !pendingCoord ? (
            <button
              onClick={() => { setAddMode(true); toast.info("Klik pada peta untuk meletakkan titik baru"); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
              style={{ boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}
            >
              <Plus size={16} /> Tambah Titik Monitoring
            </button>
          ) : addMode ? (
            <button
              onClick={() => setAddMode(false)}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl hover:bg-amber-600 active:scale-95 transition-all animate-pulse"
            >
              <MapPin size={16} /> Klik titik di peta — klik di sini untuk batal
            </button>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
}
