/**
 * DireksiDashboard.tsx
 * Dashboard Direksi — Sistem Monitoring Distribusi Air PDAM TIARA
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft, AlertTriangle, TrendingUp, FileDown,
  Droplets, Clock, Moon, Sun, Sparkles, Loader2,
  ClipboardEdit, Map as MapIcon, Gauge, ChevronDown,
} from "lucide-react";
import { MONITORING_POINTS, type MonitoringData, type MonitoringPoint } from "@/components/MonitoringLayer";
import {
  RESERVOIRS, MANOMETERS, JALUR_PIPA, DOPENDS,
  getJalurForReservoir, getManometersForJalur, getDopend, getReservoir,
  getAffectedArea, getCriticalManometers, getProblematicManometers,
  STATUS_COLORS, STATUS_LABELS,
  type Reservoir as NetworkReservoir,
} from "@/data/networkData";
import { useGetMonitoringData, useListMonitoringPoints } from "@workspace/api-client-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PointStatus {
  point: MonitoringPoint;
  status: "normal" | "warning" | "critical" | "empty";
  cause: string;
  since: string;
  prediksiKritis: string;
  tinggiAir?: number;
  tekanan?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

type ChartPeriod = "daily" | "weekly" | "monthly";

// Data bayangan bawaan per titik — variasi status berbeda
// Akan dipakai sebagai fallback jika belum ada data asli dari database
const SHADOW_DATA: Record<string, { tinggiAir: number; tekanan: number }> = {
  "MON-01": { tinggiAir: 280, tekanan: 5.8 },  // Reservoir Induk — NORMAL (sehat)
  "MON-02": { tinggiAir: 85,  tekanan: 0.8 },  // BPT Airvale — WASPADA (tekanan redup)
  "MON-03": { tinggiAir: 310, tekanan: 6.2 },  // Reservoir Airbaku — NORMAL (baik)
  "MON-04": { tinggiAir: 42,  tekanan: 0.3 },  // BPT Montong Terep — KRITIS (drop)
  "MON-05": { tinggiAir: 220, tekanan: 5.0 },  // Reservoir Pagesangan — NORMAL
};

// ─── Aggregate helpers for chart data generation ─────────────────────────────
function getBaseValues(pt: MonitoringPoint, monitoringData: Record<string, MonitoringData>) {
  const ptData = monitoringData[pt.id];
  const session = ptData?.sore ?? ptData?.pagi;
  const shadow = SHADOW_DATA[pt.id];
  return {
    tinggiAir: session?.tinggiAir ?? shadow?.tinggiAir ?? null,
    tekanan:   session?.tekanan   ?? shadow?.tekanan   ?? null,
  };
}

function aggregatePoints(
  points: MonitoringPoint[],
  monitoringData: Record<string, MonitoringData>,
  selectedPointId: string,
  noiseIdx: number,
) {
  let tT = 0, tP = 0, cT = 0, cP = 0;
  points.forEach(pt => {
    if (selectedPointId !== "all" && pt.id !== selectedPointId) return;
    const { tinggiAir, tekanan } = getBaseValues(pt, monitoringData);
    if (tinggiAir != null) {
      const n = Math.sin(noiseIdx * 1.7 + pt.lat * 100) * 12;
      tT += tinggiAir + n * (noiseIdx > 0 ? 1 : 0); cT++;
    }
    if (tekanan != null) {
      const n = Math.sin(noiseIdx * 2.3 + pt.lng * 100) * 0.25;
      tP += tekanan + n * (noiseIdx > 0 ? 1 : 0); cP++;
    }
  });
  return {
    tinggiAir: cT > 0 ? Number((tT / cT).toFixed(1)) : null,
    tekanan:   cP > 0 ? Number((tP / cP).toFixed(2)) : null,
  };
}

function generateChartData(
  monitoringData: Record<string, MonitoringData>,
  selectedPointId: string,
  period: ChartPeriod,
) {
  const now = new Date();
  const data: any[] = [];

  if (period === "daily") {
    // 7 hari terakhir
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i);
      const dayName = HARI[d.getDay()];
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      const vals = aggregatePoints(MONITORING_POINTS, monitoringData, selectedPointId, i);
      data.push({ ...vals, label: dayName, sublabel: dateStr });
    }
  } else if (period === "weekly") {
    // 4 minggu terakhir
    for (let w = 3; w >= 0; w--) {
      let tT = 0, tP = 0, cnt = 0;
      for (let d = 0; d < 7; d++) {
        const idx = w * 7 + d;
        const vals = aggregatePoints(MONITORING_POINTS, monitoringData, selectedPointId, idx);
        if (vals.tinggiAir != null) { tT += vals.tinggiAir; cnt++; }
        if (vals.tekanan != null)   { tP += vals.tekanan; }
      }
      const weekStart = new Date(); weekStart.setDate(now.getDate() - w * 7 - 6);
      const weekEnd = new Date(); weekEnd.setDate(now.getDate() - w * 7);
      data.push({
        label: `Mgg ${4 - w}`,
        sublabel: `${weekStart.getDate()}/${weekStart.getMonth() + 1}-${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`,
        tinggiAir: cnt > 0 ? Number((tT / cnt).toFixed(1)) : null,
        tekanan:   cnt > 0 ? Number((tP / cnt).toFixed(2)) : null,
      });
    }
  } else {
    // 6 bulan terakhir
    for (let m = 5; m >= 0; m--) {
      const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
      let tT = 0, tP = 0, cnt = 0;
      // simulate ~30 days worth
      for (let d = 0; d < 30; d++) {
        const vals = aggregatePoints(MONITORING_POINTS, monitoringData, selectedPointId, m * 30 + d);
        if (vals.tinggiAir != null) { tT += vals.tinggiAir; cnt++; }
        if (vals.tekanan != null)   { tP += vals.tekanan; }
      }
      data.push({
        label: BULAN[target.getMonth()],
        sublabel: `${target.getFullYear()}`,
        tinggiAir: cnt > 0 ? Number((tT / cnt).toFixed(1)) : null,
        tekanan:   cnt > 0 ? Number((tP / cnt).toFixed(2)) : null,
      });
    }
  }
  return data;
}

function linearRegression(data: { x: number; y: number }[]) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.y ?? 0 };
  const sumX = data.reduce((a, b) => a + b.x, 0);
  const sumY = data.reduce((a, b) => a + b.y, 0);
  const sumXY = data.reduce((a, b) => a + b.x * b.y, 0);
  const sumX2 = data.reduce((a, b) => a + b.x * b.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

const PRED_LABELS: Record<ChartPeriod, string[]> = {
  daily:   ["+1 Hari", "+2 Hari", "+3 Hari"],
  weekly:  ["+1 Mgg", "+2 Mgg"],
  monthly: ["+1 Bln", "+2 Bln"],
};

function addPredictions(rawData: any[], period: ChartPeriod, aiPredictions?: { predTinggi: number; predTekanan: number }[] | null) {
  const tinggiPts = rawData.map((d, i) => ({ x: i, y: d.tinggiAir })).filter(p => p.y != null);
  const tekananPts = rawData.map((d, i) => ({ x: i, y: d.tekanan })).filter(p => p.y != null);

  const tReg = linearRegression(tinggiPts);
  const pReg = linearRegression(tekananPts);

  const labels = PRED_LABELS[period];
  const predictions = labels.map((lbl, i) => {
    const xVal = rawData.length - 1 + i + 1;
    // Jika AI sudah memberikan prediksi, gunakan angka AI; jika tidak, gunakan regresi
    const usedTinggi = aiPredictions?.[i]?.predTinggi ?? Number((tReg.slope * xVal + tReg.intercept).toFixed(1));
    const usedTekanan = aiPredictions?.[i]?.predTekanan ?? Number((pReg.slope * xVal + pReg.intercept).toFixed(2));
    return {
      label: lbl,
      sublabel: aiPredictions ? "AI pred" : "pred",
      tinggiAir: null,
      tekanan: null,
      predTinggi: Math.max(0, usedTinggi),
      predTekanan: Math.max(0, usedTekanan),
      isPrediction: true,
    };
  });

  const merged = rawData.map(d => ({ ...d, predTinggi: null, predTekanan: null, isPrediction: false }));

  // Bridge: last actual point also gets prediction value for continuous line
  if (merged.length > 0) {
    const last = merged[merged.length - 1];
    last.predTinggi = last.tinggiAir;
    last.predTekanan = last.tekanan;
  }

  return { data: [...merged, ...predictions], tReg, pReg };
}

function getPointStatuses(
  monitoringData: Record<string, MonitoringData>,
  points: MonitoringPoint[] = MONITORING_POINTS
): PointStatus[] {
  return points.map((pt) => {
    const d = monitoringData[pt.id];
    const session = d?.sore ?? d?.pagi;
    const shadow = SHADOW_DATA[pt.id];

    // Pakai data asli, kalau kosong fallback ke bayangan
    const effectiveTinggi = session?.tinggiAir ?? shadow?.tinggiAir;
    const effectiveTekanan = session?.tekanan ?? shadow?.tekanan;

    if (effectiveTinggi == null && effectiveTekanan == null) {
      return {
        point: pt,
        status: "empty" as const,
        cause: "Belum ada input",
        since: "-",
        prediksiKritis: "-",
        tinggiAir: undefined,
        tekanan: undefined,
      };
    }

    let status: "normal" | "warning" | "critical" = "normal";
    let cause = "Dalam batas normal";

    if (effectiveTekanan != null) {
      if (effectiveTekanan < 0.5) { status = "critical"; cause = `Tekanan sangat rendah (${effectiveTekanan} bar)`; }
      else if (effectiveTekanan < 1.0) { status = "warning"; cause = `Tekanan mulai turun (${effectiveTekanan} bar)`; }
    }
    if (effectiveTinggi != null) {
      if (effectiveTinggi < 50) { status = "critical"; cause = `Tinggi air kritis (${effectiveTinggi} cm)`; }
      else if (effectiveTinggi < 100) {
        if (status !== "critical") { status = "warning"; cause = `Tinggi air rendah (${effectiveTinggi} cm)`; }
      }
    }

    // Anomali penurunan
    if (d?.pagi?.tinggiAir != null && d?.sore?.tinggiAir != null) {
      const drop = d.pagi.tinggiAir - d.sore.tinggiAir;
      if (drop > 100 && status !== "critical") {
        status = "warning";
        cause = `Penurunan ${drop.toFixed(0)} cm dalam setengah hari`;
      }
    }

    const predDays = status === "warning" ? "~3-5 hari" : status === "critical" ? "Sudah kritis!" : "> 7 hari";

    return {
      point: pt,
      status,
      cause,
      since: "Hari ini",
      prediksiKritis: predDays,
      tinggiAir: effectiveTinggi,
      tekanan: effectiveTekanan,
    };
  }).sort((a, b) => {
    const order = { critical: 0, warning: 1, empty: 2, normal: 3 };
    return order[a.status] - order[b.status];
  });
}

function getFallbackAdvice(selectedPointId: string, pointStatuses: PointStatus[], chartRaw: any[], tReg: ReturnType<typeof linearRegression>, pReg: ReturnType<typeof linearRegression>): string {
  const lastTinggi = chartRaw[chartRaw.length - 1]?.tinggiAir;
  const lastTekanan = chartRaw[chartRaw.length - 1]?.tekanan;

  if (selectedPointId === "all") {
    let msg = "";
    if (tReg.slope < -5) msg += "⚠️ Rata-rata tinggi air se-PDAM menurun drastis. Pantau produksi sumur air tanah. ";
    if (pReg.slope < -0.1) msg += "⚠️ Rata-rata tekanan perpipaan perlahan turun. Waspadai kebocoran pada pipa primer. ";
    return msg || "✓ Secara keseluruhan, suplai tinggi air dan tekanan pada jaringan distribusi terpantau stabil.";
  }

  const pointStatus = pointStatuses.find((p) => p.point.id === selectedPointId);
  if (!pointStatus) return "Pilih titik untuk memuat saran sistem.";
  const name = pointStatus.point.name;

  if (lastTinggi == null && lastTekanan == null) {
    return `ℹ️ Belum ada input data (pagi/sore) di ${name} untuk hari ini. Silakan instruksikan petugas lapangan.`;
  }

  if (name.toLowerCase().includes("reservoir") || name.toLowerCase().includes("bpt")) {
    if (lastTinggi !== undefined && lastTinggi !== null) {
      if (lastTinggi < 50 && tReg.slope < 0) return `🚨 TINGGI AIR DROP di ${name} (${lastTinggi} cm) dengan profil tren merosot! Segera periksa sumber suplai.`;
      if (lastTinggi < 100) return `⚠️ Tinggi air di ${name} tergolong rendah (${lastTinggi} cm). Tekan angka distribusi keluar.`;
      if (lastTinggi > 350) return `🛑 ${name} membahayakan nyaris meluap (${lastTinggi} cm). Kurangi pompa inlet.`;
      if (tReg.slope < -8) return `⚠️ Kehilangan debit tak wajar terdeteksi. Air surut dengan kecepatan ${tReg.slope.toFixed(1)} cm/hari.`;
    }
    return `✓ Profil operasional di ${name} sejauh ini cukup stabil.`;
  }

  if (lastTekanan !== undefined && lastTekanan !== null) {
    if (lastTekanan < 0.5 && pReg.slope <= 0) return `🚨 TEKANAN KRITIS di batas ${name} (${lastTekanan} bar). Dugaan terkuat adalah PIPA TRANSMISI UTAMA PECAH.`;
    if (lastTekanan < 1.0) return `⚠️ Waspada keluhan pelanggan di sekitar ${name}. Tekanan mulai redup.`;
    if (pReg.slope < -0.2) return `⚠️ Titik ini mengalami penyusutan tekanan kronis. Potensi pencurian air atau pengerakan dimensi pipa sisi hulu.`;
  }

  return `✓ Kondisi hidro-statis lapangan di area ${name} diklasifikasikan sangat optimal.`;
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
async function exportPDF(statuses: PointStatus[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) { alert("Popup blocker terdeteksi. Izinkan popup untuk export."); return; }

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const normalCount  = statuses.filter(s => s.status === "normal").length;
  const warningCount = statuses.filter(s => s.status === "warning").length;
  const criticalCount = statuses.filter(s => s.status === "critical").length;
  const emptyCount   = statuses.filter(s => s.status === "empty").length;

  const statusLabel = (s: PointStatus["status"]) =>
    s === "normal" ? "Normal" : s === "warning" ? "Waspada" : s === "critical" ? "Kritis" : "Belum Input";

  const rowsHtml = statuses.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f8f9fa"};">
      <td style="text-align:center;">${i + 1}</td>
      <td><strong>${r.point.name}</strong><br/><span style="color:#6b7280;font-size:9pt;">${r.point.id}</span></td>
      <td style="color:${
        r.status === "normal" ? "#15803d" :
        r.status === "warning" ? "#b45309" :
        r.status === "critical" ? "#dc2626" : "#6b7280"
      };font-weight:600;">${statusLabel(r.status)}</td>
      <td>${r.tinggiAir != null ? r.tinggiAir + " cm" : "—"} / ${r.tekanan != null ? r.tekanan.toFixed(1) + " bar" : "—"}</td>
      <td>${r.cause}</td>
      <td>${r.prediksiKritis}</td>
    </tr>
  `).join("");

  printWindow.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
    <title>Laporan Harian PDAM TIARA — ${dateStr}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 28px 32px; color: #111827; font-size: 10pt; }
      /* Header */
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
      .header-table td { padding: 4px 0; vertical-align: top; }
      .header-table td:last-child { text-align: right; }
      .title { font-size: 14pt; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
      .subtitle { font-size: 9pt; color: #6b7280; margin-top: 2px; }
      .divider { border: none; border-top: 2px solid #111827; margin: 10px 0 14px; }
      /* Summary row */
      .summary { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
      .summary td { padding: 6px 12px; border: 1px solid #d1d5db; font-size: 10pt; text-align: center; }
      .summary td:first-child { text-align: left; font-weight: 600; }
      /* Main table */
      .section-title { font-size: 10pt; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.05em; color: #374151; margin-bottom: 6px; margin-top: 20px; }
      table.data { width: 100%; border-collapse: collapse; }
      table.data th {
        background: #f3f4f6; text-align: left; padding: 6px 8px;
        font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        border: 1px solid #d1d5db;
      }
      table.data td { padding: 6px 8px; border: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
      .footer { margin-top: 24px; border-top: 1px solid #d1d5db; padding-top: 8px;
        text-align: center; color: #9ca3af; font-size: 8pt; }
      .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; margin: 12px 0; font-size: 9pt; color: #991b1b; }
      @media print { body { padding: 12px 18px; } }
    </style>
  </head><body>
    <table class="header-table"><tr>
      <td>
        <div class="title">Laporan Harian Distribusi Air</div>
        <div class="subtitle">PDAM TIARA &mdash; Sistem Monitoring SPAM Aiq Bone</div>
      </td>
      <td>
        <div style="font-weight:600;">${dateStr}</div>
        <div style="color:#6b7280;font-size:9pt;">Dicetak pukul ${timeStr}</div>
      </td>
    </tr></table>
    <hr class="divider"/>

    <table class="summary"><tr>
      <td>Ringkasan Status</td>
      <td>Normal: <span style="color:#15803d;font-weight:700;">${normalCount}</span></td>
      <td>Waspada: <span style="color:#b45309;font-weight:700;">${warningCount}</span></td>
      <td>Kritis: <span style="color:#dc2626;font-weight:700;">${criticalCount}</span></td>
      <td>Belum Input: <span style="color:#6b7280;font-weight:700;">${emptyCount}</span></td>
      <td>Total: <span style="font-weight:700;">${statuses.length}</span></td>
    </tr></table>

    <div class="section-title">Data Seluruh Titik Monitoring</div>
    <table class="data">
      <thead><tr>
        <th style="width:30px;text-align:center;">No</th>
        <th>Nama Titik</th>
        <th style="width:70px;">Status</th>
        <th style="width:120px;">Tinggi / Tekanan</th>
        <th>Detail Kondisi</th>
        <th style="width:80px;">Prediksi</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    ${/* PDF Section: Kondisi Tekanan Jaringan */(() => {
      const manRows = MANOMETERS.map((m, i) => {
        const jalur = JALUR_PIPA.find(j => j.manometerIds.includes(m.id));
        const res = jalur ? getReservoir(jalur.reservoirId) : null;
        const dop = jalur ? getDopend(jalur.dopendId) : null;
        const statusColor = m.status === 'normal' ? '#15803d' : m.status === 'waspada' ? '#b45309' : m.status === 'kritis' ? '#dc2626' : '#6b7280';
        const statusLabel = m.status === 'normal' ? 'Normal' : m.status === 'waspada' ? 'Waspada' : m.status === 'kritis' ? 'Kritis' : 'Belum Input';
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
          <td style="text-align:center;">${i+1}</td>
          <td><strong>${m.name}</strong></td>
          <td>${res?.name ?? '-'} → ${dop?.name ?? '-'}</td>
          <td style="text-align:center;">${m.tekanan !== null ? m.tekanan + ' bar' : '—'}</td>
          <td style="text-align:center;">${m.tekanan !== null ? m.tekanan + ' bar' : '—'}</td>
          <td style="color:${statusColor};font-weight:600;">${statusLabel}</td>
        </tr>`;
      }).join('');
      return `<div class="section-title">Kondisi Tekanan Jaringan</div>
      <table class="data">
        <thead><tr>
          <th style="width:30px;text-align:center;">No</th>
          <th>Nama Manometer</th>
          <th>Jalur (Reservoir → Dopend)</th>
          <th style="width:80px;text-align:center;">Tekanan Pagi</th>
          <th style="width:80px;text-align:center;">Tekanan Sore</th>
          <th style="width:70px;">Status</th>
        </tr></thead>
        <tbody>${manRows}</tbody>
      </table>`;
    })()}

    ${/* PDF Section: Wilayah Berpotensi Terdampak */(() => {
      const problematic = getProblematicManometers();
      if (problematic.length === 0) return '';
      const affectedRows = problematic.map((m, i) => {
        const area = getAffectedArea(m.id);
        const statusLabel = m.status === 'waspada' ? 'Waspada' : 'Kritis';
        const statusColor = m.status === 'kritis' ? '#dc2626' : '#b45309';
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
          <td style="text-align:center;">${i+1}</td>
          <td><strong>${m.name}</strong></td>
          <td style="color:${statusColor};font-weight:600;">${m.tekanan !== null ? m.tekanan + ' bar' : '—'}</td>
          <td style="color:${statusColor};font-weight:600;">${statusLabel}</td>
          <td>${area ?? '-'}</td>
        </tr>`;
      }).join('');
      return `<div class="section-title" style="color:#dc2626;">⚠ Wilayah Berpotensi Terdampak</div>
      <div class="alert-box">Ditemukan ${problematic.length} manometer dengan status waspada/kritis yang berpotensi memengaruhi distribusi air ke wilayah hilir.</div>
      <table class="data">
        <thead><tr>
          <th style="width:30px;text-align:center;">No</th>
          <th>Manometer</th>
          <th style="width:80px;">Tekanan</th>
          <th style="width:70px;">Status</th>
          <th>Wilayah Terdampak</th>
        </tr></thead>
        <tbody>${affectedRows}</tbody>
      </table>`;
    })()}

    <div class="footer">
      Dokumen ini dicetak otomatis oleh Tiara Manajemen Distribusi &bull; ${dateStr} &bull; ${timeStr}
    </div>
    <script>setTimeout(() => { window.print(); }, 400);</script>
  </body></html>`);
  printWindow.document.close();
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function DireksiDashboard() {
  const [, navigate] = useLocation();
  const { data: rawMonitoringData } = useGetMonitoringData();
  const { data: dbPoints } = useListMonitoringPoints();
  const [darkMode, setDarkMode] = useState(false);

  // Gunakan titik dari DB; jika kosong fallback ke MONITORING_POINTS hardcoded
  const activePoints: MonitoringPoint[] = useMemo(() => {
    if (dbPoints && dbPoints.length > 0)
      return dbPoints.map(p => ({ id: p.pointId, name: p.name, lat: p.lat, lng: p.lng }));
    return MONITORING_POINTS;
  }, [dbPoints]);

  // Style untuk animasi cahaya garis prediksi (bolak-balik)
  const animStyle = `
    @keyframes dash-beam {
      0% { stroke-dashoffset: 60; }
      100% { stroke-dashoffset: 0; }
    }
    .animated-prediction-line path.recharts-curve {
      animation: dash-beam 2s linear infinite alternate !important;
    }
  `;

  const monitoringData = useMemo(() => {
    const todayDateStr = new Date().toISOString().split("T")[0];
    const result: Record<string, MonitoringData> = {};
    if (rawMonitoringData) {
      rawMonitoringData.forEach((row) => {
        const rowDateStr = new Date(row.date).toISOString().split("T")[0];
        if (rowDateStr === todayDateStr) {
          if (!result[row.pointId]) result[row.pointId] = {};
          (result[row.pointId] as any)[row.session] = {
            tinggiAir: row.tinggiAir ?? undefined,
            tekanan: row.tekanan ?? undefined,
          };
        }
      });
    }
    return result;
  }, [rawMonitoringData]);

  const [selectedPointId, setSelectedPointId] = useState<string>("all");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("daily");

  const chartRaw = useMemo(() => generateChartData(monitoringData, selectedPointId, chartPeriod), [monitoringData, selectedPointId, chartPeriod]);
  // AI state — hanya dieksekusi ketika tombol ditekan
  const [aiPredictions, setAiPredictions] = useState<{ predTinggi: number; predTekanan: number }[] | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  const { data: chartData, tReg, pReg } = useMemo(() => addPredictions(chartRaw, chartPeriod, aiPredictions), [chartRaw, chartPeriod, aiPredictions]);
  const statuses = useMemo(() => getPointStatuses(monitoringData, activePoints), [monitoringData, activePoints]);

  const normalCount = statuses.filter((s) => s.status === "normal").length;
  const warningCount = statuses.filter((s) => s.status === "warning").length;
  const criticalCount = statuses.filter((s) => s.status === "critical").length;

  // Default: tampilkan analisa template (tanpa token)
  const fallbackAdvice = useMemo(() => getFallbackAdvice(selectedPointId, statuses, chartRaw, tReg, pReg), [selectedPointId, statuses, chartRaw, tReg, pReg]);
  const [adviceText, setAdviceText] = useState<string | null>(null);

  // Reset AI state ketika user ganti titik/periode
  useEffect(() => {
    setAdviceText(null);
    setAiPredictions(null);
  }, [selectedPointId, chartPeriod]);

  // Fungsi panggil AI — HANYA dipanggil saat tombol ditekan
  const requestAIAnalysis = useCallback(() => {
    if (!chartRaw || chartRaw.length === 0) return;
    setIsAILoading(true);
    setAdviceText(null);

    const pointName = selectedPointId === "all" ? "Seluruh Jaringan PDAM" : activePoints.find(p => p.id === selectedPointId)?.name;
    const periodLabel = chartPeriod === "daily" ? "7 hari terakhir" : chartPeriod === "weekly" ? "4 minggu terakhir" : "6 bulan terakhir";
    const currentPointStatus = selectedPointId === "all" ? "agregat" : statuses.find(s => s.point.id === selectedPointId)?.status || "normal";
    const predCount = PRED_LABELS[chartPeriod].length;

    fetch("/api/ai-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chartRaw, pointName, period: periodLabel, status: currentPointStatus, predCount })
    })
    .then(async (r) => {
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    })
    .then(data => {
      if (data && data.advice) {
        setAdviceText(data.advice);
      }
      if (data && data.predictions && Array.isArray(data.predictions)) {
        setAiPredictions(data.predictions);
      }
    })
    .catch(err => {
      console.error(err);
      let errorMsg = err.message;
      if (errorMsg.includes("429") || errorMsg.includes("Quota") || errorMsg.includes("Rate limit")) {
        errorMsg = "Batas penggunaan Groq AI (Rate Limit) sedang penuh. Mohon tunggu sekitar 1 menit.";
      } else if (errorMsg.includes("403") || errorMsg.includes("API key") || errorMsg.includes("401")) {
        errorMsg = "API Key Groq tidak valid atau belum diatur.";
      }
      setAdviceText(`[Warning: ${errorMsg}]`);
    })
    .finally(() => setIsAILoading(false));
  }, [chartRaw, selectedPointId, chartPeriod, activePoints, statuses]);

  const displayAdvice = adviceText ?? fallbackAdvice;
  const cleanAdvice = displayAdvice.replace(/^[\u2713\u26a0\ufe0f\ud83d\udea8\ud83d\uded1\u2139\ufe0f\ud83d\udca1]\s?/u, "");
  const isAIPowered = adviceText !== null;

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const avgTekanan = useMemo(() => {
    const vals = statuses.filter(s => s.tekanan != null).map(s => s.tekanan!);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [statuses]);

  const pctAman = statuses.length > 0 ? Math.round((normalCount / statuses.length) * 100) : 0;

  const issueCategories = useMemo(() => {
    const issues: { label: string; count: number; color: string }[] = [];
    let lowPressure = 0, lowWater = 0, noInput = 0;
    statuses.forEach(s => {
      if (s.cause.includes("Tekanan")) lowPressure++;
      else if (s.cause.includes("Tinggi air") || s.cause.includes("Penurunan")) lowWater++;
      else if (s.status === "empty") noInput++;
    });
    if (lowPressure > 0) issues.push({ label: "Tekanan Rendah", count: lowPressure, color: "#ef4444" });
    if (lowWater > 0) issues.push({ label: "Level Air Rendah", count: lowWater, color: "#f59e0b" });
    if (noInput > 0) issues.push({ label: "Belum Input", count: noInput, color: "#94a3b8" });
    if (issues.length === 0) issues.push({ label: "Semua Normal", count: statuses.length, color: "#22c55e" });
    return issues;
  }, [statuses]);
  const totalIssues = issueCategories.reduce((a, b) => a + b.count, 0);

  const reservoirUtama = statuses.find(s => s.point.id === "MON-01");

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }} className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-gray-950 text-gray-100" : "bg-[#fafbfc] text-gray-900"}`}>
      <style>{animStyle}</style>
      {/* Top Nav */}
      <header className={`border-b sticky top-0 z-50 transition-colors duration-300 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-between px-4 sm:px-8 h-14">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate("/")} className={`flex items-center gap-2 text-sm transition-colors ${darkMode ? "text-gray-400 hover:text-gray-100" : "text-gray-500 hover:text-gray-900"}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Kembali</span>
            </button>
            <div className={`h-5 w-px hidden sm:block ${darkMode ? "bg-gray-700" : "bg-gray-200"}`} />
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="PDAM TIARA Logo" className="h-8 w-auto object-contain" />
              <span className={`font-semibold text-sm tracking-tight hidden sm:block ${darkMode ? "text-gray-100" : "text-gray-900"}`}>PDAM TIARA</span>
            </div>
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {["Dashboard", "Peta", "Laporan"].map((item, i) => (
                <span key={item} className={`px-3 py-1.5 text-sm rounded-md cursor-default ${
                  i === 0
                    ? darkMode ? "font-semibold text-gray-100 bg-gray-800" : "font-semibold text-gray-900 bg-gray-100"
                    : darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                }`}>{item}</span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className={`hidden lg:flex items-center gap-2 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              <Clock className="h-3.5 w-3.5" />
              <span>Last update: {timeStr}</span>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${
                darkMode
                  ? "border-gray-700 bg-gray-800 text-yellow-400 hover:bg-gray-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              title={darkMode ? "Mode Terang" : "Mode Gelap"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => exportPDF(statuses)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors active:scale-[0.98] ${
              darkMode ? "bg-gray-100 text-gray-900 hover:bg-white" : "bg-gray-900 text-white hover:bg-gray-800"
            }`}>
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export Laporan</span>
            </button>
            <a href="/input" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              darkMode ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
            }`}>
              <ClipboardEdit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Input Data</span>
            </a>
          </div>
        </div>
      </header>

      <div className={`border-b px-4 sm:px-8 py-2.5 flex items-center gap-4 text-xs transition-colors ${darkMode ? "bg-gray-900 border-gray-800 text-gray-500" : "bg-white border-gray-100 text-gray-400"}`}>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Sistem Aktif</span>
        <span>{dateStr}</span>
      </div>

      {/* Critical Manometer Alert Banner */}
      {(() => {
        const criticalMans = getCriticalManometers();
        if (criticalMans.length === 0) return null;
        return (
          <div className={`px-4 sm:px-8 py-3 border-b ${
            darkMode ? "bg-red-950/50 border-red-900" : "bg-red-50 border-red-100"
          }`}>
            <div className="max-w-[1440px] mx-auto flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${darkMode ? "text-red-400" : "text-red-600"}`} />
              <div className="flex-1">
                <p className={`text-sm font-bold ${darkMode ? "text-red-300" : "text-red-800"}`}>
                  ⚠ {criticalMans.length} Manometer Kritis Terdeteksi!
                </p>
                <div className="mt-1 space-y-0.5">
                  {criticalMans.map(m => {
                    const area = getAffectedArea(m.id);
                    return (
                      <p key={m.id} className={`text-xs ${darkMode ? "text-red-400" : "text-red-700"}`}>
                        <span className="font-semibold">{m.name}</span> — Tekanan {m.tekanan} bar
                        {area && <span> → Wilayah terdampak: <strong>{area}</strong></span>}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Content */}
      <div className="px-4 sm:px-8 py-6 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          {/* LEFT COL */}
          <div className="space-y-6">

            {/* ── Jaringan Distribusi Section ───────────────────────── */}
            <div className={`rounded-[24px] border p-6 transition-colors shadow-sm relative overflow-hidden ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
              {/* Subtle background glow */}
              {!darkMode && <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-[80px] pointer-events-none" />}
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-inner ${darkMode ? "bg-blue-900/40 text-blue-400" : "bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border border-blue-100"}`}>
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight">Jaringan Distribusi</h3>
                    <p className={`text-[11px] font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Pemantauan Tekanan & Tinggi Air</p>
                  </div>
                </div>
              </div>

              {/* Reservoir cards in a grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 relative z-10">
                {RESERVOIRS.map(r => {
                  const jalurs = getJalurForReservoir(r.id);
                  const allMans = jalurs.flatMap(j => getManometersForJalur(j.id));
                  const kritisCount = allMans.filter(m => m.status === "kritis").length;
                  const waspadaCount = allMans.filter(m => m.status === "waspada").length;
                  const statusColor = r.status === "normal" ? (darkMode ? "#4ade80" : "#16a34a") : r.status === "waspada" ? "#f59e0b" : "#ef4444";
                  const statusBg = r.status === "normal" ? (darkMode ? "rgba(74,222,128,0.1)" : "#f0fdf4") : r.status === "waspada" ? (darkMode ? "rgba(245,158,11,0.1)" : "#fffbeb") : (darkMode ? "rgba(239,68,68,0.1)" : "#fef2f2");
                  const pct = Math.round((r.tinggiAir / r.kapasitas) * 100);

                  return (
                    <div key={r.id} className={`relative rounded-[20px] border p-5 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${darkMode ? "bg-gray-800/80 border-gray-700 hover:border-gray-600" : "bg-white border-gray-100 hover:border-indigo-100"}`}>
                      <div className="absolute right-0 top-0 w-24 h-24 rounded-tr-[20px] rounded-bl-full pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${statusBg}, transparent 70%)` }} />
                      
                      <div className="flex items-center gap-2.5 mb-3 relative z-10">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm" style={{ background: statusBg }}>
                          <Droplets className="h-4 w-4" style={{ color: statusColor }} />
                        </div>
                        <span className="text-sm font-bold truncate">{r.name}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-3 relative z-10">
                        <span className="text-3xl font-black tracking-tight" style={{ color: statusColor }}>{r.tinggiAir}</span>
                        <span className={`text-[11px] font-semibold ${darkMode ? "text-gray-500" : "text-gray-400"}`}>cm / {r.kapasitas}</span>
                      </div>
                      {/* Progress bar */}
                      <div className={`h-2 w-full rounded-full mb-3 shadow-inner ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
                        <div className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden" style={{ width: `${Math.min(100, pct)}%`, background: statusColor }}>
                          <div className="absolute inset-0 bg-white/20" />
                        </div>
                      </div>
                      {/* Manometer summary */}
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className={darkMode ? "text-gray-500" : "text-gray-400"}>{allMans.length} manometer</span>
                        {kritisCount > 0 && <span className="text-red-500 font-bold">{kritisCount} kritis</span>}
                        {waspadaCount > 0 && <span className="text-amber-500 font-bold">{waspadaCount} waspada</span>}
                        {kritisCount === 0 && waspadaCount === 0 && <span className="text-emerald-500 font-semibold">✓ semua normal</span>}
                      </div>
                      {/* Dopend targets */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {jalurs.map(j => {
                          const dop = getDopend(j.dopendId);
                          return dop ? (
                            <span key={j.id} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                              → {dop.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Manometer detail table */}
              <div className={`rounded-[16px] border overflow-hidden shadow-sm relative z-10 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className={darkMode ? "bg-gray-800 border-b border-gray-700" : "bg-slate-50 border-b border-gray-200/80"}>
                      <th className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Manometer</th>
                      <th className={`px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Jalur</th>
                      <th className={`text-center px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Tekanan</th>
                      <th className={`text-center px-4 py-3 font-bold uppercase tracking-wider text-[10px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MANOMETERS.map((m, i) => {
                      const jalur = JALUR_PIPA.find(j => j.manometerIds.includes(m.id));
                      const res = jalur ? getReservoir(jalur.reservoirId) : null;
                      const dop = jalur ? getDopend(jalur.dopendId) : null;
                      const color = STATUS_COLORS[m.status];
                      return (
                        <tr key={m.id} className={`border-b last:border-0 ${
                          darkMode ? "border-gray-700/50 hover:bg-gray-800/80" : "border-gray-100 hover:bg-gray-50/80"
                        } transition-colors`}>
                          <td className="px-4 py-3 font-semibold">{m.name}</td>
                          <td className={`px-4 py-3 font-medium ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                            <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] mr-1">{res?.name?.replace("Reservoir ", "")}</span> 
                            → 
                            <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[10px] ml-1">{dop?.name?.replace("Dopend ", "")}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-extrabold text-sm" style={{ color }}>{m.tekanan !== null ? m.tekanan : "—"}</span>
                            {m.tekanan !== null && <span className="text-[10px] ml-1 opacity-70" style={{ color }}>bar</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm" style={{
                              color,
                              background: m.status === "normal" ? (darkMode ? "rgba(34,197,94,0.15)" : "#f0fdf4")
                                : m.status === "waspada" ? (darkMode ? "rgba(245,158,11,0.15)" : "#fffbeb")
                                : m.status === "kritis" ? (darkMode ? "rgba(239,68,68,0.15)" : "#fef2f2")
                                : (darkMode ? "rgba(156,163,175,0.15)" : "#f8fafc"),
                            }}>
                              {STATUS_LABELS[m.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Efisiensi Distribusi</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold tracking-tight ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{pctAman}%</p>
                    <p className="text-xs text-gray-400 mt-1">{normalCount}/{statuses.length} titik aman</p>
                  </div>
                  <div className="flex items-end gap-[2px] h-10">
                    {chartRaw.map((d: any, i: number) => {
                      const h = Math.max(4, ((d.tinggiAir ?? 0) / 400) * 36);
                      return <div key={i} className="flex-1 max-w-[8px] rounded-sm bg-green-400" style={{ height: h }} />;
                    })}
                  </div>
                </div>
              </div>
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Rata-Rata Tekanan</p>
                <div className="flex items-end justify-between">
                  <p className={`text-3xl font-bold tracking-tight ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{avgTekanan.toFixed(1)} <span className="text-lg font-medium text-gray-400">bar</span></p>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${avgTekanan >= 2 ? "bg-green-50 text-green-700" : avgTekanan >= 0.5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                    {avgTekanan >= 2 ? "Stabil" : avgTekanan >= 0.5 ? "Waspada" : "Kritis"}
                  </span>
                </div>
                <div className="flex gap-[2px] mt-3">
                  {chartRaw.map((d: any, i: number) => {
                    const v = d.tekanan ?? 0;
                    const color = v >= 2 ? "#22c55e" : v >= 0.5 ? "#f59e0b" : "#ef4444";
                    return <div key={i} className="flex-1 h-1.5 rounded-sm" style={{ background: color, opacity: 0.4 + (v / 8) * 0.6 }} />;
                  })}
                </div>
              </div>
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Titik Monitoring</p>
                <p className={`text-3xl font-bold tracking-tight ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{statuses.length}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-gray-500">{normalCount}</span></span>
                  <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-gray-500">{warningCount}</span></span>
                  <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-gray-500">{criticalCount}</span></span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className={`rounded-xl border transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
              <div className={`flex flex-wrap gap-4 items-center justify-between px-6 py-4 border-b ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
                <h2 className={`text-sm font-semibold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>Tinggi Air & Tekanan</h2>
                <div className="flex items-center gap-3">
                  <div className={`flex rounded-lg p-1 ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                    {(["daily", "weekly", "monthly"] as ChartPeriod[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setChartPeriod(p)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                          chartPeriod === p
                            ? (darkMode ? "bg-gray-700 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm")
                            : (darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                        }`}
                      >
                        {p === "daily" ? "Harian" : p === "weekly" ? "Mingguan" : "Bulanan"}
                      </button>
                    ))}
                  </div>
                  <select className={`text-xs border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer ${darkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-600"}`} value={selectedPointId} onChange={(e) => setSelectedPointId(e.target.value)}>
                    <option value="all">Semua Titik</option>
                    {activePoints.map((pt) => (<option key={pt.id} value={pt.id}>{pt.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <div className="h-[280px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1f2937" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: darkMode ? "#6b7280" : "#9ca3af" }} axisLine={{ stroke: darkMode ? "#374151" : "#e5e7eb" }} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} label={{ value: "Tinggi Air, cm", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }, offset: 20 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} label={{ value: "Tekanan, bar", angle: 90, position: "insideRight", style: { fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }, offset: 20 }} />
                      <RechartsTooltip labelFormatter={(lbl, pl) => pl[0]?.payload?.sublabel ? `${lbl} (${pl[0].payload.sublabel})` : lbl} contentStyle={{ borderRadius: 10, fontSize: 12, border: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`, background: darkMode ? "#1f2937" : "#fff", color: darkMode ? "#f3f4f6" : "#111", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "10px 14px" }} formatter={(val: any, name: string) => [val == null ? "-" : typeof val === "number" ? val.toFixed(2) : val, name]} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12, color: darkMode ? "#9ca3af" : undefined }} iconType="circle" iconSize={8} />
                      <Line yAxisId="left" type="monotone" dataKey="tinggiAir" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }} name="Tinggi Air (cm)" connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="tekanan" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} name="Tekanan (bar)" connectNulls />
                      <Line className="animated-prediction-line" yAxisId="left" type="monotone" dataKey="predTinggi" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 6" dot={{ r: 2.5, fill: "#bbf7d0", stroke: "#22c55e", strokeWidth: 1 }} name="Prediksi T.Air" connectNulls />
                      <Line className="animated-prediction-line" yAxisId="right" type="monotone" dataKey="predTekanan" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 6" dot={{ r: 2.5, fill: "#fecaca", stroke: "#ef4444", strokeWidth: 1 }} name="Prediksi Tekanan" connectNulls />
                      <ReferenceLine yAxisId="left" y={50} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                      <ReferenceLine yAxisId="right" y={0.5} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="px-6 pb-5 space-y-3">
                {/* AI Analysis Card */}
                <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                  isAIPowered
                    ? darkMode ? "bg-gray-800/80 border-gray-700" : "bg-gray-900 border-gray-800"
                    : darkMode ? "bg-gray-800/50 border-gray-700/50" : "bg-gray-50 border-gray-200"
                }`}>
                  {/* Subtle top accent line */}
                  <div className={`h-[2px] w-full ${
                    isAIPowered
                      ? cleanAdvice.toLowerCase().includes("kritis") || cleanAdvice.includes("DARURAT") || cleanAdvice.includes("DROP")
                        ? "bg-gradient-to-r from-red-500 via-red-400 to-red-500"
                        : cleanAdvice.toLowerCase().includes("waspada") || cleanAdvice.toLowerCase().includes("warning")
                          ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
                          : "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500"
                      : darkMode ? "bg-gray-700" : "bg-gray-200"
                  }`} />
                  <div className="px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      {/* Icon: Robot AI SVG (animated) when AI powered, TrendingUp otherwise */}
                      {isAILoading ? (
                        <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5 ${isAIPowered ? "bg-white/10" : darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                          <Loader2 className={`h-4 w-4 animate-spin ${isAIPowered ? "text-white" : darkMode ? "text-gray-400" : "text-gray-500"}`} />
                        </div>
                      ) : isAIPowered ? (
                        <div className="shrink-0 mt-0.5">
                          <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <style>{`
                              @keyframes aiBlink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
                              @keyframes aiPulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.1)} }
                              @keyframes aiAntenna { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
                              .ai-eye-l{animation:aiBlink 4s infinite;transform-origin:center}
                              .ai-eye-r{animation:aiBlink 4s infinite 0.1s;transform-origin:center}
                              .ai-pulse{animation:aiPulse 2s infinite}
                              .ai-antenna{animation:aiAntenna 2s infinite ease-in-out;transform-origin:bottom center}
                            `}</style>
                            <g className="ai-antenna">
                              <line x1="32" y1="4" x2="32" y2="12" stroke={darkMode ? "#60a5fa" : "#3b82f6"} strokeWidth="2" strokeLinecap="round"/>
                              <circle cx="32" cy="3" r="3" fill={darkMode ? "#60a5fa" : "#3b82f6"}>
                                <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
                              </circle>
                            </g>
                            <rect x="12" y="12" width="40" height="28" rx="8" fill={darkMode ? "#1e3a5f" : "#dbeafe"} stroke={darkMode ? "#60a5fa" : "#3b82f6"} strokeWidth="1.5"/>
                            <g className="ai-eye-l">
                              <circle cx="23" cy="24" r="6" fill={darkMode ? "#0c4a6e" : "#bfdbfe"}/>
                              <circle cx="23" cy="24" r="4" fill={darkMode ? "#60a5fa" : "#3b82f6"} opacity="0.9"/>
                              <circle cx="25" cy="22" r="1.5" fill="white" opacity="0.8"/>
                            </g>
                            <g className="ai-eye-r">
                              <circle cx="41" cy="24" r="6" fill={darkMode ? "#0c4a6e" : "#bfdbfe"}/>
                              <circle cx="41" cy="24" r="4" fill={darkMode ? "#60a5fa" : "#3b82f6"} opacity="0.9"/>
                              <circle cx="43" cy="22" r="1.5" fill="white" opacity="0.8"/>
                            </g>
                            <rect x="20" y="33" width="24" height="4" rx="2" fill={darkMode ? "#0c4a6e" : "#bfdbfe"}/>
                            <rect x="22" y="34" width="4" height="2" rx="1" fill={darkMode ? "#60a5fa" : "#3b82f6"}/>
                            <rect x="28" y="34" width="4" height="2" rx="1" fill={darkMode ? "#60a5fa" : "#3b82f6"}/>
                            <rect x="34" y="34" width="4" height="2" rx="1" fill={darkMode ? "#60a5fa" : "#3b82f6"}/>
                            <rect x="40" y="34" width="2" height="2" rx="1" fill={darkMode ? "#60a5fa" : "#3b82f6"}/>
                            <rect x="16" y="42" width="32" height="18" rx="6" fill={darkMode ? "#1e3a5f" : "#dbeafe"} stroke={darkMode ? "#60a5fa" : "#3b82f6"} strokeWidth="1.5"/>
                            <text x="32" y="55" textAnchor="middle" fill={darkMode ? "#60a5fa" : "#3b82f6"} fontSize="9" fontWeight="bold" fontFamily="monospace">AI</text>
                            <rect x="8" y="18" width="5" height="10" rx="2" fill={darkMode ? "#1e3a5f" : "#dbeafe"} stroke={darkMode ? "#60a5fa" : "#3b82f6"} strokeWidth="1.5"/>
                            <rect x="51" y="18" width="5" height="10" rx="2" fill={darkMode ? "#1e3a5f" : "#dbeafe"} stroke={darkMode ? "#60a5fa" : "#3b82f6"} strokeWidth="1.5"/>
                            <circle className="ai-pulse" cx="32" cy="3" r="6" stroke={darkMode ? "#60a5fa" : "#3b82f6"} strokeWidth="1" fill="none"/>
                          </svg>
                        </div>
                      ) : (
                        <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5 ${darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                          <TrendingUp className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-center gap-2 mb-1 ${isAIPowered ? "text-white/60" : darkMode ? "text-gray-500" : "text-gray-400"}`}>
                          <span className="text-[10px] font-bold uppercase tracking-widest">{isAIPowered ? "Groq AI · Llama 4 Scout" : "Analisis Sistem"}</span>
                          {isAIPowered && <span className="flex items-center gap-1 text-[10px] bg-white/10 text-blue-400 px-1.5 py-0.5 rounded-full font-medium"><span className="h-1 w-1 rounded-full bg-blue-400" />AI</span>}
                        </div>
                        <p className={`text-[13px] leading-relaxed ${
                          isAIPowered ? "text-white/90" : darkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          {isAILoading ? "Sedang menganalisis data dan menghitung prediksi..." : cleanAdvice}
                        </p>
                        {/* Keterangan metode prediksi */}
                        {!isAIPowered && !isAILoading && (
                          <p className={`text-[11px] mt-2 italic ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                            Prediksi grafik menggunakan metode <span className="font-semibold not-italic">Regresi Linear</span> (y = mx + b)
                          </p>
                        )}
                        {isAIPowered && !isAILoading && (
                          <p className={`text-[11px] mt-2 italic text-white/40`}>
                            Prediksi grafik dihitung oleh <span className="font-semibold not-italic">AI Llama 4 Scout 17B</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Trigger Button */}
                <button
                  onClick={requestAIAnalysis}
                  disabled={isAILoading || !chartRaw || chartRaw.length === 0}
                  className={`group w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed border ${
                    darkMode
                      ? "bg-white text-gray-900 border-white/20 hover:bg-gray-100 shadow-lg shadow-white/5"
                      : "bg-gray-900 text-white border-gray-800 hover:bg-gray-800 shadow-lg shadow-gray-900/20"
                  }`}
                >
                  {isAILoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Sparkles className={`h-4 w-4 transition-transform group-hover:scale-110 ${darkMode ? "text-gray-600" : "text-gray-400"}`} />
                  }
                  {isAILoading ? "Menganalisis & Memprediksi..." : (isAIPowered ? "Minta AI Analisis & Prediksi Ulang" : "Minta AI Analisis & Prediksi")}
                </button>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <h3 className={`text-sm font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-900"}`}>Kategori Masalah</h3>
                <div className="flex w-full h-3 rounded-full overflow-hidden mb-4 bg-gray-100">
                  {issueCategories.map((cat, i) => (<div key={i} style={{ width: `${(cat.count / totalIssues) * 100}%`, background: cat.color }} className="transition-all" />))}
                </div>
                <div className="space-y-2.5">
                  {issueCategories.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: cat.color }} /><span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{cat.label}</span></div>
                      <div className="flex items-center gap-3"><span className={`text-sm font-semibold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{cat.count}</span><span className="text-xs text-gray-400 w-8 text-right">{Math.round((cat.count / totalIssues) * 100)}%</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <h3 className={`text-sm font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-900"}`}>Reservoir Induk (IPA)</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Level</p><p className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{reservoirUtama?.tinggiAir ?? "-"}<span className="text-xs text-gray-400 ml-0.5">cm</span></p></div>
                  <div className="text-center"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Tekanan</p><p className={`text-xl font-bold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{reservoirUtama?.tekanan?.toFixed(1) ?? "-"}<span className="text-xs text-gray-400 ml-0.5">bar</span></p></div>
                  <div className="text-center"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Status</p><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${reservoirUtama?.status === "normal" ? "bg-green-100 text-green-700" : reservoirUtama?.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${reservoirUtama?.status === "normal" ? "bg-green-500" : reservoirUtama?.status === "warning" ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />{reservoirUtama?.status === "normal" ? "Normal" : reservoirUtama?.status === "warning" ? "Waspada" : "Kritis"}</span></div>
                </div>
                <div className="relative w-full h-4 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ((reservoirUtama?.tinggiAir ?? 0) / 400) * 100)}%`, background: (reservoirUtama?.tinggiAir ?? 0) > 100 ? "linear-gradient(90deg, #22c55e, #4ade80)" : (reservoirUtama?.tinggiAir ?? 0) > 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)" }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-gray-400"><span>0 cm</span><span>Kapasitas ~400 cm</span></div>
              </div>
            </div>
          </div>

          {/* RIGHT COL — Table */}
          <div className={`rounded-xl border overflow-hidden flex flex-col transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
            <div className={`px-5 py-4 border-b flex items-center justify-between ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
              <h2 className={`text-sm font-semibold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>Pantauan Titik Real-Time</h2>
              <span className="text-[11px] text-gray-400">{statuses.length} titik</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className={`sticky top-0 ${darkMode ? "bg-gray-900" : "bg-white"}`}>
                  <tr className={`border-b ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nama</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Level</th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Tekanan</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((row) => (
                    <tr key={row.point.id} className={`border-b transition-colors ${darkMode ? "border-gray-800 hover:bg-gray-800/60" : "border-gray-50 hover:bg-gray-50/50"}`}>
                      <td className="px-5 py-3"><p className={`text-sm font-medium leading-tight ${darkMode ? "text-gray-100" : "text-gray-900"}`}>{row.point.name}</p><p className="text-[11px] text-gray-500 mt-0.5">{row.point.id}</p></td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.status === "normal" ? "bg-green-50 text-green-700" : row.status === "warning" ? "bg-amber-50 text-amber-700" : row.status === "critical" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${row.status === "normal" ? "bg-green-500" : row.status === "warning" ? "bg-amber-500" : row.status === "critical" ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
                          {row.status === "normal" ? "Normal" : row.status === "warning" ? "Waspada" : row.status === "critical" ? "Kritis" : "N/A"}
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-sm text-right font-mono tabular-nums ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{row.tinggiAir != null ? row.tinggiAir : "-"}<span className="text-gray-400 text-xs ml-0.5">cm</span></td>
                      <td className={`px-3 py-3 text-sm text-right font-mono tabular-nums ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{row.tekanan != null ? row.tekanan.toFixed(1) : "-"}<span className="text-gray-400 text-xs ml-0.5">bar</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`px-5 py-3 border-t text-[11px] text-gray-400 flex justify-between ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
              <span>{statuses.length} titik</span>
              <span>Update: {timeStr}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

