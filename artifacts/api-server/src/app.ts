import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

import { monitoringDataTable, monitoringPointsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";

async function ensureAutoSeeding() {
  try {
    // Seed 7 days of dummy monitoring_data for all manometers + reservoirs
    const mdRes = await db.select({ c: count() }).from(monitoringDataTable);
    if (Number(mdRes[0].c) === 0) {
      logger.info("[seed] Inserting 7-day dummy monitoring data...");
      const now = new Date();
      const bases: Record<string, { tinggiAir: number | null; tekanan: number | null }> = {
        "RES-01": { tinggiAir: 280, tekanan: null },
        "RES-02": { tinggiAir: 310, tekanan: null },
        "RES-03": { tinggiAir: 85,  tekanan: null },
        "MAN-01": { tinggiAir: null, tekanan: 4.2 },
        "MAN-02": { tinggiAir: null, tekanan: 0.8 },
        "MAN-03": { tinggiAir: null, tekanan: 1.5 },
        "MAN-04": { tinggiAir: null, tekanan: 3.1 },
        "MAN-05": { tinggiAir: null, tekanan: 0.4 },
        "MAN-06": { tinggiAir: null, tekanan: 5.0 },
        "MAN-07": { tinggiAir: null, tekanan: 2.8 },
        "MAN-08": { tinggiAir: null, tekanan: 3.5 },
        "MAN-09": { tinggiAir: null, tekanan: 1.2 },
      };
      for (let day = 6; day >= 0; day--) {
        const d = new Date(now);
        d.setDate(d.getDate() - day);
        const dateStr = d.toISOString().split("T")[0];
        for (const [pointId, base] of Object.entries(bases)) {
          for (const session of ["pagi", "sore"]) {
            const noise = Math.sin(day * 1.7 + pointId.charCodeAt(4) * 0.3 + (session === "sore" ? 1.5 : 0)) * 0.3;
            const dayDrift = (day - 3) * 0.08;
            let tinggiAir: number | null = null;
            let tekanan: number | null = null;
            if (base.tinggiAir !== null) {
              tinggiAir = Math.round((base.tinggiAir + noise * 30 + dayDrift * 15 + (session === "sore" ? -8 : 0)) * 10) / 10;
            }
            if (base.tekanan !== null) {
              tekanan = Math.round((base.tekanan + noise + dayDrift + (session === "sore" ? -0.1 : 0)) * 100) / 100;
              if (tekanan < 0) tekanan = 0.1;
            }
            // Raw execute for upserting
            await db.execute(sql`
              INSERT INTO monitoring_data (point_id, session, date, tinggi_air, tekanan)
              VALUES (${pointId}, ${session}, ${dateStr}, ${tinggiAir}, ${tekanan})
              ON CONFLICT DO NOTHING;
            `);
          }
        }
      }
      logger.info("[seed] Dummy monitoring data inserted.");
    }
  } catch (err) {
    logger.warn({ err }, "Could not run auto-seeding");
  }
}

ensureAutoSeeding();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

