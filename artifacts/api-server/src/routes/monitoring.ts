import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, monitoringDataTable } from "@workspace/db";
import { AddMonitoringDataBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/monitoring", async (req, res): Promise<void> => {
  try {
    const data = await db
      .select()
      .from(monitoringDataTable)
      .orderBy(monitoringDataTable.date);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch monitoring data" });
  }
});

router.post("/monitoring", async (req, res): Promise<void> => {
  const parsed = AddMonitoringDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { pointId, session, date, tinggiAir, tekanan } = parsed.data;

  try {
    // Check if record for same point, date and session exists
    const [existing] = await db
      .select()
      .from(monitoringDataTable)
      .where(
        and(
          eq(monitoringDataTable.pointId, pointId),
          eq(monitoringDataTable.date, date),
          eq(monitoringDataTable.session, session)
        )
      );

    let result;
    if (existing) {
      const [updated] = await db
        .update(monitoringDataTable)
        .set({ tinggiAir, tekanan, updatedAt: new Date() })
        .where(eq(monitoringDataTable.id, existing.id))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db
        .insert(monitoringDataTable)
        .values({
          pointId,
          session,
          date,
          tinggiAir,
          tekanan,
        })
        .returning();
      result = inserted;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error saving monitoring data:", error);
    res.status(500).json({ error: "Failed to save monitoring data" });
  }
});

export default router;
