import { pgTable, text, serial, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const pressureHistoryTable = pgTable("pressure_history", {
  id: serial("id").primaryKey(),
  valveId: text("valve_id").notNull(),
  name: text("name").notNull(),
  pressure: doublePrecision("pressure").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type PressureRecord = typeof pressureHistoryTable.$inferSelect;
