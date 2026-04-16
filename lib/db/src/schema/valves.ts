import { pgTable, text, serial, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const valvesTable = pgTable("valves", {
  id: serial("id").primaryKey(),
  valveId: text("valve_id").notNull().unique(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  pressure: doublePrecision("pressure").notNull().default(0),
  status: text("status").notNull().default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertValveSchema = createInsertSchema(valvesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertValve = z.infer<typeof insertValveSchema>;
export type Valve = typeof valvesTable.$inferSelect;
