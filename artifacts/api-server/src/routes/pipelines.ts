import { Router, type IRouter } from "express";
import { db, valvesTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * Reservoir SPAM Aiq Bone — titik asal (source) jaringan radial.
 * Koordinat [lng, lat] format GeoJSON.
 *
 * ATURAN TOPOLOGI:
 *   Setiap LineString yang dihasilkan SELALU dimulai dari koordinat reservoir ini.
 *   Titik kedua (akhir) adalah koordinat masing-masing valve.
 *   Hasilnya adalah pola radial: satu sumber → banyak valve.
 */
const RESERVOIR = {
  id: "RES-SPAM-AIQ-BONE",
  name: "Reservoir SPAM Aiq Bone",
  /** [longitude, latitude] — sesuai spesifikasi GeoJSON */
  coordinates: [116.29, -8.64] as [number, number],
} as const;

// ─── GET /api/pipelines/geojson ──────────────────────────────────────────────
// Mengembalikan FeatureCollection berisi N LineString (radial).
// Setiap LineString = [Reservoir → Valve_i].
// Titik PERTAMA semua LineString adalah koordinat RESERVOIR (identik).
router.get("/pipelines/geojson", async (_req, res): Promise<void> => {
  const valves = await db
    .select()
    .from(valvesTable)
    .orderBy(valvesTable.id);

  const features = valves.map((valve, index) => ({
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: [
        // ── Titik PERTAMA: Reservoir (sama untuk semua LineString) ──
        RESERVOIR.coordinates,
        // ── Titik KEDUA: koordinat valve tujuan ──
        [valve.lng, valve.lat] as [number, number],
      ],
    },
    properties: {
      id: `PIPE-RADIAL-${String(index + 1).padStart(2, "0")}`,
      name: `Pipa ${RESERVOIR.name} → ${valve.name}`,
      from_node: RESERVOIR.id,
      from_name: RESERVOIR.name,
      from_coordinates: RESERVOIR.coordinates,
      to_node: valve.valveId,
      to_name: valve.name,
      to_coordinates: [valve.lng, valve.lat],
      targetValveId: valve.valveId,
      diameter_mm: 300,
      material: "PVC",
      topology: "radial",
      pressure_at_valve: valve.pressure,
      status_at_valve: valve.status,
    },
  }));

  res.json({
    type: "FeatureCollection",
    name: "Jaringan Radial SPAM Aiq Bone",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
    },
    reservoir: {
      id: RESERVOIR.id,
      name: RESERVOIR.name,
      coordinates: RESERVOIR.coordinates,
    },
    features,
  });
});

export default router;