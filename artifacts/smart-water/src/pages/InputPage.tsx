/**
 * InputPage.tsx
 * Halaman form input khusus petugas lapangan — mobile-first, clean UI
 * Alur: Identitas → Pilih Reservoir → Dashboard Titik (Grid Acak) → Form Titik → Selesai
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertTriangle,
  Droplets, Gauge, User, Clock, Send, Home, BarChart3,
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
import { useNetworkNodeNames } from "@/hooks/useNetworkNodes";

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = "identitas" | "pilih-reservoir" | "dashboard-titik" | "form-titik" | "selesai";

// ─── Petugas names (dummy) ──────────────────────────────────────────────────
const PETUGAS_LIST = [
  "Ari Baskara", "Hendra", "Doni Ndut"
];

// ─── Component ──────────────────────────────────────────────────────────────
export default function InputPage() {
  const [, navigate] = useLocation();
  const [macroUrl] = useLocalStorage<string>("gis-macro-url", "");
  const { data: customNames } = useNetworkNodeNames();

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
  const [targetPointId, setTargetPointId] = useState<string | null>(null);

  // Inputs State
  const [tinggiAirInput, setTinggiAirInput] = useState("");
  const [manometerInputs, setManometerInputs] = useState<Record<string, string>>({});

  const selectedReservoir = useMemo(() => {
    if (!selectedReservoirId) return null;
    const r = getReservoir(selectedReservoirId);
    if (!r) return null;
    return { ...r, name: customNames?.[r.id] || r.name };
  }, [selectedReservoirId, customNames]);
  
  const jalurList = useMemo(() => {
    if (!selectedReservoirId) return [];
    return getJalurForReservoir(selectedReservoirId);
  }, [selectedReservoirId]);

  const allManometersInOrder = useMemo(() => {
    const result: { manometer: Manometer; jalurIndex: number; dopendName: string }[] = [];
    jalurList.forEach((jalur, ji) => {
      const manometers = getManometersForJalur(jalur.id);
      const dopend = getDopend(jalur.dopendId);
      const dName = dopend ? (customNames?.[dopend.id] || dopend.name) : "?";
      manometers.forEach(m => {
        result.push({ manometer: { ...m, name: customNames?.[m.id] || m.name }, jalurIndex: ji, dopendName: dName });
      });
    });
    return result;
  }, [jalurList, customNames]);

  // ─── Auto-routing dari Map ────────────────────────────────────────────────
  useEffect(() => {
    const pendingPoint = localStorage.getItem('pending_input_point');
    if (pendingPoint) {
      localStorage.removeItem('pending_input_point');
      setPetugas(PETUGAS_LIST[0]);
      
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
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate("/")} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Input Data Lapangan</h1>
              <p className="text-[10px] text-slate-400">{petugas || "Belum login"} · {sesi === "pagi" ? "Pagi" : "Sore"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate("/")} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors">
              <MapIcon className="h-4 w-4" />
            </button>
            <button onClick={() => navigate("/dashboard")} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-blue-500" : "bg-slate-200"}`} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-semibold text-blue-600">{steps[stepIndex]?.label}</span>
            <span className="text-[10px] text-slate-400">{stepIndex + 1}/{steps.length}</span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 pb-28">
        
        {/* ── Step 1: Identitas ───────────────────────────────────────── */}
        {step === "identitas" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Identitas Petugas</h2>
                  <p className="text-[11px] text-slate-400">Lengkapi sebelum mulai shift</p>
                </div>
              </div>

              {/* Tanggal */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Tanggal</label>
                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {today}
                </div>
              </div>

              {/* Nama Petugas */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Nama Petugas</label>
                <select
                  value={petugas}
                  onChange={e => setPetugas(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none transition-colors appearance-none"
                >
                  <option value="" disabled>Pilih nama Anda...</option>
                  {PETUGAS_LIST.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* Sesi */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Sesi Shift</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["pagi", "sore"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSesi(s)}
                      className={`flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-semibold border transition-colors ${
                        sesi === s
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {s === "pagi" ? "☀️" : "🌙"} {s === "pagi" ? "Pagi" : "Sore"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("pilih-reservoir")}
              disabled={!petugas}
              className="w-full flex items-center justify-center gap-1.5 h-11 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Lanjut <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Step 2: Pilih Reservoir ──────────────────────────────────── */}
        {step === "pilih-reservoir" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-base font-bold text-slate-800">Pilih Reservoir</h2>
                <p className="text-[11px] text-slate-400">Pilih titik reservoir sumber</p>
              </div>
              <button onClick={() => setStep("identitas")} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                ← Kembali
              </button>
            </div>

            <div className="space-y-2">
              {RESERVOIRS.map(r => {
                const jalurs = getJalurForReservoir(r.id);
                const manCount = jalurs.reduce((acc, j) => acc + getManometersForJalur(j.id).length, 0);
                const stColor = r.status === "normal" ? "#16a34a" : r.status === "waspada" ? "#d97706" : "#dc2626";
                const rName = customNames?.[r.id] || r.name;

                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectReservoir(r.id)}
                    className="w-full bg-white rounded-lg border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Droplets className="h-4.5 w-4.5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">{rName}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: stColor, background: `${stColor}14` }}>
                              {r.tinggiAir} cm · {r.status === "normal" ? "Normal" : r.status === "waspada" ? "Waspada" : "Kritis"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Activity className="h-3 w-3" /> {jalurs.length} jalur · {manCount} manometer
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Dashboard Titik ──────────────────────────────────── */}
        {step === "dashboard-titik" && selectedReservoir && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Titik Pengukuran</h2>
                <p className="text-[11px] text-slate-400">Pilih titik untuk input data</p>
              </div>
              <button onClick={() => setStep("pilih-reservoir")} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Kembali
              </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              {/* Reservoir Card */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Droplets className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reservoir</span>
                </div>
                <button onClick={() => openForm(selectedReservoir.id)} className="w-full text-left p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center hover:border-blue-300 transition-colors">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700">{selectedReservoir.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Batas waspada: 100 cm</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tinggiAirInput ? (
                      <>
                        <span className={`text-sm font-bold ${Number(tinggiAirInput) < 100 ? "text-amber-500" : "text-emerald-600"}`}>{tinggiAirInput} cm</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                        <Edit3 className="h-3 w-3" /> Input
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Manometers */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Gauge className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manometer ({allManometersInOrder.length})</span>
                </div>
                <div className="space-y-1.5">
                  {allManometersInOrder.map(({manometer, dopendName}) => {
                    const val = manometerInputs[manometer.id];
                    const numVal = val ? Number(val) : null;
                    const st = getManometerStatus(numVal);
                    
                    return (
                      <button 
                        key={manometer.id} 
                        onClick={() => openForm(manometer.id)}
                        className={`w-full p-3 bg-white rounded-lg border ${val ? "border-emerald-200" : "border-slate-200"} flex items-center justify-between hover:border-blue-300 transition-colors text-left`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{manometer.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">→ {dopendName} · KM {manometer.posisiKm}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {val ? (
                            <>
                              <span className="text-xs font-bold" style={{ color: STATUS_COLORS[st] }}>
                                {val} bar
                              </span>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded flex items-center gap-1">
                              <Edit3 className="h-3 w-3" /> Input
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 z-50">
              <button
                onClick={handleSubmit}
                className="w-full max-w-md mx-auto flex items-center justify-center gap-1.5 h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Kirim Data ({Object.keys(manometerInputs).filter(k => manometerInputs[k]).length + (tinggiAirInput ? 1 : 0)} terisi)
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Form Input Titik ───────────────────────────────── */}
        {step === "form-titik" && selectedReservoir && targetPointId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={closeForm} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Kembali
              </button>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                {isFormReservoir ? "Reservoir" : "Manometer"}
              </span>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isFormReservoir ? "bg-blue-50" : "bg-indigo-50"}`}>
                  {isFormReservoir ? <Droplets className="h-5 w-5 text-blue-600" /> : <Gauge className="h-5 w-5 text-indigo-600" />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    {isFormReservoir ? selectedReservoir.name : targetManometerInfo?.manometer.name}
                  </h2>
                  <p className="text-[10px] text-slate-400">Pengukuran saat ini</p>
                </div>
              </div>

              {/* Detail Info untuk Manometer */}
              {!isFormReservoir && targetManometerInfo && (
                <div className="mb-5 grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                     <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Jalur</p>
                     <p className="text-xs font-semibold text-slate-700 truncate">→ {targetManometerInfo.dopendName}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                     <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Posisi</p>
                     <p className="text-xs font-semibold text-slate-700">KM {targetManometerInfo.manometer.posisiKm}</p>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-2 text-center">
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
                    className="w-full h-16 px-4 text-3xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none transition-colors text-center placeholder:text-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
                  />
                  {(isFormReservoir ? tinggiAirInput : currentTekananVal) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                      {isFormReservoir ? "cm" : "bar"}
                    </span>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {!isFormReservoir && currentTekananNum !== null && currentTekananNum < 1 && (
                <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 border-l-[3px] ${currentTekananNum < 0.5 ? "bg-red-50 border-l-red-500" : "bg-amber-50 border-l-amber-500"}`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${currentTekananNum < 0.5 ? "text-red-500" : "text-amber-500"}`} />
                  <div>
                    <p className={`text-xs font-bold ${currentTekananNum < 0.5 ? "text-red-800" : "text-amber-800"}`}>{currentTekananNum < 0.5 ? "Tekanan Kritis" : "Tekanan Rendah"}</p>
                    <p className={`text-[10px] mt-0.5 ${currentTekananNum < 0.5 ? "text-red-600" : "text-amber-600"}`}>
                      Distribusi ke {targetManometerInfo?.dopendName} dapat terganggu.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={closeForm}
              className={`w-full flex items-center justify-center gap-1.5 h-11 rounded-lg text-white text-xs font-bold transition-colors ${
                isFormReservoir ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              Simpan <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Step 5: Selesai ─────────────────────────────────────────── */}
        {step === "selesai" && (
          <div className="text-center py-12 space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-bold text-slate-800">Data Terkirim</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                Data pengukuran <strong>{selectedReservoir?.name}</strong> berhasil dikirim ke server.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button onClick={resetForm} className="w-full flex items-center justify-center gap-1.5 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">
                <Droplets className="h-3.5 w-3.5" /> Input Reservoir Lain
              </button>
              <button onClick={() => navigate("/")} className="w-full flex items-center justify-center gap-1.5 h-11 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">
                <Home className="h-3.5 w-3.5" /> Kembali ke Peta
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
