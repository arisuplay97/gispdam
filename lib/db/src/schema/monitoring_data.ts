import { pgTable, text, serial, doublePrecision, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monitoringDataTable = pgTable("monitoring_data", {
  id: serial("id").primaryKey(),
  pointId: text("point_id").notNull(),
  session: text("session").notNull(), // 'pagi' | 'sore'
  date: date("date").notNull(), // YYYY-MM-DD
  tinggiAir: doublePrecision("tinggi_air"), // cm
  tekanan: doublePrecision("tekanan"), // bar
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMonitoringDataSchema = createInsertSchema(monitoringDataTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMonitoringData = z.infer<typeof insertMonitoringDataSchema>;
export type MonitoringDataRow = typeof monitoringDataTable.$inferSelect;
