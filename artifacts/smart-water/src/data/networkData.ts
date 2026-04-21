/**
 * networkData.ts
 * Data dummy struktur jaringan distribusi air PDAM TIARA
 * Reservoir → Pipa → Manometer → Dopend
 * Koordinat disesuaikan dengan area Lombok Tengah, NTB
 */

// ─── Types ──────────────────────────────────────────────────────────────────
export interface Reservoir {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tinggiAir: number;       // cm
  kapasitas: number;       // cm (max)
  status: "normal" | "waspada" | "kritis";
}

export interface Dopend {
  id: string;
  name: string;
  lat: number;
  lng: number;
  reservoirId: string;     // FK ke reservoir
}

export type ManometerStatus = "normal" | "waspada" | "kritis" | "belum_input";

export interface Manometer {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tekanan: number | null;  // bar, null = belum diinput
  status: ManometerStatus;
  jalurId: string;         // FK ke jalur
  posisiKm: number;        // posisi KM di jalur
  urutanDiJalur: number;   // urutan 1, 2, 3... di jalur
}

export interface JalurPipa {
  id: string;
  reservoirId: string;
  dopendId: string;
  manometerIds: string[];  // urutan manometer dari reservoir ke dopend
}

// ─── Dummy Data ─────────────────────────────────────────────────────────────

export const RESERVOIRS: Reservoir[] = [
  {
    id: "RES-01",
    name: "Reservoir Induk IPA",
    lat: -8.7150,
    lng: 116.2850,
    tinggiAir: 280,
    kapasitas: 400,
    status: "normal",
  },
  {
    id: "RES-02",
    name: "Reservoir Airbaku",
    lat: -8.7020,
    lng: 116.3100,
    tinggiAir: 310,
    kapasitas: 400,
    status: "normal",
  },
  {
    id: "RES-03",
    name: "Reservoir Pagesangan",
    lat: -8.7280,
    lng: 116.2700,
    tinggiAir: 85,
    kapasitas: 350,
    status: "waspada",
  },
];

export const DOPENDS: Dopend[] = [
  {
    id: "DOP-01",
    name: "Dopend Praya Kota",
    lat: -8.7350,
    lng: 116.2950,
    reservoirId: "RES-01",
  },
  {
    id: "DOP-02",
    name: "Dopend Montong Batu",
    lat: -8.7250,
    lng: 116.3150,
    reservoirId: "RES-01",
  },
  {
    id: "DOP-03",
    name: "Dopend Batujai",
    lat: -8.7180,
    lng: 116.3350,
    reservoirId: "RES-02",
  },
  {
    id: "DOP-04",
    name: "Dopend Pagesangan",
    lat: -8.7450,
    lng: 116.2600,
    reservoirId: "RES-03",
  },
];

export const MANOMETERS: Manometer[] = [
  // Jalur: Reservoir Induk IPA → Dopend Praya Kota (3 manometer)
  {
    id: "MAN-01",
    name: "Manometer Simpang Praya 1",
    lat: -8.7200,
    lng: 116.2870,
    tekanan: 4.2,
    status: "normal",
    jalurId: "JALUR-01",
    posisiKm: 1.2,
    urutanDiJalur: 1,
  },
  {
    id: "MAN-02",
    name: "Manometer Jl. Gajah Mada",
    lat: -8.7260,
    lng: 116.2900,
    tekanan: 0.8,
    status: "waspada",
    jalurId: "JALUR-01",
    posisiKm: 2.5,
    urutanDiJalur: 2,
  },
  {
    id: "MAN-03",
    name: "Manometer Pasar Praya",
    lat: -8.7310,
    lng: 116.2930,
    tekanan: 1.5,
    status: "normal",
    jalurId: "JALUR-01",
    posisiKm: 3.8,
    urutanDiJalur: 3,
  },

  // Jalur: Reservoir Induk IPA → Dopend Montong Batu (2 manometer)
  {
    id: "MAN-04",
    name: "Manometer Pertigaan Montong",
    lat: -8.7190,
    lng: 116.2980,
    tekanan: 3.1,
    status: "normal",
    jalurId: "JALUR-02",
    posisiKm: 1.5,
    urutanDiJalur: 1,
  },
  {
    id: "MAN-05",
    name: "Manometer Montong Batu Utara",
    lat: -8.7220,
    lng: 116.3070,
    tekanan: 0.4,
    status: "kritis",
    jalurId: "JALUR-02",
    posisiKm: 3.0,
    urutanDiJalur: 2,
  },

  // Jalur: Reservoir Airbaku → Dopend Batujai (2 manometer)
  {
    id: "MAN-06",
    name: "Manometer Jl. Airbaku Timur",
    lat: -8.7080,
    lng: 116.3180,
    tekanan: 5.0,
    status: "normal",
    jalurId: "JALUR-03",
    posisiKm: 1.0,
    urutanDiJalur: 1,
  },
  {
    id: "MAN-07",
    name: "Manometer Batujai Barat",
    lat: -8.7130,
    lng: 116.3270,
    tekanan: 2.8,
    status: "normal",
    jalurId: "JALUR-03",
    posisiKm: 2.3,
    urutanDiJalur: 2,
  },

  // Jalur: Reservoir Pagesangan → Dopend Pagesangan (2 manometer)
  {
    id: "MAN-08",
    name: "Manometer Pagesangan Hulu",
    lat: -8.7340,
    lng: 116.2670,
    tekanan: 3.5,
    status: "normal",
    jalurId: "JALUR-04",
    posisiKm: 0.8,
    urutanDiJalur: 1,
  },
  {
    id: "MAN-09",
    name: "Manometer Pagesangan Hilir",
    lat: -8.7400,
    lng: 116.2630,
    tekanan: 1.2,
    status: "normal",
    jalurId: "JALUR-04",
    posisiKm: 1.8,
    urutanDiJalur: 2,
  },
];

