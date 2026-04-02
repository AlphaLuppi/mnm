import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { workflowTemplates } from "./workflow_templates.js";
import { configLayers } from "./config_layers.js";

export const workflowTemplateStageLayers = pgTable(
  "workflow_template_stage_layers",
  {
    companyId: uuid("company_id").notNull().references(() => companies.id),
    templateId: uuid("template_id").notNull().references(() => workflowTemplates.id, { onDelete: "cascade" }),
    stageOrder: integer("stage_order").notNull(),
    layerId: uuid("layer_id").notNull().references(() => configLayers.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    attachedBy: text("attached_by").notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.templateId, table.stageOrder, table.layerId] }),
  }),
);
