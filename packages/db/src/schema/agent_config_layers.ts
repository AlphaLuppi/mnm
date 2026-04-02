import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { configLayers } from "./config_layers.js";

export const agentConfigLayers = pgTable(
  "agent_config_layers",
  {
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    layerId: uuid("layer_id").notNull().references(() => configLayers.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    attachedBy: text("attached_by").notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.agentId, table.layerId] }),
  }),
);
