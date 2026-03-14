import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { workflowInstances } from "./workflow_instances.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import type { TransitionRecord, EnforcementResult, PrePromptPayload, HitlDecision } from "@mnm/shared";

export const stageInstances = pgTable(
  "stage_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workflowInstanceId: uuid("workflow_instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
    stageOrder: integer("stage_order").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    agentRole: text("agent_role"),
    agentId: uuid("agent_id").references(() => agents.id),
    status: text("status").notNull().default("pending"),
    autoTransition: text("auto_transition").notNull().default("false"),
    acceptanceCriteria: jsonb("acceptance_criteria").$type<string[]>(),
    activeRunId: uuid("active_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    inputArtifacts: jsonb("input_artifacts").$type<string[]>(),
    outputArtifacts: jsonb("output_artifacts").$type<string[]>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // ORCH-S01: State machine columns
    machineState: text("machine_state").notNull().default("created"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    lastError: text("last_error"),
    lastActorId: text("last_actor_id"),
    lastActorType: text("last_actor_type"),
    feedback: text("feedback"),
    transitionHistory: jsonb("transition_history").$type<TransitionRecord[]>().notNull().default([]),
    machineContext: jsonb("machine_context").$type<Record<string, unknown>>(),
    // ORCH-S02: WorkflowEnforcer columns
    enforcementResults: jsonb("enforcement_results").$type<EnforcementResult>(),
    prePromptsInjected: jsonb("pre_prompts_injected").$type<PrePromptPayload>(),
    // ORCH-S03: HITL columns
    hitlDecision: jsonb("hitl_decision").$type<HitlDecision>(),
    hitlHistory: jsonb("hitl_history").$type<HitlDecision[]>().default([]),
  },
  (table) => ({
    workflowOrderIdx: index("stage_instances_workflow_order_idx").on(table.workflowInstanceId, table.stageOrder),
    companyStatusIdx: index("stage_instances_company_status_idx").on(table.companyId, table.status),
    machineStateIdx: index("stage_instances_machine_state_idx").on(table.companyId, table.machineState),
  }),
);
