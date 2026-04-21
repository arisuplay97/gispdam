/**
 * InputPage.tsx
 * Halaman form input khusus petugas lapangan — mobile-first
 * Alur: Identitas → Pilih Reservoir → Dashboard Titik (Grid Acak) → Form Titik → Selesai
 * UI: Modern, premium glassmorphism & soft shadows (Dribbble style)
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertTriangle,
  Droplets, Gauge, MapPin, User, Clock, Send, Home, BarChart3,
  Map as MapIcon, ChevronRight, Activity, Edit3
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
type Step = "identitas" | "pilih-reservoir" | "dashboard-titik" | "form-titik" | "selesai";

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

  // Flow State
  const [selectedReservoirId, setSelectedReservoirId] = useState<string | null>(null);
  const [targetPointId, setTargetPointId] = useState<string | null>(null); // To know which form to open

  // Inputs State
  const [tinggiAirInput, setTinggiAirInput] = useState("");
  const [manometerInputs, setManometerInputs] = useState<Record<string, string>>({});

  const selectedReservoir = selectedReservoirId ? getReservoir(selectedReservoirId) : null;
  
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

  // ─── Auto-routing dari Map ────────────────────────────────────────────────
  useEffect(() => {
    const pendingPoint = localStorage.getItem('pending_input_point');
    if (pendingPoint) {
      localStorage.removeItem('pending_input_point');
      setPetugas(PETUGAS_LIST[0]); // Set default petugas as bypass
      
      const res = getReservoir(pendingPoint);
      if (res) {
        setSelectedReservoirId(res.id);
        setTargetPointId(res.id);
        setStep("form-titik");
      } else {
        const man = MANOMETERS.find(m => m.id === pendingPoint);
        if (man) {
          const jalur = JALUR_PIPA.find(j => j.manometerIds.includes(man.id));
          if (jalur) {
            setSelectedReservoirId(jalur.reservoirId);
            setTargetPointId(man.id);
            setStep("form-titik");
          }
        }
      }
    }
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectReservoir = (id: string) => {
    setSelectedReservoirId(id);
    setStep("dashboard-titik");
  };

  const openForm = (id: string) => {
    setTargetPointId(id);
    setStep("form-titik");
  };

  const closeForm = () => {
    setTargetPointId(null);
    setStep("dashboard-titik");
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedReservoir) return;
    const todayStr = new Date().toISOString().split("T")[0];

    // Kirim reservoir jika ada isinya
    if (tinggiAirInput) {
      try {
        await fetch("/api/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pointId: selectedReservoir.id,
            session: sesi,
            date: todayStr,
            tinggiAir: Number(tinggiAirInput),
            tekanan: null,
          }),
        });
      } catch (e) {
        console.error("Failed to save reservoir data:", e);
      }
    }

    // Kirim manometer yang diisi
    for (const [mId, val] of Object.entries(manometerInputs)) {
      if (!val) continue;
      try {
        await fetch("/api/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pointId: mId,
            session: sesi,
            date: todayStr,
            tinggiAir: null,
            tekanan: Number(val),
          }),
        });
      } catch (e) {
        console.error("Failed to save manometer data:", e);
      }
    }

    // Spreadsheet Bypass
    if (macroUrl?.trim().startsWith("https://script.google.com/")) {
      try {
        if (tinggiAirInput) {
           await fetch(macroUrl.trim(), {
             method: "POST",
             headers: { "Content-Type": "text/plain;charset=utf-8" },
             body: JSON.stringify({
               lokasi: selectedReservoir.name,
               sesi,
               tinggiAir: tinggiAirInput,
               tekanan: "",
               petugas,
               tipe: "reservoir",
             }),
           });
        }
        for (const [mId, val] of Object.entries(manometerInputs)) {
          if (!val) continue;
          const man = MANOMETERS.find(m => m.id === mId);
          await fetch(macroUrl.trim(), {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              lokasi: man?.name ?? mId,
              sesi,
              tinggiAir: "",
              tekanan: val,
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
    setManometerInputs({});
  };

  // ─── Variables for Form Titik ─────────────────────────────────────────────
  const isFormReservoir = targetPointId === selectedReservoirId;
  const targetManometerInfo = isFormReservoir ? null : allManometersInOrder.find(m => m.manometer.id === targetPointId);
  const currentTekananVal = isFormReservoir ? "" : (targetPointId ? (manometerInputs[targetPointId] ?? "") : "");
  const currentTekananNum = currentTekananVal ? Number(currentTekananVal) : null;
  const tinggiAirNum = tinggiAirInput ? Number(tinggiAirInput) : null;

  // ─── Stepper progress ─────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: "identitas", label: "Petugas" },
    { key: "pilih-reservoir", label: "Reservoir" },
    { key: "dashboard-titik", label: "Titik" },
    { key: "form-titik", label: "Input" },
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
                  i <= stepIndex 
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

      <main className="max-w-md mx-auto px-4 py-8 relative z-10 transition-all duration-500 pb-28">
        
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

        {/* ── Step 3: Dashboard Titik (Grid Acak) ──────────────────────── */}
        {step === "dashboard-titik" && selectedReservoir && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Kondisi Saat Ini</h2>
                <p className="text-[11px] text-slate-500 font-medium mt-1">Pilih titik untuk diinput</p>
              </div>
              <button onClick={() => setStep("pilih-reservoir")} className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Kembali
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl rounded-[28px] border border-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
              {/* Reservoir Card */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Reservoir Utama</span>
                </div>
                <button onClick={() => openForm(selectedReservoir.id)} className="w-full text-left p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-[20px] border border-blue-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{selectedReservoir.name}</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Batas waspada: 100 cm</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {tinggiAirInput ? (
                        <>
                          <div>
                            <span className={`text-xl font-black ${Number(tinggiAirInput) < 100 ? "text-amber-500" : "text-emerald-500"}`}>{tinggiAirInput}</span>
                            <span className="text-[10px] font-bold text-slate-400 ml-1">cm</span>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </>
                    ) : (
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Edit3 className="h-3 w-3" /> Input
                        </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Manometers Grid */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-purple-500" />
                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">Titik Manometer ({allManometersInOrder.length})</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {allManometersInOrder.map(({manometer, dopendName}) => {
                    const val = manometerInputs[manometer.id];
                    const numVal = val ? Number(val) : null;
                    const st = getManometerStatus(numVal);
                    
                    return (
                      <button 
                        key={manometer.id} 
                        onClick={() => openForm(manometer.id)}
                        className={`w-full p-3.5 bg-white rounded-[16px] border ${val ? "border-emerald-200 bg-emerald-50/10" : "border-slate-200/70"} shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-colors block text-left`}
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">{manometer.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[150px]">Jalur {dopendName} · KM {manometer.posisiKm}</p>
                        </div>
                        <div className="text-right flex items-center gap-3 shrink-0">
                          {val ? (
                            <>
                              <span className={`text-base font-black`} style={{ color: STATUS_COLORS[st] }}>
                                {val} <span className="text-[10px] opacity-60">bar</span>
                              </span>
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </>
                          ) : (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                              <Edit3 className="h-3 w-3 text-slate-400" /> Input
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Floating Submit Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-50">
              <button
                onClick={handleSubmit}
                className="group w-full max-w-md mx-auto flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_24px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 relative overflow-hidden"
              >
                {/* Shine effect */}
                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-[shine_1s]" />
                <Send className="h-4 w-4" /> Kiri Data ({Object.keys(manometerInputs).length + (tinggiAirInput ? 1 : 0)} Terisi)
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Form Input Titik ───────────────────────────────── */}
        {step === "form-titik" && selectedReservoir && targetPointId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
            <div className="flex items-center justify-between px-1">
              <button onClick={closeForm} className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95 flex items-center gap-1">
                 <ArrowLeft className="h-3 w-3" /> Batal
              </button>
              <div className="text-[10px] font-extrabold text-indigo-700 tracking-wider bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                 Mode {isFormReservoir ? "Reservoir" : "Manometer"}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl rounded-[28px] border border-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
               {/* Subtle background glow */}
               <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none blur-[50px] opacity-20 transition-colors duration-500 ${
                 isFormReservoir ? "bg-blue-500" :
                 (currentTekananNum !== null && currentTekananNum < 0.5 ? "bg-red-500" : 
                 currentTekananNum !== null && currentTekananNum < 1 ? "bg-amber-500" : 
                 currentTekananNum !== null ? "bg-emerald-500" : "bg-indigo-400")
               }`} />

              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className={`h-14 w-14 rounded-[16px] bg-gradient-to-br flex items-center justify-center ${
                  isFormReservoir ? "from-blue-500 to-blue-600 shadow-blue-500/30" : "from-indigo-500 to-purple-600 shadow-indigo-500/30"
                } shadow-md`}>
                  {isFormReservoir ? <Droplets className="h-6 w-6 text-white" /> : <Gauge className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isFormReservoir ? "text-blue-500" : "text-indigo-500"}`}>
                    Pengukuran Saat Ini
                  </p>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                    {isFormReservoir ? selectedReservoir.name : targetManometerInfo?.manometer.name}
                  </h2>
                </div>
              </div>

              {/* Detail Info untuk Manometer */}
              {!isFormReservoir && targetManometerInfo && (
                <div className="mb-6 grid grid-cols-2 gap-3 relative z-10">
                  <div className="p-3 bg-slate-50 rounded-[16px] border border-slate-100 shadow-inner">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jalur Distribusi</p>
                     <p className="text-xs font-bold text-slate-700 truncate">Ke {targetManometerInfo.dopendName}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-[16px] border border-slate-100 shadow-inner">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Posisi KM</p>
                     <p className="text-xs font-bold text-slate-700">KM {targetManometerInfo.manometer.posisiKm}</p>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="relative z-10">
                <label className="block text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3 text-center">
                  {isFormReservoir ? "Tinggi Air (cm)" : "Tekanan (bar)"}
                </label>
                <div className="relative max-w-[200px] mx-auto">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={isFormReservoir ? "999" : "20"}
                    step={isFormReservoir ? "0.1" : "0.01"}
                    placeholder={isFormReservoir ? "0.0" : "0.00"}
                    value={isFormReservoir ? tinggiAirInput : currentTekananVal}
                    onChange={e => {
                      if (isFormReservoir) {
                        setTinggiAirInput(e.target.value);
                      } else {
                        setManometerInputs(prev => ({ ...prev, [targetPointId]: e.target.value }));
                      }
                    }}
                    className={`w-full h-20 px-4 text-4xl font-black text-slate-800 bg-white border-2 border-slate-200/80 rounded-[20px] outline-none transition-all text-center placeholder:text-slate-200 shadow-sm focus:ring-[6px] ${
                      isFormReservoir ? "focus:border-blue-500 focus:ring-blue-500/15" : "focus:border-indigo-500 focus:ring-indigo-500/15"
                    }`}
                  />
                  {(isFormReservoir ? tinggiAirInput : currentTekananVal) && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                      {isFormReservoir ? "cm" : "bar"}
                    </span>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {!isFormReservoir && currentTekananNum !== null && currentTekananNum < 1 && (
                <div className={`mt-6 p-4 rounded-[20px] flex items-start gap-3 shadow-inner animate-in slide-in-from-top-2 fade-in duration-300 border ${currentTekananNum < 0.5 ? "bg-red-50 border-red-200/60" : "bg-amber-50 border-amber-200/60"}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${currentTekananNum < 0.5 ? "bg-red-100" : "bg-amber-100"}`}>
                    <AlertTriangle className={`h-4 w-4 ${currentTekananNum < 0.5 ? "text-red-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <p className={`text-[13px] font-extrabold ${currentTekananNum < 0.5 ? "text-red-900" : "text-amber-900"}`}>{currentTekananNum < 0.5 ? "Tekanan KRITIS!" : "Tekanan Rendah!"}</p>
                    <p className={`text-[11px] font-medium leading-relaxed mt-1 ${currentTekananNum < 0.5 ? "text-red-700/80" : "text-amber-700/80"}`}>
                      Aliran ke <strong>{targetManometerInfo?.dopendName}</strong> dapat terganggu.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={closeForm}
              className={`group w-full flex items-center justify-center gap-2 h-14 rounded-2xl text-white text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:grayscale ${
                isFormReservoir ? "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/25" : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/25"
              }`}
            >
              Simpan Input <Check className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step 5: Selesai ─────────────────────────────────────────── */}
        {step === "selesai" && (
          <div className="p-6 pt-16 text-center space-y-8 animate-in zoom-in-95 fade-in duration-500 relative z-10 bg-white/80 backdrop-blur-2xl rounded-3xl pb-16">
            <div className="flex justify-center relative">
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-[40px] opacity-30 animate-pulse" />
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-inner border border-white">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 drop-shadow-sm" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sukses Terkirim!</h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-[250px] mx-auto">
                Data terbaru pengaliran <strong>{selectedReservoir?.name}</strong> berhasil dikirim ke server.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <button onClick={resetForm} className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg transition-all duration-300 active:scale-[0.98]">
                <Droplets className="h-4 w-4" /> Input Reservoir Lain
              </button>
              <button onClick={() => navigate("/")} className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold active:scale-[0.98] transition-all shadow-sm">
                <Home className="h-4 w-4 text-slate-400" /> Kembali ke Beranda
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        /* Hide scrollbar for stepper */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shine { 100% { left: 125%; } }
      `}</style>
    </div>
  );
}
