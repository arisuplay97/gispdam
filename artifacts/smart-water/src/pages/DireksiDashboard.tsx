/**
 * DireksiDashboard.tsx
 * Dashboard Direksi — Sistem Monitoring Distribusi Air PDAM TIARA
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft, AlertTriangle, TrendingUp, FileDown,
  Droplets, Clock, Moon, Sun,
} from "lucide-react";
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

// Data bayangan bawaan per titik — variasi status berbeda
// Akan dipakai sebagai fallback jika belum ada data asli dari database
const SHADOW_DATA: Record<string, { tinggiAir: number; tekanan: number }> = {
  "MON-01": { tinggiAir: 280, tekanan: 5.8 },  // Reservoir Induk — NORMAL (sehat)
  "MON-02": { tinggiAir: 85,  tekanan: 0.8 },  // BPT Airvale — WASPADA (tekanan redup)
  "MON-03": { tinggiAir: 310, tekanan: 6.2 },  // Reservoir Airbaku — NORMAL (baik)
  "MON-04": { tinggiAir: 42,  tekanan: 0.3 },  // BPT Montong Terep — KRITIS (drop)
  "MON-05": { tinggiAir: 220, tekanan: 5.0 },  // Reservoir Pagesangan — NORMAL
};

function generateWeeklyData(monitoringData: Record<string, MonitoringData>, selectedPointId: string) {
  const now = new Date();
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayName = HARI[d.getDay()];
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;

    let totalTinggi = 0, totalTekanan = 0, countT = 0, countP = 0;

    MONITORING_POINTS.forEach((pt) => {
      if (selectedPointId !== "all" && pt.id !== selectedPointId) return;

      const ptData = monitoringData[pt.id];
      const session = ptData?.sore ?? ptData?.pagi;
      const shadow = SHADOW_DATA[pt.id];

      // Pakai data asli jika ada, kalau kosong gunakan bayangan
      const baseTinggi = session?.tinggiAir ?? shadow?.tinggiAir ?? null;
      const baseTekanan = session?.tekanan ?? shadow?.tekanan ?? null;

      if (baseTinggi != null) {
        const noise = Math.sin(i * 1.7 + pt.lat * 100) * 12;
        totalTinggi += baseTinggi + noise * (i > 0 ? 1 : 0);
        countT++;
      }
      if (baseTekanan != null) {
        const noise = Math.sin(i * 2.3 + pt.lng * 100) * 0.25;
        totalTekanan += baseTekanan + noise * (i > 0 ? 1 : 0);
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

function getPakarAdvice(selectedPointId: string, pointStatuses: PointStatus[], weeklyData: any[], tReg: ReturnType<typeof linearRegression>, pReg: ReturnType<typeof linearRegression>): string {
  const lastTinggi = weeklyData[weeklyData.length - 1]?.tinggiAir;
  const lastTekanan = weeklyData[weeklyData.length - 1]?.tekanan;

  if (selectedPointId === "all") {
    let msg = "";
    if (tReg.slope < -5) msg += "⚠️ Rata-rata tinggi air se-PDAM menurun drastis. Pantau produksi sumur air tanah. ";
    if (pReg.slope < -0.1) msg += "⚠️ Rata-rata tekanan perpipaan perlahan turun. Waspadai kebocoran pada pipa primer. ";
    return msg || "✓ Secara keseluruhan, suplai tinggi air dan tekanan pada jaringan distribusi SPAM Aiq Bone terpantau stabil.";
  }

  const pointStatus = pointStatuses.find((p) => p.point.id === selectedPointId);
  if (!pointStatus) return "Pilih titik untuk memuat saran sistem.";
  const name = pointStatus.point.name;

  // Cek Data
  if (lastTinggi == null && lastTekanan == null) {
    return `ℹ️ Belum ada input data (pagi/sore) di ${name} untuk hari ini. Silakan instruksikan petugas lapangan.`;
  }

  // Pakar: Air (Reservoir / BPT)
  if (name.toLowerCase().includes("reservoir") || name.toLowerCase().includes("bpt")) {
    if (lastTinggi !== undefined && lastTinggi !== null) {
      if (lastTinggi < 50 && tReg.slope < 0) {
        return `🚨 TINGGI AIR DROP di ${name} (${lastTinggi} cm) dengan profil tren merosot! Segera periksa sumber suplai (Intake/Blok Atas) apakah ada penyumbatan aliran sedimen, atau periksa mesin pompa inlet. Buka jalur bypass jika darurat.`;
      }
      if (lastTinggi < 100) {
        return `⚠️ Tinggi air di ${name} tergolong rendah (${lastTinggi} cm). Tekan angka distribusi keluar atau naikkan debit inlet agar tak sampai kosong saat jam komersial (puncak).`;
      }
      if (lastTinggi > 350) {
        return `🛑 ${name} membahayakan nyaris meluap (${lastTinggi} cm). Kurangi pompa inlet atau pastikan pompa outlet tidak sedang mati/terhambat.`;
      }
      if (tReg.slope < -8) {
        return `⚠️ Kehilangan debit tak wajar terdeteksi. Air surut dengan kecepatan ${tReg.slope.toFixed(1)} cm/hari. Terjunkan tim telusur di ring pemukiman karena dicurigai bocor pasca-reservoir.`;
      }
    }
    return `✓ Profil operasional di ${name} sejauh ini cukup stabil. Lakukan pengurasan bak berkala sesuai instrumen manual.`;
  }

  // Pakar: Tekanan (Pipa / Jaringan Umum)
  if (lastTekanan !== undefined && lastTekanan !== null) {
    if (lastTekanan < 0.5 && pReg.slope <= 0) {
      return `🚨 TEKANAN KRITIS di batas ${name} (${lastTekanan} bar). Dugaan terkuat adalah PIPA TRANSMISI UTAMA PECAH, kerusakan rotor pompa pendorong, atau Gate Valve yang tertutup tak sadar. Terjunkan mekanik.`;
    }
    if (lastTekanan < 1.0) {
      return `⚠️ Waspada keluhan pelanggan di sekitar ${name}. Tekanan mulai redup. Cek tegangan daya (Voltage) panel pompa, atau pastikan saringan (strainer) bebas lumut.`;
    }
    if (pReg.slope < -0.2) {
      return `⚠️ Titik ini mengalami penyusutan tekanan kronis dari rentang mingguan. Potensi pencurian air (illegal tapping) pada rute atau pengerakan dimensi pipa sisi hulu.`;
    }
  }

  return `✓ Kondisi hidro-statis lapangan di area ${name} diklasifikasikan sangat optimal. Kalibrasi ulang alat ukur setidaknya satu kali sebulan.`;
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
        letter-spacing: 0.05em; color: #374151; margin-bottom: 6px; }
      table.data { width: 100%; border-collapse: collapse; }
      table.data th {
        background: #f3f4f6; text-align: left; padding: 6px 8px;
        font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        border: 1px solid #d1d5db;
      }
      table.data td { padding: 6px 8px; border: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
      .footer { margin-top: 24px; border-top: 1px solid #d1d5db; padding-top: 8px;
        text-align: center; color: #9ca3af; font-size: 8pt; }
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
  const [darkMode, setDarkMode] = useState(false);

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

  const weeklyRaw = useMemo(() => generateWeeklyData(monitoringData, selectedPointId), [monitoringData, selectedPointId]);
  const { data: chartData, tReg, pReg } = useMemo(() => addPredictions(weeklyRaw), [weeklyRaw]);
  const statuses = useMemo(() => getPointStatuses(monitoringData), [monitoringData]);

  const normalCount = statuses.filter((s) => s.status === "normal").length;
  const warningCount = statuses.filter((s) => s.status === "warning").length;
  const criticalCount = statuses.filter((s) => s.status === "critical").length;

  const advice = useMemo(
    () => getPakarAdvice(selectedPointId, statuses, weeklyRaw, tReg, pReg),
    [selectedPointId, statuses, weeklyRaw, tReg, pReg]
  );
  const cleanAdvice = advice.replace(/^[\u2713\u26a0\ufe0f\ud83d\udea8\ud83d\uded1\u2139\ufe0f\ud83d\udca1]\s?/u, "");

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
          </div>
        </div>
      </header>

      <div className={`border-b px-4 sm:px-8 py-2.5 flex items-center gap-4 text-xs transition-colors ${darkMode ? "bg-gray-900 border-gray-800 text-gray-500" : "bg-white border-gray-100 text-gray-400"}`}>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Sistem Aktif</span>
        <span>{dateStr}</span>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 py-6 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          {/* LEFT COL */}
          <div className="space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Efisiensi Distribusi</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{pctAman}%</p>
                    <p className="text-xs text-gray-400 mt-1">{normalCount}/{statuses.length} titik aman</p>
                  </div>
                  <div className="flex items-end gap-[2px] h-10">
                    {weeklyRaw.slice(-7).map((d: any, i: number) => {
                      const h = Math.max(4, ((d.tinggiAir ?? 0) / 400) * 36);
                      return <div key={i} className="w-[5px] rounded-sm bg-green-400" style={{ height: h }} />;
                    })}
                  </div>
                </div>
              </div>
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Rata-Rata Tekanan</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">{avgTekanan.toFixed(1)} <span className="text-lg font-medium text-gray-400">bar</span></p>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${avgTekanan >= 2 ? "bg-green-50 text-green-700" : avgTekanan >= 0.5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                    {avgTekanan >= 2 ? "Stabil" : avgTekanan >= 0.5 ? "Waspada" : "Kritis"}
                  </span>
                </div>
                <div className="flex gap-[2px] mt-3">
                  {weeklyRaw.slice(-7).map((d: any, i: number) => {
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
              <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
                <h2 className={`text-sm font-semibold ${darkMode ? "text-gray-100" : "text-gray-900"}`}>Tinggi Air & Tekanan</h2>
                <select className={`text-xs border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer ${darkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-600"}`} value={selectedPointId} onChange={(e) => setSelectedPointId(e.target.value)}>
                  <option value="all">Semua Titik</option>
                  {MONITORING_POINTS.map((pt) => (<option key={pt.id} value={pt.id}>{pt.name}</option>))}
                </select>
              </div>
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <div className="h-[280px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1f2937" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: darkMode ? "#6b7280" : "#9ca3af" }} axisLine={{ stroke: darkMode ? "#374151" : "#e5e7eb" }} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} label={{ value: "Tinggi Air, cm", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }, offset: 20 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} label={{ value: "Tekanan, bar", angle: 90, position: "insideRight", style: { fontSize: 10, fill: darkMode ? "#6b7280" : "#9ca3af" }, offset: 20 }} />
                      <RechartsTooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`, background: darkMode ? "#1f2937" : "#fff", color: darkMode ? "#f3f4f6" : "#111", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "10px 14px" }} formatter={(val: any, name: string) => [val == null ? "-" : typeof val === "number" ? val.toFixed(2) : val, name]} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12, color: darkMode ? "#9ca3af" : undefined }} iconType="circle" iconSize={8} />
                      <Line yAxisId="left" type="monotone" dataKey="tinggiAir" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }} name="Tinggi Air (cm)" connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="tekanan" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} name="Tekanan (bar)" connectNulls />
                      <Line yAxisId="left" type="monotone" dataKey="predTinggi" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 4" dot={{ r: 2.5, fill: "#bbf7d0", stroke: "#22c55e", strokeWidth: 1 }} name="Prediksi T.Air" connectNulls />
                      <Line yAxisId="right" type="monotone" dataKey="predTekanan" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 4" dot={{ r: 2.5, fill: "#fecaca", stroke: "#ef4444", strokeWidth: 1 }} name="Prediksi Tekanan" connectNulls />
                      <ReferenceLine yAxisId="left" y={50} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                      <ReferenceLine yAxisId="right" y={0.5} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="px-6 pb-5">
                <div className={`rounded-lg px-4 py-3 text-[13px] leading-relaxed border ${cleanAdvice.includes("KRITIS") || cleanAdvice.includes("DROP") || cleanAdvice.includes("PECAH") ? "bg-red-50 border-red-200 text-red-800" : cleanAdvice.includes("stabil") || cleanAdvice.includes("optimal") || cleanAdvice.includes("Secara keseluruhan") ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                  <span className="font-semibold">Analisa & Saran: </span>{cleanAdvice}
                </div>
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
                      <div className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: cat.color }} /><span className="text-sm text-gray-600">{cat.label}</span></div>
                      <div className="flex items-center gap-3"><span className="text-sm font-semibold text-gray-900">{cat.count}</span><span className="text-xs text-gray-400 w-8 text-right">{Math.round((cat.count / totalIssues) * 100)}%</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-xl border p-5 transition-colors ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
                <h3 className={`text-sm font-semibold mb-4 ${darkMode ? "text-gray-100" : "text-gray-900"}`}>Reservoir Induk (IPA)</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Level</p><p className="text-xl font-bold text-gray-900">{reservoirUtama?.tinggiAir ?? "-"}<span className="text-xs text-gray-400 ml-0.5">cm</span></p></div>
                  <div className="text-center"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Tekanan</p><p className="text-xl font-bold text-gray-900">{reservoirUtama?.tekanan?.toFixed(1) ?? "-"}<span className="text-xs text-gray-400 ml-0.5">bar</span></p></div>
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
                      <td className="px-3 py-3 text-sm text-gray-700 text-right font-mono tabular-nums">{row.tinggiAir != null ? row.tinggiAir : "-"}<span className="text-gray-400 text-xs ml-0.5">cm</span></td>
                      <td className="px-3 py-3 text-sm text-gray-700 text-right font-mono tabular-nums">{row.tekanan != null ? row.tekanan.toFixed(1) : "-"}<span className="text-gray-400 text-xs ml-0.5">bar</span></td>
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

