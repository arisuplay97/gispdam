// Vercel Serverless Function — standalone Express handler
// Tidak mengimport dari TypeScript source api-server agar tidak ada ESM compile error
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import cors from "cors";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  pgTable,
  text,
  serial,
  doublePrecision,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { eq, count, avg, desc, sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ─── Schema ────────────────────────────────────────────────────────────────
const valvesTable = pgTable("valves", {
  id: serial("id").primaryKey(),
  valveId: text("valve_id").notNull().unique(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  pressure: doublePrecision("pressure").notNull().default(0),
  status: text("status").notNull().default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const pipesTable = pgTable("pipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coordinates: jsonb("coordinates").notNull().$type<[number, number][]>(),
  diameter: doublePrecision("diameter"),
  material: text("material"),
  fromNode: text("from_node"),
  toNode: text("to_node"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const sourcesTable = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  capacity: doublePrecision("capacity"),
  type: text("type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const pressureHistoryTable = pgTable("pressure_history", {
  id: serial("id").primaryKey(),
  valveId: integer("valve_id").notNull(),
  pressure: doublePrecision("pressure").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

function getStatus(pressure: number): string {
  if (pressure > 5) return "normal";
  if (pressure >= 2) return "warning";
  return "critical";
}

// Health
app.get("/api/health", (_req: any, res: any) => res.json({ status: "ok" }));

// ─── Valves ──────────────────────────────────────────────────────────────────
app.get("/api/valves", async (_req: any, res: any) => {
  try {
    const valves = await db.select().from(valvesTable).orderBy(valvesTable.id);
    res.json(valves);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/valves", async (req: any, res: any) => {
  try {
    const { valveId, name, lat, lng, pressure } = req.body;
    const status = getStatus(Number(pressure));
    const [valve] = await db
      .insert(valvesTable)
      .values({ valveId, name, lat: Number(lat), lng: Number(lng), pressure: Number(pressure), status })
      .returning();
    res.status(201).json(valve);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/valves/:id", async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const [valve] = await db.select().from(valvesTable).where(eq(valvesTable.id, id));
    if (!valve) return res.status(404).json({ error: "Not found" });
    res.json(valve);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/valves/:id", async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const { name, lat, lng, pressure } = req.body;
    const status = getStatus(Number(pressure));
    const [valve] = await db
      .update(valvesTable)
      .set({ name, lat: Number(lat), lng: Number(lng), pressure: Number(pressure), status })
      .where(eq(valvesTable.id, id))
      .returning();
    if (!valve) return res.status(404).json({ error: "Not found" });
    res.json(valve);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/valves/:id", async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    await db.delete(valvesTable).where(eq(valvesTable.id, id));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Pipes ───────────────────────────────────────────────────────────────────
app.get("/api/pipes", async (_req: any, res: any) => {
  try {
    const pipes = await db.select().from(pipesTable).orderBy(pipesTable.id);
    res.json(pipes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/pipes", async (req: any, res: any) => {
  try {
    const { name, coordinates, diameter, material, fromNode, toNode } = req.body;
    const [pipe] = await db
      .insert(pipesTable)
      .values({ name, coordinates, diameter, material, fromNode, toNode })
      .returning();
    res.status(201).json(pipe);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/pipes/:id", async (req: any, res: any) => {
  try {
    await db.delete(pipesTable).where(eq(pipesTable.id, Number(req.params.id)));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Sources ─────────────────────────────────────────────────────────────────
app.get("/api/sources", async (_req: any, res: any) => {
  try {
    const sources = await db.select().from(sourcesTable).orderBy(sourcesTable.id);
    res.json(sources);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sources", async (req: any, res: any) => {
  try {
    const { name, lat, lng, capacity, type } = req.body;
    const [source] = await db
      .insert(sourcesTable)
      .values({ name, lat: Number(lat), lng: Number(lng), capacity, type })
      .returning();
    res.status(201).json(source);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
app.get("/api/dashboard/stats", async (_req: any, res: any) => {
  try {
    const [valveStats] = await db.select({ total: count(), avg: avg(valvesTable.pressure) }).from(valvesTable);
    const [pipeStats] = await db.select({ total: count() }).from(pipesTable);
    const [sourceStats] = await db.select({ total: count() }).from(sourcesTable);
    const statusCounts = await db
      .select({ status: valvesTable.status, cnt: count() })
      .from(valvesTable)
      .groupBy(valvesTable.status);
    let normalCount = 0, warningCount = 0, criticalCount = 0;
    for (const r of statusCounts) {
      if (r.status === "normal") normalCount = Number(r.cnt);
      else if (r.status === "warning") warningCount = Number(r.cnt);
      else if (r.status === "critical") criticalCount = Number(r.cnt);
    }
    res.json({
      totalValves: Number(valveStats.total),
      totalPipes: Number(pipeStats.total),
      totalSources: Number(sourceStats.total),
      avgPressure: Number(valveStats.avg) || 0,
      normalCount, warningCount, criticalCount,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Pressure History ─────────────────────────────────────────────────────────
app.get("/api/dashboard/pressure-history", async (_req: any, res: any) => {
  try {
    const records = await db
      .select()
      .from(pressureHistoryTable)
      .orderBy(sql`${pressureHistoryTable.timestamp} ASC`)
      .limit(100);
    res.json(records);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Pipelines GeoJSON ────────────────────────────────────────────────────────
const RESERVOIR_COORDS: [number, number] = [116.29, -8.64];

app.get("/api/pipelines/geojson", async (_req: any, res: any) => {
  try {
    const valves = await db.select().from(valvesTable).orderBy(valvesTable.id);
    const features = valves.map((v, i) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [RESERVOIR_COORDS, [v.lng, v.lat] as [number, number]],
      },
      properties: {
        id: `PIPE-RADIAL-${String(i + 1).padStart(2, "0")}`,
        name: `Reservoir SPAM Aiq Bone → ${v.name}`,
        from_name: "Reservoir SPAM Aiq Bone",
        to_name: v.name,
        pressure_at_valve: v.pressure,
        status_at_valve: v.status,
      },
    }));
    res.json({ type: "FeatureCollection", features });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Vercel handler export ────────────────────────────────────────────────────
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
