import { pgTable, text, serial, doublePrecision, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pipesTable = pgTable("pipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  diameter: doublePrecision("diameter"),
  material: text("material"),
  fromNode: text("from_node"),
  toNode: text("to_node"),
  coordinates: jsonb("coordinates").notNull().$type<number[][]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPipeSchema = createInsertSchema(pipesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPipe = z.infer<typeof insertPipeSchema>;
export type Pipe = typeof pipesTable.$inferSelect;
