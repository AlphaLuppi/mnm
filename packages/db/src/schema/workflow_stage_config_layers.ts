import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { stageInstances } from "./stage_instances.js";
import { configLayers } from "./config_layers.js";

export const workflowStageConfigLayers = pgTable(
  "workflow_stage_config_layers",
  {
    companyId: uuid("company_id").notNull().references(() => companies.id),
    stageInstanceId: uuid("stage_instance_id").notNull().references(() => stageInstances.id, { onDelete: "cascade" }),
    layerId: uuid("layer_id").notNull().references(() => configLayers.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    attachedBy: text("attached_by").notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.stageInstanceId, table.layerId] }),
  }),
);
