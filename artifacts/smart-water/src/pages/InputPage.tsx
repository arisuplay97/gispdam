/**
 * InputPage.tsx
 * Halaman form input khusus petugas lapangan — mobile-first
 * Alur: Identitas → Pilih Reservoir → Input Tinggi Air → Input Manometer satu per satu → Ringkasan → Konfirmasi
 * UI: Modern, premium glassmorphism & soft shadows (Dribbble style)
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertTriangle,
  Droplets, Gauge, MapPin, User, Clock, Send, Home, BarChart3,
  Map as MapIcon, ChevronRight, Activity
} from "lucide-react";
import {
  RESERVOIRS, JALUR_PIPA, MANOMETERS, DOPENDS,
  getJalurForReservoir, getManometersForJalur,
  getManometerStatus, getDopend, getReservoir,
  STATUS_COLORS, STATUS_LABELS,
  type Reservoir, type Manometer, type ManometerStatus,
} from "@/data/networkData";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ManometerInput {
  id: string;
  tekanan: string; // string for form input
}

type Step = "identitas" | "pilih-reservoir" | "input-reservoir" | "input-manometer" | "ringkasan" | "selesai";

// ─── Petugas names (dummy) ──────────────────────────────────────────────────
const PETUGAS_LIST = [
  "Ahmad Fauzi", "Budi Santoso", "Cahya Pratama",
  "Dian Kurniawan", "Eko Wahyudi", "Faisal Rahman",
];

// ─── Component ──────────────────────────────────────────────────────────────
export default function InputPage() {
  const [, navigate] = useLocation();
  const [macroUrl] = useLocalStorage<string>("gis-macro-url", "");

  // Step state machine
  const [step, setStep] = useState<Step>("identitas");

  // Step 1: Identitas
  const [petugas, setPetugas] = useState("");
  const [sesi, setSesi] = useState<"pagi" | "sore">("pagi");
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  // Step 2: Pilih Reservoir
  const [selectedReservoirId, setSelectedReservoirId] = useState<string | null>(null);

  // Step 3: Input Reservoir
  const [tinggiAirInput, setTinggiAirInput] = useState("");

  // Step 4: Input Manometer
  const [currentManometerIndex, setCurrentManometerIndex] = useState(0);
  const [manometerInputs, setManometerInputs] = useState<ManometerInput[]>([]);

  // Derived: jalur & manometer for selected reservoir
  const jalurList = useMemo(() => {
    if (!selectedReservoirId) return [];
    return getJalurForReservoir(selectedReservoirId);
  }, [selectedReservoirId]);

  const allManometersInOrder = useMemo(() => {
    const result: { manometer: Manometer; jalurIndex: number; dopendName: string }[] = [];
    jalurList.forEach((jalur, ji) => {
      const manometers = getManometersForJalur(jalur.id);
      const dopend = getDopend(jalur.dopendId);
      manometers.forEach(m => {
        result.push({ manometer: m, jalurIndex: ji, dopendName: dopend?.name ?? "?" });
      });
    });
    return result;
  }, [jalurList]);

  const currentManometer = allManometersInOrder[currentManometerIndex];
  const selectedReservoir = selectedReservoirId ? getReservoir(selectedReservoirId) : null;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectReservoir = (id: string) => {
    setSelectedReservoirId(id);
    setTinggiAirInput("");
    setCurrentManometerIndex(0);
    setManometerInputs([]);
    setStep("input-reservoir");
  };

  const handleReservoirDone = () => {
    const inputs: ManometerInput[] = allManometersInOrder.map(({ manometer }) => ({
      id: manometer.id,
      tekanan: "",
    }));
    setManometerInputs(inputs);
    setCurrentManometerIndex(0);
    setStep("input-manometer");
  };

  const handleManometerNext = () => {
    if (currentManometerIndex < allManometersInOrder.length - 1) {
      setCurrentManometerIndex(prev => prev + 1);
    } else {
      setStep("ringkasan");
    }
  };

  const handleManometerPrev = () => {
    if (currentManometerIndex > 0) {
      setCurrentManometerIndex(prev => prev - 1);
    } else {
      setStep("input-reservoir");
    }
  };

  const updateManometerInput = (value: string) => {
    setManometerInputs(prev => {
      const next = [...prev];
      next[currentManometerIndex] = { ...next[currentManometerIndex], tekanan: value };
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedReservoir) return;
    const todayStr = new Date().toISOString().split("T")[0];

    try {
      await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointId: selectedReservoir.id,
          session: sesi,
          date: todayStr,
          tinggiAir: tinggiAirInput ? Number(tinggiAirInput) : null,
          tekanan: null,
        }),
      });
    } catch (e) {
      console.error("Failed to save reservoir data:", e);
    }

    for (const mi of manometerInputs) {
      if (!mi.tekanan) continue;
      try {
        await fetch("/api/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pointId: mi.id,
            session: sesi,
            date: todayStr,
            tinggiAir: null,
            tekanan: Number(mi.tekanan),
          }),
        });
      } catch (e) {
        console.error("Failed to save manometer data:", e);
      }
    }

    if (macroUrl?.trim().startsWith("https://script.google.com/")) {
      try {
        await fetch(macroUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            lokasi: selectedReservoir.name,
            sesi,
            tinggiAir: tinggiAirInput || "",
            tekanan: "",
            petugas,
            tipe: "reservoir",
          }),
        });
        for (const mi of manometerInputs) {
          if (!mi.tekanan) continue;
          const man = MANOMETERS.find(m => m.id === mi.id);
          await fetch(macroUrl.trim(), {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              lokasi: man?.name ?? mi.id,
              sesi,
              tinggiAir: "",
              tekanan: mi.tekanan,
              petugas,
              tipe: "manometer",
            }),
          });
        }
      } catch (e) {
        console.error("Failed to send to Google Sheets:", e);
      }
    }

    setStep("selesai");
  }, [selectedReservoir, sesi, tinggiAirInput, manometerInputs, macroUrl, petugas]);

  const resetForm = () => {
    setStep("pilih-reservoir");
    setSelectedReservoirId(null);
    setTinggiAirInput("");
    setCurrentManometerIndex(0);
    setManometerInputs([]);
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────
  const currentTekananVal = manometerInputs[currentManometerIndex]?.tekanan ?? "";
  const currentTekananNum = currentTekananVal ? Number(currentTekananVal) : null;
  const currentTekananStatus: ManometerStatus = getManometerStatus(currentTekananNum);

  const tinggiAirNum = tinggiAirInput ? Number(tinggiAirInput) : null;

  // ─── Stepper ──────────────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: "identitas", label: "Petugas" },
    { key: "pilih-reservoir", label: "Reservoir" },
    { key: "input-reservoir", label: "Tinggi Air" },
    { key: "input-manometer", label: "Manometer" },
    { key: "ringkasan", label: "Ringkasan" },
    { key: "selesai", label: "Selesai" },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }} className="min-h-screen relative bg-[#f8fafc] overflow-hidden">
      
      {/* Decorative Background Blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-400/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-400/10 blur-[120px] pointer-events-none" />

      {/* Top Bar - Glassmorphism */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between px-4 h-[60px]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="h-10 w-10 flex items-center justify-center -ml-2 rounded-full text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 transition-all active:scale-95">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col justify-center">
              <h1 className="text-sm font-extrabold text-slate-800 tracking-tight leading-tight">Input Data</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Petugas Lapangan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 active:scale-95 transition-all shadow-sm">
              <MapIcon className="h-4 w-4" />
            </button>
            <button onClick={() => navigate("/dashboard")} className="flex items-center justify-center h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:scale-105 active:scale-95 transition-all shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-1.5 hide-scrollbar">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1">
                <div className={`h-[6px] rounded-full flex-1 transition-all duration-700 ease-out shadow-inner ${
                  i < stepIndex 
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-emerald-500/20" 
                    : i === stepIndex 
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/30" 
                      : "bg-slate-200/80"
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-md">
              {steps[stepIndex]?.label}
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
              {stepIndex + 1}/{steps.length}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 relative z-10 transition-all duration-500">
        
        {/* ── Step 1: Identitas ───────────────────────────────────────── */}
        {step === "identitas" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            <div className="bg-white/80 backdrop-blur-2xl rounded-[28px] border border-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center p-0.5 shadow-inner">
                  <div className="h-full w-full bg-white rounded-[14px] flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Identitas Diri</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Lengkapi data untuk memulai shift.</p>
                </div>
              </div>

              {/* Tanggal (otomatis) */}
              <div className="mb-6">
                <label className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2 pl-1">Tanggal Hari Ini</label>
                <div className="flex items-center gap-3 px-4 h-14 bg-slate-50/80 rounded-2xl border border-slate-100/80 shadow-sm">
                  <div className="h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{today}</span>
                </div>
              </div>

              {/* Nama Petugas */}
              <div className="mb-6">
                <label className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2 pl-1">Nama Petugas</label>
                <div className="relative">
                  <select
                    value={petugas}
                    onChange={e => setPetugas(e.target.value)}
                    className="w-full h-14 px-4 bg-white border-2 border-slate-200/70 rounded-2xl text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-[4px] focus:ring-blue-500/20 outline-none transition-all appearance-none shadow-sm cursor-pointer"
                  >
                    <option value="" disabled>Pilih nama Anda...</option>
                    {PETUGAS_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none rotate-90" />
                </div>
              </div>

              {/* Sesi */}
              <div>
                <label className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2 pl-1">Sesi Shift</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["pagi", "sore"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSesi(s)}
                      className={`flex items-center justify-center gap-2 h-14 rounded-2xl text-sm font-bold border-2 transition-all duration-300 active:scale-95 ${
                        sesi === s
                          ? "border-indigo-500 bg-indigo-50/80 text-indigo-700 shadow-[0_4px_12px_rgba(99,102,241,0.15)] ring-2 ring-indigo-500/20"
                          : "border-slate-200/70 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
                      }`}
                    >
                      <span className="text-lg">{s === "pagi" ? "☀️" : "🌙"}</span>
                      {s === "pagi" ? "Sesi Pagi" : "Sesi Sore"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("pilih-reservoir")}
              disabled={!petugas}
              className="group w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-b from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-[0_8px_20px_rgba(79,70,229,0.25)] hover:shadow-[0_12px_24px_rgba(79,70,229,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0 disabled:active:scale-100 disabled:shadow-none"
            >
              Mulai Input <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* ── Step 2: Pilih Reservoir ──────────────────────────────────── */}
        {step === "pilih-reservoir" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
            <div className="flex items-center justify-between mb-2 px-1">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Pilih Reservoir</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Pilih titik reservoir sumber</p>
              </div>
              <button 
                onClick={() => setStep("identitas")} 
                className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95"
              >
                Kembali
              </button>
            </div>

            <div className="space-y-3">
              {RESERVOIRS.map((r, idx) => {
                const jalurs = getJalurForReservoir(r.id);
                const manCount = jalurs.reduce((acc, j) => acc + getManometersForJalur(j.id).length, 0);
                const stFormat = r.status === "normal" ? { bg: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-50" } :
                                 r.status === "waspada" ? { bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-50" } :
                                 { bg: "bg-red-500", text: "text-red-700", light: "bg-red-50" };

                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectReservoir(r.id)}
                    className="w-full bg-white/80 backdrop-blur-xl rounded-[24px] border border-white/80 p-5 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)] hover:border-indigo-100 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all duration-300 group"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                           <div className={`absolute inset-0 ${stFormat.bg} blur-md opacity-20 rounded-2xl`} />
                           <div className={`relative h-12 w-12 rounded-[16px] ${stFormat.light} border border-white flex items-center justify-center shrink-0`}>
                             <Droplets className={`h-6 w-6 ${stFormat.bg.replace("bg-", "text-")}`} />
                           </div>
                        </div>
                        <div className="pt-0.5">
                          <h3 className="text-base font-extrabold text-slate-800 tracking-tight">{r.name}</h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${stFormat.light} ${stFormat.text}`}>
                              {r.tinggiAir} cm — {r.status === "normal" ? "Normal" : r.status === "waspada" ? "Waspada" : "Kritis"}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-400 mt-2 flex items-center gap-1.5">
                            <Activity className="h-3 w-3" /> {jalurs.length} jalur distribusi · {manCount} manometer
                          </p>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors mt-2">
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Input Tinggi Air Reservoir ─────────────────────── */}
        {step === "input-reservoir" && selectedReservoir && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
            <div className="flex items-center justify-between px-1">
              <button 
                onClick={() => setStep("pilih-reservoir")} 
                className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95 flex items-center gap-1"
              >
                 <ArrowLeft className="h-3 w-3" /> Ganti Reservoir
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl rounded-[28px] border border-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 blur-[40px] rounded-full pointer-events-none" />

              <div className="flex items-center gap-4 mb-8">
                <div className="h-14 w-14 rounded-[16px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.3)]">
                  <Droplets className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Pengukuran Reservoir</p>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight leading-tight">{selectedReservoir.name}</h2>
                </div>
              </div>

              {/* Kapasitas referensi */}
              <div className="mb-8 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 shadow-inner">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Kapasitas Total</span>
                  <span className="font-extrabold text-slate-700 text-sm bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">{selectedReservoir.kapasitas} cm</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out relative"
                    style={{
                      width: `${Math.min(100, (tinggiAirNum ?? selectedReservoir.tinggiAir) / selectedReservoir.kapasitas * 100)}%`,
                      background: (tinggiAirNum ?? selectedReservoir.tinggiAir) > 100 ? "linear-gradient(to right, #34d399, #10b981)" : (tinggiAirNum ?? selectedReservoir.tinggiAir) > 50 ? "linear-gradient(to right, #fbbf24, #f59e0b)" : "linear-gradient(to right, #f87171, #ef4444)",
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Input tinggi air */}
              <div className="relative z-10">
                <label className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3 text-center">Tinggi Air Saat Ini (cm)</label>
                <div className="relative max-w-xs mx-auto">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="999"
                    step="0.1"
                    placeholder="0.0"
                    value={tinggiAirInput}
                    onChange={e => setTinggiAirInput(e.target.value)}
                    className="w-full h-20 px-4 text-4xl font-black text-slate-800 bg-white border-2 border-slate-200/80 rounded-[20px] outline-none focus:border-blue-500 focus:ring-[6px] focus:ring-blue-500/15 transition-all text-center placeholder:text-slate-200 shadow-sm"
                  />
                  {tinggiAirInput && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 pointer-events-none">cm</span>}
                </div>
              </div>

              {/* Warning jika < 100 cm */}
              {tinggiAirNum !== null && tinggiAirNum < 100 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-[20px] flex items-start gap-3 shadow-inner animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-extrabold text-amber-900">Tinggi Air Rendah!</p>
                    <p className="text-[11px] font-medium text-amber-700/80 mt-1 leading-relaxed">
                      Tinggi air <strong>{tinggiAirNum} cm</strong> di bawah batas waspada (100 cm). Pastikan pompa suplai berjalan normal.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleReservoirDone}
              disabled={!tinggiAirInput}
              className="group w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-[0_8px_20px_rgba(79,70,229,0.25)] hover:shadow-[0_12px_24px_rgba(79,70,229,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0 disabled:active:scale-100 disabled:shadow-none"
            >
              Simpan & Lanjut Manometer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* ── Step 4: Input Manometer ──────────────────────────────────── */}
        {step === "input-manometer" && currentManometer && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
            {/* Header posisi */}
            <div className="flex items-center justify-between px-1">
              <button 
                onClick={handleManometerPrev} 
                className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95 flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> {currentManometerIndex === 0 ? "Reservoir" : "Kembali"}
              </button>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-extrabold text-indigo-700 tracking-wider">
                  TITIK {currentManometerIndex + 1} / {allManometersInOrder.length}
                </span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl rounded-[28px] border border-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
               {/* Subtle background glow */}
               <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none blur-[50px] opacity-20 transition-colors duration-500 ${
                 currentTekananNum !== null && currentTekananNum < 0.5 ? "bg-red-500" : 
                 currentTekananNum !== null && currentTekananNum < 1 ? "bg-amber-500" : 
                 currentTekananNum !== null ? "bg-emerald-500" : "bg-indigo-400"
               }`} />

              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="h-14 w-14 rounded-[16px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
                  <Gauge className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Input Titik Manometer</p>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight leading-tight">{currentManometer.manometer.name}</h2>
                </div>
              </div>

              {/* Lokasi info */}
              <div className="mb-6 grid grid-cols-2 gap-3 relative z-10">
                <div className="p-3 bg-slate-50 rounded-[16px] border border-slate-100 shadow-inner">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jalur Distribusi</p>
                   <p className="text-xs font-bold text-slate-700 truncate">Menuju {currentManometer.dopendName}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-[16px] border border-slate-100 shadow-inner">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Posisi KM</p>
                   <p className="text-xs font-bold text-slate-700">KM {currentManometer.manometer.posisiKm}</p>
                </div>
              </div>

              {/* Mini map - visual jalur */}
              <div className="mb-8 p-4 bg-slate-50/80 rounded-[20px] border border-slate-100/80 shadow-inner">
                <div className="flex justify-between items-end mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress Jalur</p>
                  {/* Koordinat */}
                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                    <MapPin className="h-2.5 w-2.5" />
                    <span>{currentManometer.manometer.lat.toFixed(4)}, {currentManometer.manometer.lng.toFixed(4)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-0.5 px-2">
                  {/* Reservoir dot */}
                  <div className="relative">
                    <div className="h-4 w-4 rounded-full bg-blue-500 shrink-0 border-2 border-white shadow-sm z-10 relative" title="Reservoir" />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-blue-600 truncate max-w-[40px]">RES</div>
                  </div>
                  {/* Manometer dots */}
                  {allManometersInOrder
                    .filter(m => m.dopendName === currentManometer.dopendName)
                    .map((m, i) => {
                      const isActive = m.manometer.id === currentManometer.manometer.id;
                      const inputVal = manometerInputs.find(mi => mi.id === m.manometer.id)?.tekanan;
                      const filled = !!inputVal;
                      return (
                        <div key={m.manometer.id} className="flex items-center flex-1">
                          <div className={`h-[4px] flex-1 transition-colors duration-500 m-0.5 rounded-full ${filled ? "bg-emerald-400" : isActive ? "bg-indigo-300" : "bg-slate-200"}`} />
                          <div className={`relative z-10 h-5 w-5 rounded-full border-[3px] flex items-center justify-center shrink-0 transition-all duration-500 ${
                            isActive ? "border-indigo-500 bg-white scale-125 shadow-[0_0_12px_rgba(99,102,241,0.5)]" :
                            filled ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                          }`}>
                            {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                            {filled && !isActive && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </div>
                      );
                    })}
                  <div className="h-[4px] flex-1 bg-slate-200 m-0.5 rounded-full" />
                  {/* Dopend dot */}
                  <div className="relative">
                    <div className="h-4 w-4 rounded-md bg-rose-500 shrink-0 border-2 border-white shadow-sm z-10 relative rotate-45" title="Dopend" />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-rose-600 truncate max-w-[40px]">DOP</div>
                  </div>
                </div>
              </div>

              {/* Input tekanan */}
              <div className="relative z-10">
                <label className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3 text-center">Tekanan Saat Ini (bar)</label>
                <div className="relative max-w-[200px] mx-auto">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="20"
                    step="0.01"
                    placeholder="0.00"
                    value={currentTekananVal}
                    onChange={e => updateManometerInput(e.target.value)}
                    className="w-full h-20 px-4 text-4xl font-black text-slate-800 bg-white border-2 border-slate-200/80 rounded-[20px] outline-none focus:border-indigo-500 focus:ring-[6px] focus:ring-indigo-500/15 transition-all text-center placeholder:text-slate-200 shadow-sm"
                  />
                  {currentTekananVal && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">bar</span>}
                </div>
              </div>

              {/* Warning jika < 1 bar */}
              {currentTekananNum !== null && currentTekananNum < 1 && (
                <div className={`mt-6 p-4 rounded-[20px] flex items-start gap-3 shadow-inner animate-in slide-in-from-top-2 fade-in duration-300 border ${
                  currentTekananNum < 0.5
                    ? "bg-gradient-to-r from-red-50 to-pink-50 border-red-200/60"
                    : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/60"
                }`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    currentTekananNum < 0.5 ? "bg-red-100" : "bg-amber-100"
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      currentTekananNum < 0.5 ? "text-red-600" : "text-amber-600"
                    }`} />
                  </div>
                  <div>
                    <p className={`text-[13px] font-extrabold ${currentTekananNum < 0.5 ? "text-red-900" : "text-amber-900"}`}>
                      {currentTekananNum < 0.5 ? "Tekanan KRITIS!" : "Tekanan Rendah!"}
                    </p>
                    <p className={`text-[11px] font-medium leading-relaxed mt-1 ${currentTekananNum < 0.5 ? "text-red-700/80" : "text-amber-700/80"}`}>
                      Level {currentTekananNum} bar {currentTekananNum < 0.5 ? "sangat rendah" : "di bawah normal"}.
                      Aliran ke <strong>{currentManometer.dopendName}</strong> dapat terganggu.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleManometerNext}
              disabled={!currentTekananVal}
              className="group w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-[0_8px_20px_rgba(99,102,241,0.25)] hover:shadow-[0_12px_24px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0 disabled:active:scale-100 disabled:shadow-none"
            >
              {currentManometerIndex < allManometersInOrder.length - 1
                ? <>Lanjut {allManometersInOrder[currentManometerIndex + 1].manometer.name} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                : <>Selesai & Lihat Ringkasan <Check className="h-4 w-4" /></>
              }
            </button>
          </div>
        )}

        {/* ── Step 5: Ringkasan ───────────────────────────────────────── */}
        {step === "ringkasan" && selectedReservoir && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Ringkasan Data</h2>
                <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-widest">Verifikasi Akhir</p>
              </div>
              <button onClick={() => { setCurrentManometerIndex(allManometersInOrder.length - 1); setStep("input-manometer"); }} className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Edit
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl rounded-[28px] border border-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
              {/* Info petugas */}
              <div className="p-4 bg-slate-50/80 rounded-[20px] border border-slate-100 mb-5 relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-indigo-100/50 to-transparent pointer-events-none" />
                <div className="space-y-2 text-xs relative z-10">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Petugas</span>
                    <span className="font-extrabold text-slate-700 text-sm">{petugas}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Waktu</span>
                    <span className="font-bold text-slate-600">{today} · Sesi {sesi === "pagi" ? "Pagi" : "Sore"}</span>
                  </div>
                </div>
              </div>

              {/* Reservoir */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Reservoir Utama</span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-[20px] border border-blue-100 shadow-inner flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{selectedReservoir.name}</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Batas waspada: 100 cm</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black ${
                      (Number(tinggiAirInput) || 0) < 100 ? "text-amber-500" : "text-emerald-500"
                    }`}>
                      {tinggiAirInput}
                    </span>
                    <span className="text-xs font-bold text-slate-400 ml-1">cm</span>
                  </div>
                </div>
              </div>

              {/* Manometers */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-purple-500" />
                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Titik Manometer ({manometerInputs.length})</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {manometerInputs.map(mi => {
                    const man = MANOMETERS.find(m => m.id === mi.id);
                    const val = mi.tekanan ? Number(mi.tekanan) : null;
                    const st = getManometerStatus(val);
                    return (
                      <div key={mi.id} className="p-3.5 bg-white rounded-[16px] border border-slate-200/70 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{man?.name ?? mi.id}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">KM {man?.posisiKm}</p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className={`block text-[10px] font-bold px-2 py-1 rounded-md ${
                            st === "normal" ? "bg-emerald-50 text-emerald-600" :
                            st === "waspada" ? "bg-amber-50 text-amber-600" :
                            st === "kritis" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"
                          }`}>
                            {STATUS_LABELS[st]}
                          </span>
                          <span className="text-sm font-black w-14 text-right" style={{ color: STATUS_COLORS[st] }}>
                            {mi.tekanan || "—"} <span className="text-[10px] opacity-60">bar</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              className="group w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-bold shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_24px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 relative overflow-hidden"
            >
              {/* Shine effect */}
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-[shine_1s]" />
              <Send className="h-4 w-4" /> Konfirmasi & Kirim Data
            </button>
          </div>
        )}

        {/* ── Step 6: Selesai ─────────────────────────────────────────── */}
        {step === "selesai" && (
          <div className="p-6 pt-16 text-center space-y-8 animate-in zoom-in-95 fade-in duration-500">
            <div className="flex justify-center relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-[40px] opacity-30 animate-pulse" />
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-inner border border-white">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 drop-shadow-sm" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sukses Terkirim!</h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-[250px] mx-auto">
                Laporan kondisi pengaliran dari <strong>{selectedReservoir?.name}</strong> telah diperbarui.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={resetForm}
                className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300"
              >
                <Droplets className="h-4 w-4" /> Input Reservoir Lain
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all duration-300 shadow-sm"
              >
                <Home className="h-4 w-4 text-slate-400" /> Kembali ke Beranda
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        /* Hide scrollbar for stepper */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes shine {
          100% { left: 125%; }
        }
      `}</style>
    </div>
  );
}
