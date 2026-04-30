/**
 * PAPERCLIP-PHASE2 — Inbox Interactive shared types.
 *
 * Mirrors the DB schema from `@mnm/db/thread_interactions`. Kept in shared
 * so both UI and server can use the same `ThreadInteraction` shape and the
 * same Zod payload schemas for validation. Patterns adapted from upstream
 * `paperclipai/paperclip` PRs #4244 + #4381.
 */
import { z } from "zod";

// ---- Enums (mirror DB) -----------------------------------------------------

export const THREAD_INTERACTION_KINDS = [
  "suggest_tasks",
  "ask_questions",
  "request_confirmation",
] as const;
export type ThreadInteractionKind = (typeof THREAD_INTERACTION_KINDS)[number];

export const THREAD_INTERACTION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "answered",
  "expired",
  "superseded",
] as const;
export type ThreadInteractionStatus =
  (typeof THREAD_INTERACTION_STATUSES)[number];

export const THREAD_INTERACTION_CONTINUATION_POLICIES = [
  "wake_assignee",
  "manual",
] as const;
export type ThreadInteractionContinuationPolicy =
  (typeof THREAD_INTERACTION_CONTINUATION_POLICIES)[number];

// ---- Per-kind payload schemas (Zod) ----------------------------------------

/**
 * suggest_tasks: agent proposes 1..N child issues. The user can accept
 * a subset by passing `selectedClientKeys` to the accept endpoint.
 */
export const suggestedTaskDraftSchema = z.object({
  /** Client-generated stable key — used to map accept/reject decisions back to a task. */
  clientKey: z.string().min(1).max(120),
  title: z.string().min(1).max(500),
  description: z.string().max(20_000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  parentClientKey: z.string().min(1).max(120).optional(),
  /** Optional override: assignee to set on the created task. */
  assigneeAgentId: z.string().uuid().optional(),
  /** Free-form metadata the agent wants to round-trip. */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SuggestedTaskDraft = z.infer<typeof suggestedTaskDraftSchema>;

export const suggestTasksPayloadSchema = z.object({
  version: z.literal(1),
  tasks: z.array(suggestedTaskDraftSchema).min(1).max(50),
});
export type SuggestTasksPayload = z.infer<typeof suggestTasksPayloadSchema>;

export const suggestTasksResultCreatedTaskSchema = z.object({
  clientKey: z.string(),
  issueId: z.string().uuid(),
  identifier: z.string().nullable(),
});
export type SuggestTasksResultCreatedTask = z.infer<
  typeof suggestTasksResultCreatedTaskSchema
>;

export const suggestTasksResultSchema = z.object({
  createdTasks: z.array(suggestTasksResultCreatedTaskSchema),
  skippedClientKeys: z.array(z.string()).default([]),
  rejectedReason: z.string().max(2000).optional(),
});
export type SuggestTasksResult = z.infer<typeof suggestTasksResultSchema>;

/**
 * ask_questions: agent asks 1..N structured questions. Each question can be
 * single-choice, multi-choice, or free text.
 */
export const askQuestionsQuestionOptionSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(500),
});
export type AskQuestionsQuestionOption = z.infer<
  typeof askQuestionsQuestionOptionSchema
>;

export const askQuestionsQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(2000),
  kind: z.enum(["single_choice", "multi_choice", "text"]),
  required: z.boolean().default(true),
  options: z.array(askQuestionsQuestionOptionSchema).default([]),
  maxLength: z.number().int().min(1).max(10_000).optional(),
});
export type AskQuestionsQuestion = z.infer<typeof askQuestionsQuestionSchema>;

export const askQuestionsPayloadSchema = z.object({
  version: z.literal(1),
  questions: z.array(askQuestionsQuestionSchema).min(1).max(20),
});
export type AskQuestionsPayload = z.infer<typeof askQuestionsPayloadSchema>;

export const askQuestionsAnswerSchema = z.object({
  questionId: z.string(),
  /** For single/multi choice questions. */
  optionIds: z.array(z.string()).default([]),
  /** For text answers. */
  text: z.string().max(20_000).optional(),
});
export type AskQuestionsAnswer = z.infer<typeof askQuestionsAnswerSchema>;

export const askQuestionsResultSchema = z.object({
  answers: z.array(askQuestionsAnswerSchema),
});
export type AskQuestionsResult = z.infer<typeof askQuestionsResultSchema>;

/**
 * request_confirmation: agent asks for an explicit accept/reject on a
 * proposal. Optional `target` ties the confirmation to an issue document
 * or other artifact so a later edit can supersede the request.
 */
export const requestConfirmationTargetSchema = z.object({
  type: z.enum(["issue_document", "artifact", "other"]),
  issueId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  artifactId: z.string().uuid().optional(),
  key: z.string().max(80).optional(),
  revisionId: z.string().uuid().optional(),
  revisionNumber: z.number().int().nonnegative().optional(),
});
export type RequestConfirmationTarget = z.infer<
  typeof requestConfirmationTargetSchema
