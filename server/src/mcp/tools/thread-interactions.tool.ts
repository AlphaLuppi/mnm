/**
 * PAPERCLIP-PHASE2 — Inbox Interactive MCP tools.
 *
 * Three new MCP tools that let agents create structured cards in an
 * issue thread instead of asking yes/no questions in markdown:
 *
 *   - `propose_task`         → kind=suggest_tasks   (1..N child issues)
 *   - `ask_questions`        → kind=ask_questions   (structured questions)
 *   - `request_confirmation` → kind=request_confirmation (explicit accept/reject)
 *
 * Naming chosen to mirror upstream paperclipai/paperclip MCP tool
 * names (paperclipSuggestTasks, etc.) but adapted to MnM's snake_case
 * tool-name convention (consistent with `list_issues`, `create_issue`).
 *
 * Permission: thread_interactions:create — agents must have this slug.
 * Defense in depth: companyId comes from the McpActor, NOT input.
 */
import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import {
  askQuestionsPayloadSchema,
  requestConfirmationPayloadSchema,
  suggestTasksPayloadSchema,
} from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("propose_task", {
    permissions: [PERMISSIONS.THREAD_INTERACTIONS_CREATE],
    description:
      "[Inbox Interactive] Propose 1..N child tasks (issues) for the user to accept or reject as a structured card.\n" +
      "Use when the user must explicitly choose which suggested tasks to create.\n" +
      "If you already know what to do, just create the issues directly with create_issue.\n" +
      "The user can accept the whole set, accept a subset (selectedClientKeys), or reject the proposal.",
    input: z.object({
      issueId: z.string().uuid().describe("The issue this card lives in"),
      idempotencyKey: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe(
          "Stable key for retries — recommended format: `propose:${runId}:${revision}`. Same payload returns the existing card.",
        ),
      title: z.string().min(1).max(200).optional(),
      summary: z.string().max(2000).optional(),
      sourceRunId: z
        .string()
        .uuid()
        .optional()
        .describe("Heartbeat run that produced the card (for traceability)"),
      continuationPolicy: z
        .enum(["wake_assignee", "manual"])
        .default("wake_assignee")
        .describe("wake_assignee = wake the issue assignee on accept; manual = caller polls"),
      payload: suggestTasksPayloadSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.threadInteractions.create(
        actor.companyId,
        input.issueId,
        {
          kind: "suggest_tasks" as const,
          idempotencyKey: input.idempotencyKey,
          title: input.title,
          summary: input.summary,
          sourceRunId: input.sourceRunId,
          continuationPolicy: input.continuationPolicy,
          payload: input.payload,
        },
        { agentId: actor.agentId ?? null, userId: actor.userId ?? null },
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ id: result.id, kind: result.kind, status: result.status }) },
        ],
      };
    },
  });

  tool("ask_questions", {
    permissions: [PERMISSIONS.THREAD_INTERACTIONS_CREATE],
    description:
      "[Inbox Interactive] Ask the user 1..N structured questions (single-choice, multi-choice, or free text) as a card.\n" +
      "Each question has an `id`, `prompt`, `kind`, `required`, and (for choice questions) `options`.\n" +
      "The user answers via the UI. With continuationPolicy=wake_assignee, you'll be woken when the answer arrives.",
    input: z.object({
      issueId: z.string().uuid(),
      idempotencyKey: z.string().min(1).max(200).optional(),
      title: z.string().min(1).max(200).optional(),
      summary: z.string().max(2000).optional(),
      sourceRunId: z.string().uuid().optional(),
      continuationPolicy: z.enum(["wake_assignee", "manual"]).default("wake_assignee"),
      payload: askQuestionsPayloadSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.threadInteractions.create(
        actor.companyId,
        input.issueId,
        {
          kind: "ask_questions" as const,
          idempotencyKey: input.idempotencyKey,
          title: input.title,
          summary: input.summary,
          sourceRunId: input.sourceRunId,
          continuationPolicy: input.continuationPolicy,
          payload: input.payload,
        },
        { agentId: actor.agentId ?? null, userId: actor.userId ?? null },
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ id: result.id, kind: result.kind, status: result.status }) },
        ],
      };
    },
  });

  tool("request_confirmation", {
    permissions: [PERMISSIONS.THREAD_INTERACTIONS_CREATE],
    description:
      "[Inbox Interactive] Request an explicit accept/reject from the user (e.g. plan approval). Use this instead of asking 'yes/no' in markdown.\n" +
      "For plan approval, target the latest `plan` issue document and use idempotencyKey=`confirmation:${issueId}:plan:${revisionId}`.\n" +
      "Set `supersedeOnUserComment: true` if a later user comment should auto-cancel a stale request.",
    input: z.object({
      issueId: z.string().uuid(),
      idempotencyKey: z.string().min(1).max(200).optional(),
      title: z.string().min(1).max(200).optional(),
      summary: z.string().max(2000).optional(),
      sourceRunId: z.string().uuid().optional(),
      continuationPolicy: z.enum(["wake_assignee", "manual"]).default("wake_assignee"),
      payload: requestConfirmationPayloadSchema,
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.threadInteractions.create(
        actor.companyId,
        input.issueId,
        {
          kind: "request_confirmation" as const,
          idempotencyKey: input.idempotencyKey,
          title: input.title,
          summary: input.summary,
          sourceRunId: input.sourceRunId,
          continuationPolicy: input.continuationPolicy,
          payload: input.payload,
        },
        { agentId: actor.agentId ?? null, userId: actor.userId ?? null },
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ id: result.id, kind: result.kind, status: result.status }) },
        ],
      };
    },
  });
});
