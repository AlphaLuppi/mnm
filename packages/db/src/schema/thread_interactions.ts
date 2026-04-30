/**
 * PAPERCLIP-PHASE2 — Inbox Interactive
 * Port of upstream PRs #4244 + #4381 (`issue_thread_interactions` upstream).
 *
 * Renamed `thread_interactions` for the MnM port to keep the table name short
 * and to leave headroom for future non-issue threads (chat threads, etc.).
 *
 * Multi-tenant: `company_id` is mandatory and the table has a RESTRICTIVE
 * RLS policy keyed on `app.current_company_id` (see migration 0074).
 *
 * Idempotency: a UNIQUE index on (company_id, issue_id, idempotency_key)
 * lets agents safely retry create-interaction calls after crashes — the
 * service layer detects the 23505 conflict and returns the existing row when
 * the request is "equivalent" (same kind/payload/actor).
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";
import { issueComments } from "./issue_comments.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

/**
 * The kind of structured interaction.
 * - suggest_tasks: agent proposes child issues, user accepts/rejects subset.
 * - ask_questions: agent asks structured questions, user answers.
 * - request_confirmation: agent asks for explicit accept/reject of a proposal.
 */
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
export type ThreadInteractionStatus = (typeof THREAD_INTERACTION_STATUSES)[number];

export const THREAD_INTERACTION_CONTINUATION_POLICIES = [
  "wake_assignee",
  "manual",
] as const;
export type ThreadInteractionContinuationPolicy =
  (typeof THREAD_INTERACTION_CONTINUATION_POLICIES)[number];

/** Generic shape of the JSONB payload (typed per-kind in @mnm/shared). */
export type ThreadInteractionPayload = Record<string, unknown>;
export type ThreadInteractionResult = Record<string, unknown>;

/** Resume token: opaque JSON stash the agent uses to resume a continuation. */
export type ThreadInteractionResumeToken = Record<string, unknown>;

export const threadInteractions = pgTable(
  "thread_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    kind: text("kind").notNull(), // ThreadInteractionKind
    status: text("status").notNull().default("pending"), // ThreadInteractionStatus
    continuationPolicy: text("continuation_policy").notNull().default("wake_assignee"),
    idempotencyKey: text("idempotency_key"),
    sourceCommentId: uuid("source_comment_id").references(() => issueComments.id, {
      onDelete: "set null",
    }),
    sourceRunId: uuid("source_run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    summary: text("summary"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    resolvedByAgentId: uuid("resolved_by_agent_id").references(() => agents.id),
    resolvedByUserId: text("resolved_by_user_id"),
    payload: jsonb("payload").$type<ThreadInteractionPayload>().notNull(),
    result: jsonb("result").$type<ThreadInteractionResult>(),
    resumeToken: jsonb("resume_token").$type<ThreadInteractionResumeToken>(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueIdx: index("thread_interactions_issue_idx").on(table.issueId),
    companyIssueCreatedAtIdx: index("thread_interactions_company_issue_created_at_idx").on(
      table.companyId,
      table.issueId,
      table.createdAt,
    ),
    companyIssueStatusIdx: index("thread_interactions_company_issue_status_idx").on(
      table.companyId,
      table.issueId,
      table.status,
    ),
    sourceCommentIdx: index("thread_interactions_source_comment_idx").on(table.sourceCommentId),
    /**
     * Idempotency uniqueness — partial unique index. The PG constraint name
     * MUST match the one in migration 0074 because the service layer matches
     * on it to detect duplicate-create conflicts (23505).
     */
    companyIssueIdempotencyUq: uniqueIndex("thread_interactions_company_issue_idempotency_uq")
      .on(table.companyId, table.issueId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  }),
);

export type ThreadInteractionRow = typeof threadInteractions.$inferSelect;
export type NewThreadInteraction = typeof threadInteractions.$inferInsert;

/** PG constraint name — keep in sync with the migration. Used by the service for 23505 detection. */
export const THREAD_INTERACTION_IDEMPOTENCY_CONSTRAINT =
  "thread_interactions_company_issue_idempotency_uq";
