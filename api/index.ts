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
  date,
  jsonb,
  integer,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { eq, count, avg, desc, sql, and } from "drizzle-orm";

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
  diameter: doublePrecision("diameter"),
  installYear: doublePrecision("install_year"),
  condition: text("condition"),
  functionStatus: text("function_status"),
  description: text("description"),
  pressure: doublePrecision("pressure").notNull().default(0),
  status: text("status").notNull().default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const pipesTable = pgTable("pipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coordinates: jsonb("coordinates").notNull().$type<number[][]>(),
  diameter: doublePrecision("diameter"),
  material: text("material"),
  networkType: text("network_type"),
  installYear: doublePrecision("install_year"),
  condition: text("condition"),
  length: doublePrecision("length"),
  zone: text("zone"),
  spam: text("spam"),
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

const monitoringDataTable = pgTable("monitoring_data", {
  id: serial("id").primaryKey(),
  pointId: text("point_id").notNull(),
  session: text("session").notNull(),
  date: date("date").notNull(),
  tinggiAir: doublePrecision("tinggi_air"),
  tekanan: doublePrecision("tekanan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const monitoringPointsTable = pgTable("monitoring_points", {
  id: serial("id").primaryKey(),
  pointId: text("point_id").notNull().unique(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// PostGIS Geometry custom type
const geometryPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Point,4326)";
  },
  toDriver(val: string) {
    return sql`ST_SetSRID(ST_MakePoint(${sql.raw(val.split(',')[0])}, ${sql.raw(val.split(',')[1])}), 4326)`;
  },
});

const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama_pelanggan: text("nama_pelanggan").notNull(),
  id_pelanggan: text("id_pelanggan").notNull().unique(),
  alamat: text("alamat"),
  elevasi_m: doublePrecision("elevasi_m"),
  spam_name: text("spam_name").notNull().default("SPAM Aiq Bone"),
  piutang: doublePrecision("piutang").notNull().default(0),
  // Instead of querying raw PostGIS purely, we store lat/lng for easy Node serialization, 
  // and maintain geom via trigger/sync or write it manually. To keep it rock solid in Drizzle:
  geom: geometryPoint("geom"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ─── Auto-init customers + monitoring tables ────────────────────────────────
(async () => {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nama_pelanggan TEXT NOT NULL,
        id_pelanggan TEXT UNIQUE NOT NULL,
        alamat TEXT,
        elevasi_m DOUBLE PRECISION,
        spam_name TEXT DEFAULT 'SPAM Aiq Bone',
        piutang DOUBLE PRECISION DEFAULT 0,
        geom GEOMETRY(Point, 4326),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS piutang DOUBLE PRECISION DEFAULT 0;`);
    // Auto-create monitoring_data table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_data (
        id SERIAL PRIMARY KEY,
        point_id TEXT NOT NULL,
        session TEXT NOT NULL,
        date DATE NOT NULL,
        tinggi_air DOUBLE PRECISION,
        tekanan DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Auto-create monitoring_points table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitoring_points (
        id SERIAL PRIMARY KEY,
        point_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Seed monitoring points default jika kosong
    const mpRes = await db.execute(sql`SELECT count(*) as c FROM monitoring_points`);
    if (Number((mpRes.rows[0] as any).c) === 0) {
      const defaultPoints = [
        { pointId: "MON-01", name: "Reservoir Induk (IPA)",  lat: -8.6650, lng: 116.3150 },
        { pointId: "MON-02", name: "BPT Airvale",            lat: -8.6720, lng: 116.3080 },
        { pointId: "MON-03", name: "Reservoir Airbaku",      lat: -8.6590, lng: 116.3220 },
        { pointId: "MON-04", name: "BPT Montong Terep",      lat: -8.6680, lng: 116.3000 },
        { pointId: "MON-05", name: "Reservoir Pagesangan",   lat: -8.6750, lng: 116.3300 },
      ];
      for (const p of defaultPoints) {
        await db.execute(sql`
          INSERT INTO monitoring_points (point_id, name, lat, lng)
          VALUES (${p.pointId}, ${p.name}, ${p.lat}, ${p.lng})
          ON CONFLICT (point_id) DO NOTHING;
        `);
      }
    }
    // Seed pelanggan dummy jika kosong
    const custRes = await db.execute(sql`SELECT count(*) as c FROM customers`);
    if (Number((custRes.rows[0] as any).c) === 0) {
      const seeds = [
        { nama: "Arya Taofan",    id: "AQB-001", alamat: "Jl. Raya Aiq Bone No.12",    elev: 85, piutang: 0,      lat: -8.6510, lng: 116.3210 },
        { nama: "Doni Unyu",      id: "AQB-002", alamat: "Gg. Manggis, Aiq Bone",      elev: 82, piutang: 54000, lat: -8.6525, lng: 116.3225 },
        { nama: "Laloe Huda",     id: "AQB-003", alamat: "Perum Bumi Asri Blok A",    elev: 80, piutang: 0,      lat: -8.6530, lng: 116.3205 },
        { nama: "Rima Mozarella", id: "AQB-004", alamat: "Jl. Merdeka Barat",          elev: 78, piutang: 120000,lat: -8.6545, lng: 116.3240 },
        { nama: "Ari Baskara",    id: "AQB-005", alamat: "Pasar Lama Aiq Bone",       elev: 75, piutang: 0,      lat: -8.6560, lng: 116.3255 },
        { nama: "Jang Don",       id: "AQB-006", alamat: "Jl. Diponegoro Gg. 3",      elev: 74, piutang: 0,      lat: -8.6575, lng: 116.3230 },
        { nama: "Erwin Guntara",  id: "AQB-007", alamat: "Komplek PDAM",               elev: 70, piutang: 15500, lat: -8.6590, lng: 116.3215 },
        { nama: "Stanley Hao",    id: "AQB-008", alamat: "Jl. Sudirman",               elev: 68, piutang: 0,      lat: -8.6605, lng: 116.3260 },
        { nama: "Thari Pingpong", id: "AQB-009", alamat: "Desa Sukamaju RT 01",       elev: 65, piutang: 85500, lat: -8.6620, lng: 116.3280 },
        { nama: "Faras Desya",    id: "AQB-010", alamat: "Desa Sukamaju RT 03",       elev: 62, piutang: 0,      lat: -8.6635, lng: 116.3295 },
      ];
      for (const c of seeds) {
        await db.execute(sql`
          INSERT INTO customers (nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, geom)
          VALUES (${c.nama}, ${c.id}, ${c.alamat}, ${c.elev}, 'SPAM Aiq Bone', ${c.piutang},
                  ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326))
          ON CONFLICT (id_pelanggan) DO NOTHING;
        `);
      }
    }
  } catch (e: any) {
    console.error("[startup] auto-init error:", e.message);
  }
})();


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

// ─── Monitoring Data ──────────────────────────────────────────────────────────
app.get("/api/monitoring", async (_req: any, res: any) => {
  try {
    const data = await db.select().from(monitoringDataTable).orderBy(monitoringDataTable.date);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/monitoring", async (req: any, res: any) => {
  try {
    const { pointId, session, date: dateStr, tinggiAir, tekanan } = req.body;
    if (!pointId || !session || !dateStr) {
      return res.status(400).json({ error: "pointId, session, dan date wajib diisi" });
    }
    // Upsert: update jika sudah ada, insert jika belum
    const existing = await db.select().from(monitoringDataTable).where(
      and(
        eq(monitoringDataTable.pointId, pointId),
        eq(monitoringDataTable.session, session),
        eq(monitoringDataTable.date, dateStr),
      )
    );
    let result;
    if (existing.length > 0) {
      const [updated] = await db.update(monitoringDataTable)
        .set({ tinggiAir: tinggiAir ?? null, tekanan: tekanan ?? null, updatedAt: new Date() })
        .where(eq(monitoringDataTable.id, existing[0].id))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db.insert(monitoringDataTable)
        .values({ pointId, session, date: dateStr, tinggiAir: tinggiAir ?? null, tekanan: tekanan ?? null })
        .returning();
      result = inserted;
    }
    res.json({ success: true, data: result });
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

// ─── Customers ──────────────────────────────────────────────────────────────
app.get("/api/customers", async (_req: any, res: any) => {
  try {
    // We use raw SQL to easily extract ST_X and ST_Y from geom
    const result = await db.execute(sql`
      SELECT 
        id, nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, created_at,
        ST_X(geom) as lng, ST_Y(geom) as lat
      FROM customers
      ORDER BY created_at DESC
    `);
    
    // Map to a clean object, building geoJSON structure on the frontend.
    const customers = result.rows;
    res.json(customers);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/customers", async (req: any, res: any) => {
  try {
    const { nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, lat, lng } = req.body;
    const p = piutang || 0;
    
    // Using raw SQL for precise PostGIS insertion
    const query = sql`
      INSERT INTO customers (nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, geom)
      VALUES (
        ${nama_pelanggan}, 
        ${id_pelanggan}, 
        ${alamat}, 
        ${elevasi_m}, 
        ${spam_name || 'SPAM Aiq Bone'}, 
        ${p},
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
      RETURNING id, nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, created_at, ST_X(geom) as lng, ST_Y(geom) as lat
    `;
    
    const result = await db.execute(query);
    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/customers/:id", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, lat, lng } = req.body;
    const p = piutang || 0;
    
    const query = sql`
      UPDATE customers 
      SET 
        nama_pelanggan = ${nama_pelanggan},
        id_pelanggan = ${id_pelanggan},
        alamat = ${alamat},
        elevasi_m = ${elevasi_m},
        spam_name = ${spam_name || 'SPAM Aiq Bone'},
        piutang = ${p},
        geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE id = ${id}
      RETURNING id, nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, created_at, ST_X(geom) as lng, ST_Y(geom) as lat
    `;
    
    const result = await db.execute(query);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/customers/:id", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM customers WHERE id = ${id}`);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GeoJSON Import ──────────────────────────────────────────────────────────
// Handler utama — dipanggil oleh kedua route
async function handleGeoJsonImport(req: any, res: any) {
  try {
    const geojson = req.body.data || req.body;
    if (!geojson || geojson.type !== "FeatureCollection") {
      return res.status(400).json({ error: "Invalid GeoJSON FeatureCollection" });
    }

    let valvesImported = 0;
    let pipesImported = 0;
    let sourcesImported = 0;

    for (const feature of geojson.features) {
      const props = feature.properties || {};
      const geometry = feature.geometry;

      if (!geometry) continue;

      if (geometry.type === "Point") {
        const [lng, lat] = geometry.coordinates;
        
        // 1. Cek apakah ini Sumber Air (Air Baku, Reservoir, BPT)
        const isAirBaku = !!props.jns_smbr;
        const isRsvOrBPT = props.nama && (String(props.nama).includes("Rsv.") || String(props.nama).includes("BPT.") || String(props.nama).includes("BPT "));
        
        // Cek juga dari tipe GeoJSON apabila ada properti yang sangat spesifik
        if (isAirBaku || isRsvOrBPT) {
          // Import sebagai Sources
          let srcType = "Sumber Air";
          if (isAirBaku) srcType = String(props.jns_smbr);
          else if (String(props.nama).includes("Rsv.")) srcType = "Reservoir";
          else if (String(props.nama).includes("BPT.") || String(props.nama).includes("BPT ")) srcType = "BPT";
          
          const capacity = props.kpsts_trpsng || props.kpsts_trpsg || 0;
          
          await db.insert(sourcesTable).values({
            name: props.nama || `Source ${props.fid || sourcesImported}`,
            lat: Number(lat),
            lng: Number(lng),
            capacity: Number(capacity),
            type: srcType,
          });
          sourcesImported++;
        } else {
          // 2. Import sebagai Valve / Air Valve / Washout
          const valveId = `V-IMP-${props.fid || Math.floor(Math.random() * 100000)}`;
          
          let valveName = props.jns_valve || props.nama || `Valve ${props.fid || valvesImported}`;
          let diameter = props.diameter || props.dimensi_av || props.dimensi_pipa || null;
          
          // Deteksi Air Valve (dari airvale.geojson yang biasanya punya props.jenis dan tanpa jns_valve/dimensi)
          if (props.jenis !== undefined && props.dimensi === undefined && props.jns_valve === undefined && !props.nama) {
             const jns = props.jenis ? String(props.jenis).trim() : "";
             valveName = jns ? `Air Valve ${jns} ${props.fid || valvesImported}` : `Air Valve ${props.fid || valvesImported}`;
          }
          // Deteksi Washout (dari washout.geojson yang biasanya hanya punya atribut "dimensi" dan "fid")
          else if (props.dimensi !== undefined && props.jns_valve === undefined && !props.nama) {
             valveName = `Washout ${props.fid || valvesImported}`;
             diameter = props.dimensi;
          }
          
          // Pastikan diameter bisa di-parse (replace comma to dot)
          if (diameter && typeof diameter === 'string') {
            diameter = parseFloat(diameter.replace(',', '.'));
          }

          await db.insert(valvesTable).values({
            valveId,
            name: valveName,
            lat: Number(lat),
            lng: Number(lng),
            diameter: diameter ? Number(diameter) : null,
            installYear: props.thn_psng ? Number(props.thn_psng) : null,
            condition: props.kondisi ? String(props.kondisi) : null,
            functionStatus: props.fungsi ? String(props.fungsi) : null,
            description: props.keterangan ? String(props.keterangan) : null,
            pressure: 5.0,
            status: "normal",
          }).onConflictDoNothing();
          valvesImported++;
        }
      } else if (geometry.type === "LineString") {
        // Import as Pipe
        const coords = geometry.coordinates; // [[lng, lat], ...]
        const diamStr = String(props.diameter || "").replace(",", ".");
        const diamFloat = parseFloat(diamStr);

        await db.insert(pipesTable).values({
          name: `Pipa ${props.jns_pipa || ""} ${props.fid || pipesImported}`,
          coordinates: coords,
          diameter: isNaN(diamFloat) ? null : diamFloat,
          material: props.jns_pipa ? String(props.jns_pipa) : null,
          networkType: props.jaringan ? String(props.jaringan) : null,
          installYear: props.thn_pasang ? Number(props.thn_pasang) : null,
          condition: props.kondisi ? String(props.kondisi) : null,
          length: props.panjang ? Number(props.panjang) : null,
          zone: props.zona ? String(props.zona) : null,
          spam: props.spam ? String(props.spam) : null,
        });
        pipesImported++;
      }
    }

    res.json({ success: true, valvesImported, pipesImported, sourcesImported });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// Kedua route alias — sesuai generated API client (/api/import-geojson)
// dan legacy path (/api/import/geojson)
app.post("/api/import-geojson", handleGeoJsonImport);
app.post("/api/import/geojson", handleGeoJsonImport);

// ─── Seed Demo Data (auto-seeds if DB empty) ──────────────────────────────────
const DEMO_VALVES = [
  { valveId: "V-1001", name: "Valve Utara A", lat: -8.630, lng: 116.295, pressure: 7.2 },
  { valveId: "V-1002", name: "Valve Utara B", lat: -8.635, lng: 116.305, pressure: 6.8 },
  { valveId: "V-1003", name: "Valve Timur",   lat: -8.650, lng: 116.320, pressure: 4.1 },
  { valveId: "V-1004", name: "Valve Selatan A", lat: -8.668, lng: 116.314, pressure: 1.8 },
  { valveId: "V-1005", name: "Valve Selatan B", lat: -8.675, lng: 116.298, pressure: 6.5 },
  { valveId: "V-1006", name: "Valve Barat",   lat: -8.660, lng: 116.278, pressure: 3.5 },
  { valveId: "V-1007", name: "Valve Tengah",  lat: -8.648, lng: 116.292, pressure: 7.8 },
];

const DEMO_SOURCES = [
  { name: "Reservoir Utama SPAM Aiq Bone", lat: -8.640, lng: 116.290, capacity: 5000, type: "Reservoir" },
  { name: "Intake Sungai Aiq Bone",         lat: -8.655, lng: 116.325, capacity: 2500, type: "Intake" },
];

const CUSTOMER_SEEDS = [
  { nama_pelanggan: "Arya Taofan", id_pelanggan: "AQB-001", alamat: "Jl. Raya Aiq Bone No.12", elevasi_m: 85, piutang: 0, lat: -8.6510, lng: 116.3210 },
  { nama_pelanggan: "Doni unyu", id_pelanggan: "AQB-002", alamat: "Gg. Manggis, Aiq Bone", elevasi_m: 82, piutang: 54000, lat: -8.6525, lng: 116.3225 },
  { nama_pelanggan: "Laloe Huda", id_pelanggan: "AQB-003", alamat: "Perum Bumi Asri Blok A", elevasi_m: 80, piutang: 0, lat: -8.6530, lng: 116.3205 },
  { nama_pelanggan: "Rima Mozarella", id_pelanggan: "AQB-004", alamat: "Jl. Merdeka Barat", elevasi_m: 78, piutang: 120000, lat: -8.6545, lng: 116.3240 },
  { nama_pelanggan: "Ari Baskara", id_pelanggan: "AQB-005", alamat: "Pasar Lama Aiq Bone", elevasi_m: 75, piutang: 0, lat: -8.6560, lng: 116.3255 },
  { nama_pelanggan: "Jang Don", id_pelanggan: "AQB-006", alamat: "Jl. Diponegoro Gg. 3", elevasi_m: 74, piutang: 0, lat: -8.6575, lng: 116.3230 },
  { nama_pelanggan: "Erwin Guntara", id_pelanggan: "AQB-007", alamat: "Komplek PDAM", elevasi_m: 70, piutang: 15500, lat: -8.6590, lng: 116.3215 },
  { nama_pelanggan: "Stanley Hao", id_pelanggan: "AQB-008", alamat: "Jl. Sudirman", elevasi_m: 68, piutang: 0, lat: -8.6605, lng: 116.3260 },
  { nama_pelanggan: "Thari pingpong", id_pelanggan: "AQB-009", alamat: "Desa Sukamaju RT 01", elevasi_m: 65, piutang: 85500, lat: -8.6620, lng: 116.3280 },
  { nama_pelanggan: "Faras desya", id_pelanggan: "AQB-010", alamat: "Desa Sukamaju RT 03", elevasi_m: 62, piutang: 0, lat: -8.6635, lng: 116.3295 }
];

app.all("/api/seed-demo", async (_req: any, res: any) => {
  try {
    // 1. SETUP POSTGIS & FIX SCHEMA
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis;`);
      
      // Fix Valves columns
      await db.execute(sql`ALTER TABLE valves ADD COLUMN IF NOT EXISTS diameter DOUBLE PRECISION;`);
      await db.execute(sql`ALTER TABLE valves ADD COLUMN IF NOT EXISTS install_year DOUBLE PRECISION;`);
      await db.execute(sql`ALTER TABLE valves ADD COLUMN IF NOT EXISTS condition TEXT;`);
      await db.execute(sql`ALTER TABLE valves ADD COLUMN IF NOT EXISTS function_status TEXT;`);
      await db.execute(sql`ALTER TABLE valves ADD COLUMN IF NOT EXISTS description TEXT;`);

      // Fix Pipes columns
      await db.execute(sql`ALTER TABLE pipes ADD COLUMN IF NOT EXISTS network_type TEXT;`);
      await db.execute(sql`ALTER TABLE pipes ADD COLUMN IF NOT EXISTS install_year DOUBLE PRECISION;`);
      await db.execute(sql`ALTER TABLE pipes ADD COLUMN IF NOT EXISTS condition TEXT;`);
      await db.execute(sql`ALTER TABLE pipes ADD COLUMN IF NOT EXISTS length DOUBLE PRECISION;`);
      await db.execute(sql`ALTER TABLE pipes ADD COLUMN IF NOT EXISTS zone TEXT;`);
      await db.execute(sql`ALTER TABLE pipes ADD COLUMN IF NOT EXISTS spam TEXT;`);

      // Fix Sources
      await db.execute(sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS capacity DOUBLE PRECISION;`);
      await db.execute(sql`ALTER TABLE sources ADD COLUMN IF NOT EXISTS type TEXT;`);
      
      // Fix Customers
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS piutang DOUBLE PRECISION DEFAULT 0;`);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nama_pelanggan TEXT NOT NULL,
          id_pelanggan TEXT UNIQUE NOT NULL,
          alamat TEXT,
          elevasi_m DOUBLE PRECISION,
          spam_name TEXT DEFAULT 'SPAM Aiq Bone',
          piutang DOUBLE PRECISION DEFAULT 0,
          geom GEOMETRY(Point, 4326),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    } catch (e: any) {
      console.error("Schema fix error (ignored):", e.message);
    }

    const [valveCount] = await db.select({ c: count() }).from(valvesTable);
    const [sourceCount] = await db.select({ c: count() }).from(sourcesTable);
    
    // Explicitly check raw count for customers
    const custRes = await db.execute(sql`SELECT count(*) as c FROM customers`);
    const custCount = Number(custRes.rows[0].c);

    const seeded: string[] = [];

    if (Number(valveCount.c) === 0) {
      for (const v of DEMO_VALVES) {
        const status = getStatus(v.pressure);
        await db.insert(valvesTable).values({ ...v, status }).onConflictDoNothing();
      }
      seeded.push(`${DEMO_VALVES.length} valves`);
    }

    if (Number(sourceCount.c) === 0) {
      for (const s of DEMO_SOURCES) {
        await db.insert(sourcesTable).values(s).onConflictDoNothing();
      }
      seeded.push(`${DEMO_SOURCES.length} sources`);
    }

    if (custCount === 0) {
      for (const c of CUSTOMER_SEEDS) {
        await db.execute(sql`
          INSERT INTO customers (nama_pelanggan, id_pelanggan, alamat, elevasi_m, spam_name, piutang, geom)
          VALUES (${c.nama_pelanggan}, ${c.id_pelanggan}, ${c.alamat}, ${c.elevasi_m}, 'SPAM Aiq Bone', ${c.piutang}, ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326))
          ON CONFLICT (id_pelanggan) DO NOTHING;
        `);
      }
      seeded.push(`${CUSTOMER_SEEDS.length} customers`);
    }

    res.json({ ok: true, seeded: seeded.length > 0 ? seeded : ["nothing (data already exists)"] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Monitoring Points CRUD ──────────────────────────────────────────────────
app.get("/api/monitoring-points", async (_req: any, res: any) => {
  try {
    const points = await db.select().from(monitoringPointsTable).orderBy(monitoringPointsTable.id);
    res.json(points);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/monitoring-points", async (req: any, res: any) => {
  try {
    const { pointId, name, lat, lng } = req.body;
    if (!pointId || !name || lat == null || lng == null)
      return res.status(400).json({ error: "pointId, name, lat, lng wajib diisi" });
    const [pt] = await db
      .insert(monitoringPointsTable)
      .values({ pointId, name, lat: Number(lat), lng: Number(lng) })
      .returning();
    res.status(201).json(pt);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/monitoring-points/:id", async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    const { name, lat, lng } = req.body;
    const [pt] = await db
      .update(monitoringPointsTable)
      .set({
        ...(name != null && { name }),
        ...(lat  != null && { lat: Number(lat) }),
        ...(lng  != null && { lng: Number(lng) }),
        updatedAt: new Date(),
      })
      .where(eq(monitoringPointsTable.id, id))
      .returning();
    if (!pt) return res.status(404).json({ error: "Not found" });
    res.json(pt);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/monitoring-points/:id", async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    await db.delete(monitoringPointsTable).where(eq(monitoringPointsTable.id, id));
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/ai-advice", async (req: any, res: any) => {
  try {
    const { chartRaw, pointName, period, status, predCount } = req.body;
    
    // Fallback if no key
    if (!process.env.GROQ_API_KEY) {
      return res.status(200).json({ advice: "API Key Groq belum disetting di Environment Variable server." });
    }

    const numPred = predCount || 3;

    // Format prompt — Senior Hydraulic Engineer Role
    const prompt = `ROLE:
Kamu adalah "Senior Hydraulic Engineer & Data Analyst" untuk PDAM Tirta Ardhia Rinjani. Tugasmu adalah melakukan diagnosa pada dashboard sistem monitoring distribusi air (SIM-DIST) secara real-time.

CONTEXT:
Lokasi pengamatan: "${pointName}".
Rentang waktu data: "${period}".
Status deteksi sistem saat ini: "${status ? status.toUpperCase() : 'NORMAL'}".
Data historis parameter Tinggi Air (cm) dan Tekanan (bar) dalam format JSON:
${JSON.stringify(chartRaw)}

LOGIKA ANALISA TEKNIS (Wajib Diikuti):
1. KORELASI TINGGI vs TEKANAN:
   - NORMAL: Jika Tinggi Air turun, Tekanan ikut turun sedikit karena penggunaan warga (Pola Beban Puncak).
   - ANOMALI TEKNIS: Jika Tinggi Air NAIK atau STABIL, tapi Tekanan TURUN drastis, ini tanda "Penyumbatan Katup" atau "Pipa Pecah" di jalur transmisi.
2. POLA BEBAN PUNCAK (Siklus Harian):
   - Kenali penurunan tekanan pada jam sibuk (05.00-08.00 WITA pagi dan 17.00-20.00 WITA) sebagai kondisi AMAN, bukan kerusakan.
3. ANALISA DATA CURAM:
   - Jangan melakukan "smoothing" jika terjadi penurunan >20% di luar jam beban puncak.
   - Jangan memaksa memprediksi grafik "curam" jika tren data menunjukkan stabilitas. Prediksi harus didasarkan pada REPEATABILITY (pengulangan pola).

TUGAS: Jawab HANYA dalam format JSON MURNI (tanpa markdown, tanpa backtick, tanpa penjelasan tambahan) dengan struktur berikut:
{
  "advice": "[STATUS]: NORMAL/WASPADA/KRITIS. [ANALISA]: Maks 5 kalimat teknis kondisi saat ini. [BUKTI DATA]: Sebutkan Hari/Tanggal saat anomali paling signifikan beserta angka spesifiknya. [PREDIKSI]: Tren 24-72 jam ke depan berdasarkan statistik data, jika pola anomali terlihat berulang beri peringatan keras. [CONFIDENCE]: Skor 0-100% disertai alasan singkat (contoh: 90% - data historis 7 hari sangat konsisten). [SARAN LAPANGAN]: Instruksi spesifik untuk petugas (misal: Cek Air Valve, manual flushing, pantau bukaan katup). [SARAN DIREKSI]: Rekomendasi kebijakan/eskalasi.",
  "predictions": [${Array.from({length: numPred}, (_, i) => `{"predTinggi": <angka prediksi tinggi air cm titik ke-${i+1}>, "predTekanan": <angka prediksi tekanan bar titik ke-${i+1}>}`).join(', ')}]
}

ATURAN KETAT:
- WAJIB merespons SEPENUHNYA dalam Bahasa Indonesia.
- Tone: Profesional, teknis, singkat, berorientasi tindakan lapangan. DILARANG basa-basi atau kata puitis.
- Angka predictions WAJIB realistis berdasarkan tren data dan REPEATABILITY pola. Jangan pernah mengembalikan angka negatif.
- Jika data menunjukkan anomali serius, BERANI memberikan peringatan keras dan tegas.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!groqResponse.ok) {
        const errorData = await groqResponse.text();
        throw new Error(`Groq API Error: ${groqResponse.status} - ${errorData}`);
    }

    const result = await groqResponse.json();
    const rawText = result.choices?.[0]?.message?.content || "{}";
    
    // Hapus blok <think>...</think> bawaan model reasoning
    const cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    try {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleanText;
      const parsed = JSON.parse(jsonStr);
      res.json({ advice: parsed.advice || "Gagal mendapatkan saran dari AI.", predictions: parsed.predictions || [] });
    } catch {
      res.json({ advice: cleanText, predictions: [] });
    }
  } catch (e: any) {
    console.error("AI Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Vercel handler export ────────────────────────────────────────────────────
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
