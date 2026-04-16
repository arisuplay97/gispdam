import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sourcesTable } from "@workspace/db";
import {
  CreateSourceBody,
  DeleteSourceParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sources", async (_req, res): Promise<void> => {
  const sources = await db.select().from(sourcesTable).orderBy(sourcesTable.id);
  res.json(sources);
});

router.post("/sources", async (req, res): Promise<void> => {
  const parsed = CreateSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [source] = await db
    .insert(sourcesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(source);
});

router.delete("/sources/:id", async (req, res): Promise<void> => {
  const params = DeleteSourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [source] = await db
    .delete(sourcesTable)
    .where(eq(sourcesTable.id, params.data.id))
    .returning();

  if (!source) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
