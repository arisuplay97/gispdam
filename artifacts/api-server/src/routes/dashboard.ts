import { Router, type IRouter } from "express";
import { db, valvesTable, pipesTable, sourcesTable, pressureHistoryTable } from "@workspace/db";
import { sql, avg, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [valveStats] = await db
    .select({
      totalValves: count(),
      avgPressure: avg(valvesTable.pressure),
    })
    .from(valvesTable);

  const [pipeStats] = await db
    .select({ totalPipes: count() })
    .from(pipesTable);

  const [sourceStats] = await db
    .select({ totalSources: count() })
    .from(sourcesTable);

  const statusCounts = await db
    .select({
      status: valvesTable.status,
      cnt: count(),
    })
    .from(valvesTable)
    .groupBy(valvesTable.status);

  let normalCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  for (const row of statusCounts) {
    if (row.status === "normal") normalCount = Number(row.cnt);
    else if (row.status === "warning") warningCount = Number(row.cnt);
    else if (row.status === "critical") criticalCount = Number(row.cnt);
  }

  res.json({
    totalValves: Number(valveStats.totalValves),
    totalPipes: Number(pipeStats.totalPipes),
    totalSources: Number(sourceStats.totalSources),
    avgPressure: Number(valveStats.avgPressure) || 0,
    normalCount,
    warningCount,
    criticalCount,
  });
});

router.get("/dashboard/pressure-history", async (_req, res): Promise<void> => {
  const records = await db
    .select()
    .from(pressureHistoryTable)
    .orderBy(sql`${pressureHistoryTable.timestamp} DESC`)
    .limit(100);

  res.json(records);
});

export default router;
