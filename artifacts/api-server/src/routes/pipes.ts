import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pipesTable } from "@workspace/db";
import {
  CreatePipeBody,
  GetPipeParams,
  UpdatePipeParams,
  UpdatePipeBody,
  DeletePipeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pipes", async (_req, res): Promise<void> => {
  const pipes = await db.select().from(pipesTable).orderBy(pipesTable.id);
  res.json(pipes);
});

router.post("/pipes", async (req, res): Promise<void> => {
  const parsed = CreatePipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pipe] = await db
    .insert(pipesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(pipe);
});

router.get("/pipes/:id", async (req, res): Promise<void> => {
  const params = GetPipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pipe] = await db
    .select()
    .from(pipesTable)
    .where(eq(pipesTable.id, params.data.id));

  if (!pipe) {
    res.status(404).json({ error: "Pipe not found" });
    return;
  }

  res.json(pipe);
});

router.put("/pipes/:id", async (req, res): Promise<void> => {
  const params = UpdatePipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pipe] = await db
    .update(pipesTable)
    .set(parsed.data)
    .where(eq(pipesTable.id, params.data.id))
    .returning();

  if (!pipe) {
    res.status(404).json({ error: "Pipe not found" });
    return;
  }

  res.json(pipe);
});

router.delete("/pipes/:id", async (req, res): Promise<void> => {
  const params = DeletePipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pipe] = await db
    .delete(pipesTable)
    .where(eq(pipesTable.id, params.data.id))
    .returning();

  if (!pipe) {
    res.status(404).json({ error: "Pipe not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
