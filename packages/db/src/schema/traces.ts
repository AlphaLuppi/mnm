import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export interface TracePhase {
  order: number;
  type: "COMPREHENSION" | "IMPLEMENTATION" | "VERIFICATION" | "COMMUNICATION" | "INITIALIZATION" | "RESULT" | "UNKNOWN";
  name: string;
  startIdx: number;
  endIdx: number;
  observationCount: number;
  summary: string;
}
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { workflowInstances } from "./workflow_instances.js";
import { stageInstances } from "./stage_instances.js";

// TRACE-01: traces — one container per agent run
export const traces = pgTable(
  "traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
    workflowInstanceId: uuid("workflow_instance_id").references(() => workflowInstances.id),
    stageInstanceId: uuid("stage_instance_id").references(() => stageInstances.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    parentTraceId: uuid("parent_trace_id").references((): AnyPgColumn => traces.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalDurationMs: integer("total_duration_ms"),
    totalTokensIn: integer("total_tokens_in").notNull().default(0),
    totalTokensOut: integer("total_tokens_out").notNull().default(0),
    totalCostUsd: text("total_cost_usd").notNull().default("0"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    tags: jsonb("tags").$type<string[]>(),
    phases: jsonb("phases").$type<TracePhase[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDateIdx: index("traces_company_date_idx").on(table.companyId, table.startedAt),
    companyAgentIdx: index("traces_company_agent_idx").on(table.companyId, table.agentId),
    companyStatusIdx: index("traces_company_status_idx").on(table.companyId, table.status),
    heartbeatRunIdx: index("traces_heartbeat_run_idx").on(table.heartbeatRunId),
    workflowInstanceIdx: index("traces_workflow_instance_idx").on(table.workflowInstanceId),
    parentTraceIdx: index("traces_parent_trace_idx").on(table.parentTraceId),
  }),
);

// TRACE-01: trace_observations — each factual action (tool call, generation, event)
export const traceObservations = pgTable(
  "trace_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    traceId: uuid("trace_id").notNull().references(() => traces.id, { onDelete: "cascade" }),
    parentObservationId: uuid("parent_observation_id").references((): AnyPgColumn => traceObservations.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    type: text("type").notNull(), // span | generation | event
    name: text("name").notNull(),
    status: text("status").notNull().default("started"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    level: text("level"),
    statusMessage: text("status_message"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    costUsd: text("cost_usd"),
    model: text("model"),
    modelParameters: jsonb("model_parameters").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    traceIdIdx: index("trace_obs_trace_id_idx").on(table.traceId),
    companyDateIdx: index("trace_obs_company_date_idx").on(table.companyId, table.startedAt),
    traceTypeIdx: index("trace_obs_trace_type_idx").on(table.traceId, table.type),
    parentObsIdx: index("trace_obs_parent_idx").on(table.parentObservationId),
  }),
);

// TRACE-07: trace_lenses — user analysis prompts
export const traceLenses = pgTable(
  "trace_lenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    scope: jsonb("scope").$type<{ agentIds?: string[]; workflowIds?: string[]; global?: boolean }>().notNull().default({}),
    isTemplate: boolean("is_template").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("trace_lenses_company_user_idx").on(table.companyId, table.userId),
    companyTemplateIdx: index("trace_lenses_company_template_idx").on(table.companyId, table.isTemplate),
  }),
);

// TRACE-07: trace_lens_results — cached analysis results (lens x trace)
export const traceLensResults = pgTable(
  "trace_lens_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lensId: uuid("lens_id").notNull().references(() => traceLenses.id, { onDelete: "cascade" }),
    traceId: uuid("trace_id").references(() => traces.id, { onDelete: "cascade" }),
    workflowInstanceId: uuid("workflow_instance_id").references(() => workflowInstances.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    resultMarkdown: text("result_markdown").notNull(),
    resultStructured: jsonb("result_structured").$type<Record<string, unknown>>(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    modelUsed: text("model_used"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: text("cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lensTraceUniqueIdx: uniqueIndex("trace_lens_results_lens_trace_idx").on(table.lensId, table.traceId),
    lensWorkflowIdx: index("trace_lens_results_lens_workflow_idx").on(table.lensId, table.workflowInstanceId),
    companyUserIdx: index("trace_lens_results_company_user_idx").on(table.companyId, table.userId),
  }),
);
