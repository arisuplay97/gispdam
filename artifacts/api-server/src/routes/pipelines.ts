import { Router, type IRouter } from "express";
import { db, valvesTable } from "@workspace/db";

const router: IRouter = Router();

const reservoir = {
  id: "RES-01",
  name: "Reservoir SPAM Aiq Bone",
  coordinates: [116.29, -8.64] as [number, number],
};

router.get("/pipelines/geojson", async (_req, res): Promise<void> => {
  const valves = await db.select().from(valvesTable).orderBy(valvesTable.id);

  const features = valves.map((valve, index) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        reservoir.coordinates,
        [valve.lng, valve.lat],
      ],
    },
    properties: {
      id: `PIPE-RADIAL-${index + 1}`,
      name: `Pipa ${reservoir.name} ke ${valve.name}`,
      from_node: reservoir.id,
      from_name: reservoir.name,
      to_node: valve.valveId,
      to_name: valve.name,
      targetValveId: valve.valveId,
      diameter: 300,
      material: "PVC",
      topology: "radial",
    },
  }));

  res.json({
    type: "FeatureCollection",
    name: "Radial Pipeline Network",
    reservoir: {
      id: reservoir.id,
      name: reservoir.name,
      coordinates: reservoir.coordinates,
    },
    features,
  });
});

export default router;