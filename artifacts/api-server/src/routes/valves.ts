import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, valvesTable } from "@workspace/db";
import {
  CreateValveBody,
  GetValveParams,
  UpdateValveParams,
  UpdateValveBody,
  DeleteValveParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getStatus(pressure: number): string {
  if (pressure > 5) return "normal";
  if (pressure >= 2) return "warning";
  return "critical";
}

router.get("/valves", async (_req, res): Promise<void> => {
  const valves = await db.select().from(valvesTable).orderBy(valvesTable.id);
  res.json(valves);
});

router.post("/valves", async (req, res): Promise<void> => {
  const parsed = CreateValveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const status = getStatus(parsed.data.pressure);
  const [valve] = await db
    .insert(valvesTable)
    .values({ ...parsed.data, status })
    .returning();

  res.status(201).json(valve);
});

router.get("/valves/:id", async (req, res): Promise<void> => {
  const params = GetValveParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [valve] = await db
    .select()
    .from(valvesTable)
    .where(eq(valvesTable.id, params.data.id));

  if (!valve) {
    res.status(404).json({ error: "Valve not found" });
    return;
  }

  res.json(valve);
});

router.put("/valves/:id", async (req, res): Promise<void> => {
  const params = UpdateValveParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateValveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.pressure != null) {
    updateData.status = getStatus(parsed.data.pressure);
  }

  const [valve] = await db
    .update(valvesTable)
    .set(updateData)
    .where(eq(valvesTable.id, params.data.id))
    .returning();

  if (!valve) {
    res.status(404).json({ error: "Valve not found" });
    return;
  }

  res.json(valve);
});

router.delete("/valves/:id", async (req, res): Promise<void> => {
  const params = DeleteValveParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [valve] = await db
    .delete(valvesTable)
    .where(eq(valvesTable.id, params.data.id))
    .returning();

  if (!valve) {
    res.status(404).json({ error: "Valve not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
