import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, networkNodeNamesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/network-node-names", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(networkNodeNamesTable);
    // Return as { [nodeId]: name }
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.nodeId] = r.name; });
    res.json(map);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/network-node-names/:nodeId", async (req, res): Promise<void> => {
  try {
    const { nodeId } = req.params;
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "name wajib diisi" });
      return;
    }
    
    // Upsert
    const existing = await db.select().from(networkNodeNamesTable).where(eq(networkNodeNamesTable.nodeId, nodeId));
    if (existing.length > 0) {
      const [updated] = await db.update(networkNodeNamesTable)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(networkNodeNamesTable.nodeId, nodeId))
        .returning();
      res.json(updated);
    } else {
      const [inserted] = await db.insert(networkNodeNamesTable)
        .values({ nodeId, name: name.trim() })
        .returning();
      res.status(201).json(inserted);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
