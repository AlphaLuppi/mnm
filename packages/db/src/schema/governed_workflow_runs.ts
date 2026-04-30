import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AuditActorType } from "@mnm/shared";
import { companies } from "./companies.js";
import { governedWorkflowDefinitions } from "./governed_workflow_definitions.js";

export const GOVERNED_RUN_STATUSES = ["draft", "active", "completed", "failed"] as const;
export type GovernedRunStatus = (typeof GOVERNED_RUN_STATUSES)[number];

/**
 * Per-run recovery policy override. NULL on the row = inherit company-level
 * default (resolved by the liveness service from instance settings or env).
 */
export interface GovernedRunRecoveryPolicy {
  /** Master switch — if false, watchdog never auto-recovers this run. */
  enabled: boolean;
  /** Hard cap on auto-recovery attempts before surfacing to humans. */
  retries: number;
  /** Initial backoff before first retry; exponential after that. */
  backoffMs: number;
  /** Wall-clock seconds without `last_useful_action_at` movement before stall. */
  stallTimeoutSeconds: number;
}

export const governedWorkflowRuns = pgTable(
  "governed_workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    workflowDefId: uuid("workflow_def_id").notNull().references(() => governedWorkflowDefinitions.id),
    workflowGitTag: text("workflow_git_tag").notNull(),
    workflowGitSha: text("workflow_git_sha").notNull(),
    initiatedByActorType: text("initiated_by_actor_type").$type<AuditActorType>().notNull(),
    initiatedByActorId: text("initiated_by_actor_id").notNull(),
    status: text("status").$type<GovernedRunStatus>().notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    paramsJson: jsonb("params_json").$type<Record<string, unknown>>().notNull().default({}),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByActorId: text("cancelled_by_actor_id"),
    cancelledByActorType: text("cancelled_by_actor_type").$type<AuditActorType>(),
    cancellationReason: text("cancellation_reason"),
    // ── Liveness (Phase 4 / migration 0077) ────────────────────────────────
    // Opaque continuation blob the agent runtime stuffs with whatever it needs
    // to resume. JSONB so different adapters can stash heterogeneous shapes.
    resumableToken: jsonb("resumable_token").$type<Record<string, unknown> | null>(),
    // Distinct from heartbeat — only updated when the run made measurable
    // forward progress (artifact written, step completed, useful comment).
    lastUsefulActionAt: timestamp("last_useful_action_at", { withTimezone: true }),
    // Human-readable handoff string surfaced in UI + watchdog prompts.
    nextActionHint: text("next_action_hint"),
    // Auto-recovery accounting (#4587).
    recoveryAttempts: integer("recovery_attempts").notNull().default(0),
    lastRecoveredAt: timestamp("last_recovered_at", { withTimezone: true }),
    recoveryPolicyJson: jsonb("recovery_policy_json").$type<GovernedRunRecoveryPolicy | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("governed_workflow_runs_company_status_idx")
      .on(table.companyId, table.status),
    // Note: DESC on started_at lives only in the SQL (source of truth for migrations).
    // Drizzle 0.38's per-column `.desc()` helper isn't used elsewhere in this codebase —
    // keep the TS index declaration ascending.
    defStartedIdx: index("governed_workflow_runs_def_started_idx")
      .on(table.workflowDefId, table.startedAt),
    cancelledAtIdx: index("governed_workflow_runs_cancelled_at_idx")
      .on(table.companyId, table.cancelledAt)
      .where(sql`${table.cancelledAt} IS NOT NULL`),
    // Watchdog scan: active runs whose last useful action is older than the
    // configured timeout. The SQL migration uses a partial index on
    // status='active' AND last_useful_action_at IS NOT NULL — Drizzle's
    // index-builder doesn't easily express the compound predicate, so the
    // simpler shape here is fine (Postgres uses the SQL definition anyway).
    livenessIdx: index("governed_workflow_runs_liveness_idx")
      .on(table.companyId, table.status, table.lastUsefulActionAt)
      .where(sql`${table.status} = 'active' AND ${table.lastUsefulActionAt} IS NOT NULL`),
    recoveryAttemptsIdx: index("governed_workflow_runs_recovery_attempts_idx")
      .on(table.companyId, table.recoveryAttempts)
      .where(sql`${table.status} = 'active' AND ${table.recoveryAttempts} > 0`),
  }),
);
