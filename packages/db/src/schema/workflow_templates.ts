import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  stages: jsonb("stages").notNull().$type<WorkflowStageTemplateDef[]>(),
  isDefault: boolean("is_default").notNull().default(false),
  createdFrom: text("created_from").notNull().default("custom"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkflowStageTemplateDef = {
  order: number;
  name: string;
  description?: string;
  agentRole?: string;
  autoTransition: boolean;
  acceptanceCriteria?: string[];
  // ORCH-S02: WorkflowEnforcer fields
  requiredFiles?: import("@mnm/shared").RequiredFileDef[];
  prePrompts?: string[];
  expectedOutputs?: string[];
  // ORCH-S03: HITL fields
  hitlRequired?: boolean;
  hitlRoles?: string[];
};
