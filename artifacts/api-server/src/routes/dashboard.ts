import { Router, type IRouter } from "express";
import { db, valvesTable, pipesTable, sourcesTable, pressureHistoryTable } from "@workspace/db";
import { sql, avg, count, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ─── GET /api/dashboard/stats ────────────────────────────────────────────────
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
    if (row.status === "normal")        normalCount   = Number(row.cnt);
    else if (row.status === "warning")  warningCount  = Number(row.cnt);
    else if (row.status === "critical") criticalCount = Number(row.cnt);
  }

  res.json({
    totalValves:   Number(valveStats.totalValves),
    totalPipes:    Number(pipeStats.totalPipes),
    totalSources:  Number(sourceStats.totalSources),
    avgPressure:   Number(valveStats.avgPressure) || 0,
    normalCount,
    warningCount,
    criticalCount,
  });
});

// ─── GET /api/dashboard/pressure-history ─────────────────────────────────────
// Returns last 100 pressure records (all valves) for the sidebar trend chart.
// Records are returned in chronological order (oldest first).
router.get("/dashboard/pressure-history", async (_req, res): Promise<void> => {
  const records = await db
    .select()
    .from(pressureHistoryTable)
    .orderBy(sql`${pressureHistoryTable.timestamp} ASC`)
    .limit(100);

  res.json(records);
});

// ─── GET /api/dashboard/pressure-history/:valveId ────────────────────────────
// Returns the last N records for a specific valve (for popup mini chart).
// Query param: ?limit=5 (default 10, max 50)
router.get("/dashboard/pressure-history/:valveId", async (req, res): Promise<void> => {
  const { valveId } = req.params;
  const limitParam = req.query.limit;
  const limit = limitParam
    ? Math.min(parseInt(String(limitParam), 10) || 10, 50)
    : 10;

  const records = await db
    .select()
    .from(pressureHistoryTable)
    .where(eq(pressureHistoryTable.valveId, valveId))
    .orderBy(desc(pressureHistoryTable.timestamp))
    .limit(limit);

  // Reverse so chart renders oldest → newest (left → right)
  res.json(records.reverse());
});

export default router;