>;

export const requestConfirmationPayloadSchema = z.object({
  version: z.literal(1),
  prompt: z.string().min(1).max(2000),
  acceptLabel: z.string().min(1).max(80).default("Accept"),
  rejectLabel: z.string().min(1).max(80).default("Request changes"),
  rejectRequiresReason: z.boolean().default(false),
  rejectReasonLabel: z.string().max(200).optional(),
  detailsMarkdown: z.string().max(50_000).optional(),
  /** When true, a later board/user comment auto-supersedes the pending request. */
  supersedeOnUserComment: z.boolean().default(false),
  target: requestConfirmationTargetSchema.optional(),
});
export type RequestConfirmationPayload = z.infer<
  typeof requestConfirmationPayloadSchema
>;

export const requestConfirmationResultSchema = z.object({
  outcome: z.enum([
    "accepted",
    "rejected",
    "superseded_by_comment",
    "stale_target",
    "expired",
  ]),
  reason: z.string().max(2000).optional(),
});
export type RequestConfirmationResult = z.infer<
  typeof requestConfirmationResultSchema
>;

// ---- Composite types ------------------------------------------------------

/** Common identity / metadata fields. */
export interface ThreadInteractionBase {
  id: string;
  companyId: string;
  issueId: string;
  status: ThreadInteractionStatus;
  continuationPolicy: ThreadInteractionContinuationPolicy;
  idempotencyKey: string | null;
  sourceCommentId: string | null;
  sourceRunId: string | null;
  title: string | null;
  summary: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  resolvedByAgentId: string | null;
  resolvedByUserId: string | null;
  resumeToken: Record<string, unknown> | null;
  resolvedAt: Date | null;
  acceptedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ThreadInteraction =
  | (ThreadInteractionBase & {
      kind: "suggest_tasks";
      payload: SuggestTasksPayload;
      result: SuggestTasksResult | null;
    })
  | (ThreadInteractionBase & {
      kind: "ask_questions";
      payload: AskQuestionsPayload;
      result: AskQuestionsResult | null;
    })
  | (ThreadInteractionBase & {
      kind: "request_confirmation";
      payload: RequestConfirmationPayload;
      result: RequestConfirmationResult | null;
    });

// ---- Request/response validators ------------------------------------------

const baseCreateFields = {
  idempotencyKey: z.string().min(1).max(200).optional(),
  continuationPolicy: z
    .enum(THREAD_INTERACTION_CONTINUATION_POLICIES)
    .default("wake_assignee"),
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(2000).optional(),
  sourceCommentId: z.string().uuid().optional(),
  sourceRunId: z.string().uuid().optional(),
  resumeToken: z.record(z.string(), z.unknown()).optional(),
  expiresAt: z.string().datetime().optional(),
};

export const createSuggestTasksInteractionSchema = z.object({
  ...baseCreateFields,
  kind: z.literal("suggest_tasks"),
  payload: suggestTasksPayloadSchema,
});
export type CreateSuggestTasksInteraction = z.infer<
  typeof createSuggestTasksInteractionSchema
>;

export const createAskQuestionsInteractionSchema = z.object({
  ...baseCreateFields,
  kind: z.literal("ask_questions"),
  payload: askQuestionsPayloadSchema,
});
export type CreateAskQuestionsInteraction = z.infer<
  typeof createAskQuestionsInteractionSchema
>;

export const createRequestConfirmationInteractionSchema = z.object({
  ...baseCreateFields,
  kind: z.literal("request_confirmation"),
  payload: requestConfirmationPayloadSchema,
});
export type CreateRequestConfirmationInteraction = z.infer<
  typeof createRequestConfirmationInteractionSchema
>;

export const createThreadInteractionSchema = z.discriminatedUnion("kind", [
  createSuggestTasksInteractionSchema,
  createAskQuestionsInteractionSchema,
  createRequestConfirmationInteractionSchema,
]);
export type CreateThreadInteraction = z.infer<typeof createThreadInteractionSchema>;

export const acceptThreadInteractionSchema = z.object({
  /** suggest_tasks: which clientKeys to actually create. Defaults to all. */
  selectedClientKeys: z.array(z.string()).optional(),
  /** Free-form note that goes into the audit trail. */
  note: z.string().max(2000).optional(),
});
export type AcceptThreadInteraction = z.infer<
  typeof acceptThreadInteractionSchema
>;

export const rejectThreadInteractionSchema = z.object({
  reason: z.string().max(2000).optional(),
});
export type RejectThreadInteraction = z.infer<
  typeof rejectThreadInteractionSchema
>;

export const respondThreadInteractionSchema = z.object({
  /** ask_questions: the user's answers. */
  answers: z.array(askQuestionsAnswerSchema).optional(),
});
export type RespondThreadInteraction = z.infer<
  typeof respondThreadInteractionSchema
>;