export const JALUR_PIPA: JalurPipa[] = [
  {
    id: "JALUR-01",
    reservoirId: "RES-01",
    dopendId: "DOP-01",
    manometerIds: ["MAN-01", "MAN-02", "MAN-03"],
  },
  {
    id: "JALUR-02",
    reservoirId: "RES-01",
    dopendId: "DOP-02",
    manometerIds: ["MAN-04", "MAN-05"],
  },
  {
    id: "JALUR-03",
    reservoirId: "RES-02",
    dopendId: "DOP-03",
    manometerIds: ["MAN-06", "MAN-07"],
  },
  {
    id: "JALUR-04",
    reservoirId: "RES-03",
    dopendId: "DOP-04",
    manometerIds: ["MAN-08", "MAN-09"],
  },
];

// ─── Helper Functions ───────────────────────────────────────────────────────

/** Determine manometer status from pressure value */
export function getManometerStatus(tekanan: number | null): ManometerStatus {
  if (tekanan == null) return "belum_input";
  if (tekanan < 0.5) return "kritis";
  if (tekanan < 1.0) return "waspada";
  return "normal";
}

/** Get the worst status among manometers in a route */
export function getWorstStatusInJalur(jalurId: string): ManometerStatus {
  const jalur = JALUR_PIPA.find(j => j.id === jalurId);
  if (!jalur) return "belum_input";
  
  const manometers = jalur.manometerIds
    .map(id => MANOMETERS.find(m => m.id === id))
    .filter(Boolean) as Manometer[];
  
  if (manometers.some(m => m.status === "kritis")) return "kritis";
  if (manometers.some(m => m.status === "waspada")) return "waspada";
  if (manometers.some(m => m.status === "belum_input")) return "belum_input";
  return "normal";
}

/** Get affected area (dopend) downstream from a problematic manometer */
export function getAffectedArea(manometerId: string): string | null {
  const jalur = JALUR_PIPA.find(j => j.manometerIds.includes(manometerId));
  if (!jalur) return null;
  const dopend = DOPENDS.find(d => d.id === jalur.dopendId);
  return dopend?.name ?? null;
}

/** Get reservoir object by ID */
export function getReservoir(id: string): Reservoir | undefined {
  return RESERVOIRS.find(r => r.id === id);
}

/** Get dopend object by ID */
export function getDopend(id: string): Dopend | undefined {
  return DOPENDS.find(d => d.id === id);
}

/** Get manometer object by ID */
export function getManometer(id: string): Manometer | undefined {
  return MANOMETERS.find(m => m.id === id);
}

/** Get all manometers for a specific jalur (route), ordered */
export function getManometersForJalur(jalurId: string): Manometer[] {
  const jalur = JALUR_PIPA.find(j => j.id === jalurId);
  if (!jalur) return [];
  return jalur.manometerIds
    .map(id => MANOMETERS.find(m => m.id === id))
    .filter(Boolean) as Manometer[];
}

/** Get all jalur (routes) from a reservoir */
export function getJalurForReservoir(reservoirId: string): JalurPipa[] {
  return JALUR_PIPA.filter(j => j.reservoirId === reservoirId);
}

/** Get all problematic manometers (waspada or kritis) */
export function getProblematicManometers(): Manometer[] {
  return MANOMETERS.filter(m => m.status === "kritis" || m.status === "waspada");
}

/** Get critical manometers only */
export function getCriticalManometers(): Manometer[] {
  return MANOMETERS.filter(m => m.status === "kritis");
}

/** Build pipe coordinates for a jalur: [reservoir] → [manometer1] → ... → [dopend] */
export function getJalurCoordinates(jalurId: string): [number, number][] {
  const jalur = JALUR_PIPA.find(j => j.id === jalurId);
  if (!jalur) return [];

  const reservoir = getReservoir(jalur.reservoirId);
  const dopend = getDopend(jalur.dopendId);
  if (!reservoir || !dopend) return [];

  const manometers = getManometersForJalur(jalurId);

  const coords: [number, number][] = [
    [reservoir.lat, reservoir.lng],
    ...manometers.map(m => [m.lat, m.lng] as [number, number]),
    [dopend.lat, dopend.lng],
  ];

  return coords;
}

/** Status color mapping */
export const STATUS_COLORS: Record<ManometerStatus, string> = {
  normal: "#22c55e",
  waspada: "#f59e0b",
  kritis: "#ef4444",
  belum_input: "#9ca3af",
};

/** Status label mapping */
export const STATUS_LABELS: Record<ManometerStatus, string> = {
  normal: "Normal",
  waspada: "Waspada",
  kritis: "Kritis",
  belum_input: "Belum Input",
};

/** Reservoir status color */
export const RESERVOIR_STATUS_COLORS: Record<Reservoir["status"], string> = {
  normal: "#22c55e",
  waspada: "#f59e0b",
  kritis: "#ef4444",
};
