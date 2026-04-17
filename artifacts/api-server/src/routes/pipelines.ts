import { Router, type IRouter } from "express";
import { db, valvesTable, pipesTable } from "@workspace/db";

const router: IRouter = Router();

// ─── GET /api/pipelines/geojson ──────────────────────────────────────────────
// Mengembalikan FeatureCollection berisi LineString dari pipa yang tersimpan di DB.
// Jika tidak ada pipa di DB, fallback ke tampilan radial dari reservoir ke tiap valve.
router.get("/pipelines/geojson", async (_req, res): Promise<void> => {
  const pipes = await db.select().from(pipesTable).orderBy(pipesTable.id);

  // ── Jika ada pipa nyata di DB, gunakan koordinat aslinya ─────────────────
  if (pipes.length > 0) {
    const features = pipes.map((pipe, index) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        // coordinates tersimpan sebagai [lng, lat][] di DB
        coordinates: pipe.coordinates as [number, number][],
      },
      properties: {
        id: `PIPE-DB-${String(index + 1).padStart(2, "0")}`,
        dbId: pipe.id,
        name: pipe.name,
        from_node: pipe.fromNode ?? undefined,
        from_name: pipe.fromNode ?? "Start",
        to_node: pipe.toNode ?? undefined,
        to_name: pipe.toNode ?? "End",
        diameter_mm: pipe.diameter ?? null,
        material: pipe.material ?? null,
        topology: "imported",
      },
    }));

    res.json({
      type: "FeatureCollection",
      name: "Jaringan Distribusi PDAM",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
      },
      features,
    });
    return;
  }

  // ── Fallback: tampilan radial dari Reservoir ke tiap Valve ───────────────
  const RESERVOIR = {
    id: "RES-SPAM-AIQ-BONE",
    name: "Reservoir SPAM Aiq Bone",
    coordinates: [116.29, -8.64] as [number, number],
  } as const;

  const valves = await db.select().from(valvesTable).orderBy(valvesTable.id);

  const features = valves.map((valve, index) => ({
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: [
        RESERVOIR.coordinates,
        [valve.lng, valve.lat] as [number, number],
      ],
    },
    properties: {
      id: `PIPE-RADIAL-${String(index + 1).padStart(2, "0")}`,
      name: `Pipa ${RESERVOIR.name} → ${valve.name}`,
      from_node: RESERVOIR.id,
      from_name: RESERVOIR.name,
      to_node: valve.valveId,
      to_name: valve.name,
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
    name: "Jaringan Radial SPAM Aiq Bone (Fallback)",
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