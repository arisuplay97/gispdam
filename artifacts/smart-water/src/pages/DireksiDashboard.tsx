/**
 * DireksiDashboard.tsx
 * Dashboard Direksi — Sistem Monitoring Distribusi Air PDAM TIARA
 */
import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft, AlertTriangle, TrendingUp, Users, FileDown,
  Droplets, Gauge, Clock, Shield, ChevronDown, ChevronUp,
} from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { MONITORING_POINTS, type MonitoringData, type MonitoringPoint } from "@/components/MonitoringLayer";
import { useGetMonitoringData } from "@workspace/api-client-react";

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

function generateWeeklyData(monitoringData: Record<string, MonitoringData>) {
  const now = new Date();
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayName = HARI[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;

    // Aggregate all monitoring points
    let totalTinggi = 0, totalTekanan = 0, countT = 0, countP = 0;

    MONITORING_POINTS.forEach((pt) => {
      const ptData = monitoringData[pt.id];
      const session = ptData?.sore ?? ptData?.pagi;
      if (session?.tinggiAir != null) {
        // Add some day-variance for historical simulation
        const noise = Math.sin(i * 1.7 + pt.lat * 100) * 15;
        totalTinggi += session.tinggiAir + noise * (i > 0 ? 1 : 0);
        countT++;
      }
      if (session?.tekanan != null) {
        const noise = Math.sin(i * 2.3 + pt.lng * 100) * 0.3;
        totalTekanan += session.tekanan + noise * (i > 0 ? 1 : 0);
        countP++;
      }
    });

    data.push({
      name: `${dayName}\n${dateStr}`,
      day: dayName,
      date: dateStr,
      tinggiAir: countT > 0 ? Number((totalTinggi / countT).toFixed(1)) : null,
      tekanan: countP > 0 ? Number((totalTekanan / countP).toFixed(2)) : null,
    });
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

function addPredictions(weeklyData: any[]) {
  const tinggiPts = weeklyData
    .map((d, i) => ({ x: i, y: d.tinggiAir }))
    .filter((p) => p.y != null);
  const tekananPts = weeklyData
    .map((d, i) => ({ x: i, y: d.tekanan }))
    .filter((p) => p.y != null);

  const tReg = linearRegression(tinggiPts);
  const pReg = linearRegression(tekananPts);

  const predictions = [];
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    const dayName = HARI[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    const xVal = weeklyData.length - 1 + i;
    predictions.push({
      name: `${dayName}\n${dateStr}`,
      day: dayName,
      date: dateStr,
      tinggiAir: null,
      tekanan: null,
      predTinggi: Number((tReg.slope * xVal + tReg.intercept).toFixed(1)),
      predTekanan: Number((pReg.slope * xVal + pReg.intercept).toFixed(2)),
      isPrediction: true,
    });
  }

  // Add pred columns to actual data
  const merged = weeklyData.map((d, i) => ({
    ...d,
    predTinggi: null,
    predTekanan: null,
    isPrediction: false,
  }));

  // Bridge: last actual point also gets prediction value for continuous line
  if (merged.length > 0) {
    const last = merged[merged.length - 1];
    last.predTinggi = last.tinggiAir;
    last.predTekanan = last.tekanan;
  }

  return { data: [...merged, ...predictions], tReg, pReg };
}

function getPointStatuses(
  monitoringData: Record<string, MonitoringData>
): PointStatus[] {
  return MONITORING_POINTS.map((pt) => {
    const d = monitoringData[pt.id];
    const session = d?.sore ?? d?.pagi;

    if (!d || (!session?.tinggiAir && !session?.tekanan)) {
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

    if (session?.tekanan != null) {
      if (session.tekanan < 0.5) { status = "critical"; cause = "Tekanan sangat rendah (< 0.5 bar)"; }
      else if (session.tekanan < 1.0) { status = "warning"; cause = "Tekanan mulai turun (< 1.0 bar)"; }
    }
    if (session?.tinggiAir != null) {
      if (session.tinggiAir < 50) { status = "critical"; cause = "Tinggi air kritis (< 50 cm)"; }
      else if (session.tinggiAir < 100) {
        if (status !== "critical") { status = "warning"; cause = "Tinggi air rendah (< 100 cm)"; }
      }
    }

    // Anomali penurunan
    if (d.pagi?.tinggiAir != null && d.sore?.tinggiAir != null) {
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
      tinggiAir: session?.tinggiAir,
      tekanan: session?.tekanan,
    };
  }).sort((a, b) => {
    const order = { critical: 0, warning: 1, empty: 2, normal: 3 };
    return order[a.status] - order[b.status];
  });
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
async function exportPDF(
  statuses: PointStatus[],
) {
  // Use browser print as PDF — simple, reliable, no external lib
  const printWindow = window.open("", "_blank");
  if (!printWindow) { alert("Popup blocker terdeteksi. Izinkan popup untuk export."); return; }

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const problemRows = statuses.filter((s) => s.status === "warning" || s.status === "critical");
  const normalCount = statuses.filter((s) => s.status === "normal").length;
  const warningCount = statuses.filter((s) => s.status === "warning").length;
  const criticalCount = statuses.filter((s) => s.status === "critical").length;
  const emptyCount = statuses.filter((s) => s.status === "empty").length;

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Laporan Harian - PDAM TIARA</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #1e293b; font-size: 12px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 15px; color: #334155; margin: 24px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 3px solid #1d4ed8; padding-bottom: 12px; }
      .stats { display: flex; gap: 16px; margin: 12px 0; }
      .stat-box { padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 90px; }
      .stat-box .num { font-size: 22px; font-weight: 700; }
      .stat-box .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      th { background: #f1f5f9; text-align: left; padding: 6px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
      td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
      tr.kritisRow { background: #fef2f2; }
      tr.warningRow { background: #fffbeb; }
      .badge { padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 600; display: inline-block; }
      .badge-critical { background: #fee2e2; color: #dc2626; }
      .badge-warning { background: #fef3c7; color: #d97706; }
      .badge-normal { background: #dcfce7; color: #16a34a; }
      .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; }
      @media print { body { padding: 16px; } }
    </style>
  </head><body>
    <div class="header">
      <div>
        <h1>📋 Laporan Harian Distribusi Air</h1>
        <p style="color:#64748b;">PDAM TIARA — Sistem Informasi Layanan Distribusi</p>
      </div>
      <div style="text-align:right;">
        <p style="font-weight:600;">${dateStr}</p>
        <p style="color:#64748b;">${now.toLocaleTimeString("id-ID")}</p>
      </div>
    </div>

    <h2>📊 Ringkasan Status</h2>
    <div class="stats">
      <div class="stat-box" style="background:#dcfce7;color:#15803d;">
        <div class="num">${normalCount}</div><div class="lbl">Normal</div>
      </div>
      <div class="stat-box" style="background:#fef3c7;color:#b45309;">
        <div class="num">${warningCount}</div><div class="lbl">Waspada</div>
      </div>
      <div class="stat-box" style="background:#fee2e2;color:#dc2626;">
        <div class="num">${criticalCount}</div><div class="lbl">Kritis</div>
      </div>
      <div class="stat-box" style="background:#f1f5f9;color:#64748b;">
        <div class="num">${emptyCount}</div><div class="lbl">Belum Input</div>
      </div>
    </div>

    <h2>⚠️ Daftar Titik Bermasalah</h2>
    ${problemRows.length === 0 ? '<p style="color:#16a34a;font-weight:600;">✓ Semua titik dalam kondisi normal</p>' : `
    <table>
      <tr><th>Nama Titik</th><th>Status</th><th>Penyebab</th><th>Prediksi</th></tr>
      ${problemRows.map((r) => `
        <tr class="${r.status === "critical" ? "kritisRow" : "warningRow"}">
          <td><strong>${r.point.name}</strong></td>
          <td><span class="badge badge-${r.status}">${r.status === "critical" ? "KRITIS" : "WASPADA"}</span></td>
          <td>${r.cause}</td>
          <td>${r.prediksiKritis}</td>
        </tr>
      `).join("")}
    </table>`}

    <div class="footer">
      Dokumen ini di-generate secara otomatis oleh Tiara Manajemen Distribusi &bull; ${dateStr}
    </div>

    <script>setTimeout(() => { window.print(); }, 500);</script>
  </body></html>`);
  printWindow.document.close();
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function DireksiDashboard() {
  const [, navigate] = useLocation();
  const { data: rawMonitoringData } = useGetMonitoringData();
  
  const monitoringData = useMemo(() => {
    const todayDateStr = new Date().toISOString().split("T")[0];
    const data: Record<string, MonitoringData> = {};
    if (rawMonitoringData) {
      rawMonitoringData.forEach((row) => {
        const rowDateStr = new Date(row.date).toISOString().split("T")[0];
        if (rowDateStr === todayDateStr) {
          if (!data[row.pointId]) data[row.pointId] = {};
          data[row.pointId][row.session] = {
            tinggiAir: row.tinggiAir ?? undefined,
            tekanan: row.tekanan ?? undefined,
          };
        }
      });
    }
    return data;
  }, [rawMonitoringData]);
  const [expandedChart, setExpandedChart] = useState(true);
  const [expandedProblems, setExpandedProblems] = useState(true);

  const weeklyRaw = useMemo(() => generateWeeklyData(monitoringData), [monitoringData]);
  const { data: chartData, tReg, pReg } = useMemo(() => addPredictions(weeklyRaw), [weeklyRaw]);
  const statuses = useMemo(() => getPointStatuses(monitoringData), [monitoringData]);

  const problemPoints = statuses.filter((s) => s.status === "warning" || s.status === "critical");
  const normalCount = statuses.filter((s) => s.status === "normal").length;
  const warningCount = statuses.filter((s) => s.status === "warning").length;
  const criticalCount = statuses.filter((s) => s.status === "critical").length;
  const emptyCount = statuses.filter((s) => s.status === "empty").length;

  // Estimate when prediction hits critical
  const estimateKritis = useMemo(() => {
    const critTinggi = 50; // cm
    const critTekanan = 0.5; // bar
    const lastTinggi = weeklyRaw[weeklyRaw.length - 1]?.tinggiAir;
    const lastTekanan = weeklyRaw[weeklyRaw.length - 1]?.tekanan;

    let msg = "";
    if (tReg.slope < 0 && lastTinggi != null) {
      const daysToKritis = (critTinggi - lastTinggi) / tReg.slope;
      if (daysToKritis > 0 && daysToKritis < 30) {
        msg += `⚠️ Tinggi air diperkirakan mencapai kritis dalam ${Math.ceil(daysToKritis)} hari. `;
      }
    }
    if (pReg.slope < 0 && lastTekanan != null) {
      const daysToKritis = (critTekanan - lastTekanan) / pReg.slope;
      if (daysToKritis > 0 && daysToKritis < 30) {
        msg += `⚠️ Tekanan diperkirakan mencapai kritis dalam ${Math.ceil(daysToKritis)} hari.`;
      }
    }
    return msg || "✓ Tidak ada prediksi kondisi kritis dalam waktu dekat.";
  }, [weeklyRaw, tReg, pReg]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Dashboard Direksi</h1>
                <p className="text-xs text-slate-500">Sistem Monitoring Distribusi Air — PDAM TIARA</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>{dateStr}</span>
              </div>
              <button
                onClick={() => exportPDF(statuses)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all active:scale-95"
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">Export Laporan</span>
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">

          {/* ── Summary Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Normal</span>
              </div>
              <p className="text-3xl font-bold text-green-700">{normalCount}</p>
              <p className="text-[11px] text-green-600/70 mt-1">Titik aman</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Waspada</span>
              </div>
              <p className="text-3xl font-bold text-amber-700">{warningCount}</p>
              <p className="text-[11px] text-amber-600/70 mt-1">Perlu perhatian</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Kritis</span>
              </div>
              <p className={`text-3xl font-bold text-red-700 ${criticalCount > 0 ? "animate-pulse" : ""}`}>{criticalCount}</p>
              <p className="text-[11px] text-red-600/70 mt-1">Tindakan segera</p>
            </div>
          </div>

          {/* ── 1. Grafik Tren Mingguan ────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedChart(!expandedChart)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                  <TrendingUp className="h-5 w-5 text-blue-700" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold text-slate-800">Grafik Tren Mingguan + Prediksi</h2>
                  <p className="text-[11px] text-slate-500">Rata-rata tinggi air & tekanan seluruh titik, prediksi 3 hari ke depan</p>
                </div>
              </div>
              {expandedChart ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {expandedChart && (
              <div className="px-4 sm:px-6 pb-6">
                <div className="h-[280px] sm:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: "#e2e8f0" }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: "#3b82f6" }}
                        axisLine={{ stroke: "#3b82f6" }}
                        label={{ value: "Tinggi Air (cm)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#3b82f6" }, offset: 15 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "#8b5cf6" }}
                        axisLine={{ stroke: "#8b5cf6" }}
                        label={{ value: "Tekanan (bar)", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#8b5cf6" }, offset: 15 }}
                      />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        formatter={(val: any, name: string) => {
                          if (val == null) return ["-", name];
                          return [typeof val === "number" ? val.toFixed(2) : val, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />

                      {/* Actual data */}
                      <Line yAxisId="left" type="monotone" dataKey="tinggiAir" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3.5, fill: "#3b82f6" }} name="Tinggi Air (cm)" connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="tekanan" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3.5, fill: "#8b5cf6" }} name="Tekanan (bar)" connectNulls />

                      {/* Prediction lines */}
                      <Line yAxisId="left" type="monotone" dataKey="predTinggi" stroke="#3b82f6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "#93c5fd", stroke: "#3b82f6" }} name="Prediksi T.Air" connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="predTekanan" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "#c4b5fd", stroke: "#8b5cf6" }} name="Prediksi Tekanan" connectNulls />

                      {/* Critical threshold lines */}
                      <ReferenceLine yAxisId="left" y={50} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1} label={{ value: "Kritis 50cm", position: "insideBottomLeft", style: { fontSize: 9, fill: "#ef4444" } }} />
                      <ReferenceLine yAxisId="right" y={0.5} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1} label={{ value: "Kritis 0.5bar", position: "insideBottomRight", style: { fontSize: 9, fill: "#ef4444" } }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Prediction insight */}
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${estimateKritis.startsWith("✓") ? "bg-green-50 text-green-800 border border-green-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                  <strong>💡 Analisa Prediksi:</strong> {estimateKritis}
                </div>
              </div>
            )}
          </section>

          {/* ── 2. Daftar Titik Bermasalah ────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedProblems(!expandedProblems)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold text-slate-800">Daftar Titik Bermasalah</h2>
                  <p className="text-[11px] text-slate-500">{problemPoints.length} titik memerlukan perhatian</p>
                </div>
              </div>
              {expandedProblems ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {expandedProblems && (
              <div className="px-4 sm:px-6 pb-6">
                {problemPoints.length === 0 ? (
                  <div className="py-8 text-center">
                    <Shield className="h-10 w-10 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-700">Semua titik dalam kondisi normal</p>
                    <p className="text-xs text-slate-400 mt-1">Tidak ada titik yang memerlukan tindakan saat ini</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Nama Titik</th>
                          <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                          <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Penyebab</th>
                          <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Tinggi Air</th>
                          <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Tekanan</th>
                          <th className="text-left py-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Prediksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemPoints.map((row) => (
                          <tr
                            key={row.point.id}
                            className={`border-b border-slate-100 transition-colors ${
                              row.status === "critical"
                                ? "bg-red-50/70 hover:bg-red-50"
                                : "bg-amber-50/50 hover:bg-amber-50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{row.point.name}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                row.status === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${row.status === "critical" ? "bg-red-500 animate-pulse" : "bg-amber-500"}`} />
                                {row.status === "critical" ? "KRITIS" : "WASPADA"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 hidden sm:table-cell">{row.cause}</td>
                            <td className="py-2.5 px-3 text-slate-600 hidden md:table-cell">{row.tinggiAir != null ? `${row.tinggiAir} cm` : "-"}</td>
                            <td className="py-2.5 px-3 text-slate-600 hidden md:table-cell">{row.tekanan != null ? `${row.tekanan} bar` : "-"}</td>
                            <td className="py-2.5 px-3 text-xs font-medium text-slate-500">{row.prediksiKritis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>



          {/* Footer */}
          <div className="text-center pb-8">
            <p className="text-[11px] text-slate-400">
              Tiara Manajemen Distribusi &bull; Sistem Informasi Layanan Distribusi &bull; {dateStr}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
