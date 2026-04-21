import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const networkNodeNamesTable = pgTable("network_node_names", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
