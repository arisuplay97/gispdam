import { Router, type IRouter } from "express";
import { db, valvesTable, pipesTable, sourcesTable } from "@workspace/db";
import { ImportGeoJsonBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getStatus(pressure: number): string {
  if (pressure > 5) return "normal";
  if (pressure >= 2) return "warning";
  return "critical";
}

router.post("/import-geojson", async (req, res): Promise<void> => {
  const parsed = ImportGeoJsonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let valvesImported = 0;
  let pipesImported = 0;

  const features = parsed.data.features as Array<{
    type: string;
    geometry: { type: string; coordinates: number[] | number[][] };
    properties?: Record<string, unknown>;
  }>;

  for (const feature of features) {
    if (!feature.geometry) continue;

    if (feature.geometry.type === "Point") {
      const coords = feature.geometry.coordinates as number[];
      const props = feature.properties || {};
      const pressure = typeof props.pressure === "number" ? props.pressure : 0;
      const valveId = typeof props.id === "string" ? props.id : `V-IMP-${Date.now()}-${valvesImported}`;
      const name = typeof props.name === "string" ? props.name : `Imported Valve ${valvesImported + 1}`;

      await db.insert(valvesTable).values({
        valveId,
        name,
        lng: coords[0],
        lat: coords[1],
        pressure,
        status: getStatus(pressure),
      });
      valvesImported++;
    } else if (feature.geometry.type === "LineString") {
      const coords = feature.geometry.coordinates as number[][];
      const props = feature.properties || {};
      const name = typeof props.name === "string" ? props.name : `Imported Pipe ${pipesImported + 1}`;
      const diameter = typeof props.diameter === "number" ? props.diameter : undefined;
      const material = typeof props.material === "string" ? props.material : undefined;
      const fromNode = typeof props.from_node === "string" ? props.from_node : undefined;
      const toNode = typeof props.to_node === "string" ? props.to_node : undefined;

      await db.insert(pipesTable).values({
        name,
        diameter,
        material,
        fromNode,
        toNode,
        coordinates: coords,
      });
      pipesImported++;
    }
  }

  res.json({
    success: true,
    valvesImported,
    pipesImported,
    message: `Imported ${valvesImported} valves and ${pipesImported} pipes`,
  });
});

router.get("/export/geojson", async (_req, res): Promise<void> => {
  const valves = await db.select().from(valvesTable);
  const pipes = await db.select().from(pipesTable);
  const sources = await db.select().from(sourcesTable);

  const features: Array<{
    type: string;
    geometry: { type: string; coordinates: number[] | number[][] };
    properties: Record<string, unknown>;
  }> = [];

  for (const v of valves) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
      properties: {
        id: v.valveId,
        name: v.name,
        pressure: v.pressure,
        status: v.status,
        type: "valve",
      },
    });
  }

  for (const s of sources) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        name: s.name,
        type: "source",
      },
    });
  }

  for (const p of pipes) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: p.coordinates },
      properties: {
        name: p.name,
        diameter: p.diameter,
        material: p.material,
        from_node: p.fromNode,
        to_node: p.toNode,
        type: "pipe",
      },
    });
  }

  res.json({
    type: "FeatureCollection",
    features,
  });
});

router.get("/export/csv", async (_req, res): Promise<void> => {
  const valves = await db.select().from(valvesTable);

  const header = "id,valve_id,name,lat,lng,pressure,status\n";
  const rows = valves
    .map(
      (v) =>
        `${v.id},${v.valveId},"${v.name}",${v.lat},${v.lng},${v.pressure},${v.status}`
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=valves.csv");
  res.send(header + rows);
});

export default router;
