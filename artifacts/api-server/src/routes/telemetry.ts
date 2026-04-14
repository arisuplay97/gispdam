import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, valvesTable, pressureHistoryTable } from "@workspace/db";
import { PostTelemetryBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getStatus(pressure: number): string {
  if (pressure > 5) return "normal";
  if (pressure >= 2) return "warning";
  return "critical";
}

router.post("/telemetry", async (req, res): Promise<void> => {
  const parsed = PostTelemetryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { valveId, pressure } = parsed.data;

  const [valve] = await db
    .select()
    .from(valvesTable)
    .where(eq(valvesTable.valveId, valveId));

  if (!valve) {
    res.status(404).json({ error: `Valve ${valveId} not found` });
    return;
  }

  const status = getStatus(pressure);

  const [updated] = await db
    .update(valvesTable)
    .set({ pressure, status })
    .where(eq(valvesTable.valveId, valveId))
    .returning();

  await db.insert(pressureHistoryTable).values({
    valveId,
    name: valve.name,
    pressure,
  });

  res.json({
    success: true,
    valve: updated,
  });
});

export default router;
