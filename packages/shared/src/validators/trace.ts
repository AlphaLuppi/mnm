import { z } from "zod";
import { TRACE_STATUSES, TRACE_OBSERVATION_TYPES, TRACE_OBSERVATION_STATUSES, GOLD_PROMPT_SCOPES } from "../types/trace.js";

// TRACE-02: Create trace
export const createTraceSchema = z.object({
  heartbeatRunId: z.string().uuid().optional(),
  workflowInstanceId: z.string().uuid().optional(),
  stageInstanceId: z.string().uuid().optional(),
  agentId: z.string().uuid(),
  parentTraceId: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
}).strict();

export type CreateTrace = z.infer<typeof createTraceSchema>;

// TRACE-02: Complete trace
export const completeTraceSchema = z.object({
  status: z.enum(["completed", "failed", "cancelled"]).default("completed"),
}).strict();

export type CompleteTrace = z.infer<typeof completeTraceSchema>;

// TRACE-02: Create observation
export const createObservationSchema = z.object({
  parentObservationId: z.string().uuid().optional(),
  type: z.enum(TRACE_OBSERVATION_TYPES),
  name: z.string().min(1).max(500),
  status: z.enum(TRACE_OBSERVATION_STATUSES).default("started"),
  level: z.string().max(50).optional(),
  statusMessage: z.string().max(2000).optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  costUsd: z.string().optional(),
  model: z.string().max(200).optional(),
  modelParameters: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export type CreateObservation = z.infer<typeof createObservationSchema>;

// TRACE-02: Batch create observations
export const batchCreateObservationsSchema = z.object({
  observations: z.array(createObservationSchema).min(1).max(100),
}).strict();

export type BatchCreateObservations = z.infer<typeof batchCreateObservationsSchema>;

// TRACE-02: Complete observation
export const completeObservationSchema = z.object({
  status: z.enum(["completed", "failed"]).default("completed"),
  statusMessage: z.string().max(2000).optional(),
  output: z.record(z.unknown()).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  costUsd: z.string().optional(),
  model: z.string().max(200).optional(),
}).strict();

export type CompleteObservation = z.infer<typeof completeObservationSchema>;

// TRACE-03: List traces filters (cursor-based)
export const traceListFiltersSchema = z.object({
  agentId: z.string().uuid().optional(),
  status: z.enum(TRACE_STATUSES).optional(),
  workflowInstanceId: z.string().uuid().optional(),
  parentTraceId: z.string().uuid().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
}).strict();

export type TraceListFilters = z.infer<typeof traceListFiltersSchema>;

// TRACE-07: Create lens
export const createTraceLensSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(1).max(10000),
  scope: z.object({
    agentIds: z.array(z.string().uuid()).optional(),
    workflowIds: z.array(z.string().uuid()).optional(),
    global: z.boolean().optional(),
  }).default({}),
  isTemplate: z.boolean().default(false),
}).strict();

export type CreateTraceLens = z.infer<typeof createTraceLensSchema>;

// TRACE-07: Update lens
export const updateTraceLensSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  prompt: z.string().min(1).max(10000).optional(),
  scope: z.object({
    agentIds: z.array(z.string().uuid()).optional(),
    workflowIds: z.array(z.string().uuid()).optional(),
    global: z.boolean().optional(),
  }).optional(),
  isActive: z.boolean().optional(),
}).strict();

export type UpdateTraceLens = z.infer<typeof updateTraceLensSchema>;

// PIPE-03: Create gold prompt
export const createGoldPromptSchema = z.object({
  scope: z.enum(GOLD_PROMPT_SCOPES),
  scopeId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(10000),
  isActive: z.boolean().default(true),
}).strict();

export type CreateGoldPrompt = z.infer<typeof createGoldPromptSchema>;

// PIPE-03: Update gold prompt
export const updateGoldPromptSchema = z.object({
  prompt: z.string().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
}).strict();

export type UpdateGoldPrompt = z.infer<typeof updateGoldPromptSchema>;

// PIPE-03: List gold prompts filters
export const goldPromptFiltersSchema = z.object({
  scope: z.enum(GOLD_PROMPT_SCOPES).optional(),
  scopeId: z.string().uuid().optional(),
}).strict();

export type GoldPromptFilters = z.infer<typeof goldPromptFiltersSchema>;
