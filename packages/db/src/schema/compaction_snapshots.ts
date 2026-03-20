import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

// comp-s02-schema-table
export const compactionSnapshots = pgTable(
  "compaction_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workflowInstanceId: uuid("workflow_instance_id").notNull(),
    stageId: uuid("stage_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    stageOrder: integer("stage_order").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    detectionPattern: text("detection_pattern").notNull(),
    detectionMessage: text("detection_message").notNull(),
    previousArtifacts: jsonb("previous_artifacts").notNull().default([]),
    prePromptsInjected: jsonb("pre_prompts_injected"),
    outputArtifactsSoFar: jsonb("output_artifacts_so_far").notNull().default([]),
    strategy: text("strategy").notNull().default("kill_relaunch"),
    status: text("status").notNull().default("pending"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    relaunchCount: integer("relaunch_count").notNull().default(0),
    maxRelaunchCount: integer("max_relaunch_count").notNull().default(3),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // comp-s02-idx-company
    companyIdx: index("idx_compaction_snapshots_company_id").on(table.companyId),
    // comp-s02-idx-agent-stage
    agentStageIdx: index("idx_compaction_snapshots_agent_stage").on(table.agentId, table.stageId),
    // comp-s02-idx-status
    statusIdx: index("idx_compaction_snapshots_status").on(table.status),
  }),
);
