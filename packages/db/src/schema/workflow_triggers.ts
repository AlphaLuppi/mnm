import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";

/**
 * Phase 1 — Unified workflow autonomous triggers.
 *
 * A workflow_trigger is a stable handle that lets a workflow (or one of its
 * steps) be actioned from any of three channels — schedule (cron), webhook
 * (signed external POST), or issue (transition / agent decision) — and
 * produces one of three actions on the target Governed Workflow:
 *   - launch_run    : start a new run with mapped inputs
 *   - launch_step   : advance a specific step in an existing run
 *   - complete_step : approve/reject a HITL step (whitelist-guarded)
 *
 * `workflow_def_ref` is a text reference (e.g. `workflows/<name>@<git-tag>` or
 * a definition id) — kept loosely typed so a trigger can outlive renames /
 * retags without an FK rewrite. The service layer resolves it at fire time.
 *
 * `created_by_user_id` is mandatory per §1.7 human traceability — every fire
 * surfaces under the identity of the user who created the trigger.
 */
export const workflowTriggers = pgTable(
  "workflow_triggers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Git ref or definition id pointing at the target workflow. */
    workflowDefRef: text("workflow_def_ref").notNull(),
    /** schedule | webhook | issue */
    kind: text("kind").notNull(),
    /** launch_run | launch_step | complete_step */
    action: text("action").notNull(),
    /** Required when action != launch_run. */
    stepKey: text("step_key"),
    /** Whitelist of step keys a `complete_step` trigger may approve/reject. */
    allowedStepKeys: jsonb("allowed_step_keys").$type<string[]>().notNull().default([]),
    label: text("label"),
    enabled: boolean("enabled").notNull().default(true),
    // Schedule fields
    cronExpression: text("cron_expression"),
    timezone: text("timezone"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    // Webhook fields
    publicId: text("public_id"),
    secretHash: text("secret_hash"),
    signingMode: text("signing_mode"),
    replayWindowSec: integer("replay_window_sec").default(300),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
    // Issue fields — opaque match payload, validated in service layer.
    issueMatch: jsonb("issue_match").$type<Record<string, unknown> | null>(),
    /** JSONata-style mapping from incoming payload to launchWorkflow inputs. */
    payloadTemplate: jsonb("payload_template").$type<Record<string, unknown>>().notNull().default({}),
    // Common
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    lastResult: text("last_result"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDefIdx: index("workflow_triggers_company_def_idx").on(
      table.companyId,
      table.workflowDefRef,
    ),
    companyKindIdx: index("workflow_triggers_company_kind_idx").on(
      table.companyId,
      table.kind,
      table.enabled,
    ),
    nextRunAtIdx: index("workflow_triggers_next_run_at_idx")
      .on(table.nextRunAt)
      .where(sql`${table.nextRunAt} IS NOT NULL`),
    publicIdUq: uniqueIndex("workflow_triggers_public_id_uq")
      .on(table.publicId)
      .where(sql`${table.publicId} IS NOT NULL`),
    kindCheck: check(
      "workflow_triggers_kind_check",
      sql`${table.kind} IN ('schedule','webhook','issue')`,
    ),
    actionCheck: check(
      "workflow_triggers_action_check",
      sql`${table.action} IN ('launch_run','launch_step','complete_step')`,
    ),
    signingModeCheck: check(
      "workflow_triggers_signing_mode_check",
      sql`${table.signingMode} IS NULL OR ${table.signingMode} IN ('bearer','hmac_sha256')`,
    ),
  }),
);

export type WorkflowTriggerRow = typeof workflowTriggers.$inferSelect;
export type NewWorkflowTrigger = typeof workflowTriggers.$inferInsert;

/**
 * Append-only audit log: one row per trigger fire (success or failure).
 * `idempotency_key` is the fence used by the webhook fire endpoint to dedup
 * replays from upstream callers (GitLab CI, GitHub Actions, N8N).
 */
export const workflowTriggerAudit = pgTable(
  "workflow_trigger_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    triggerId: uuid("trigger_id").references(() => workflowTriggers.id, { onDelete: "set null" }),
    workflowDefRef: text("workflow_def_ref").notNull(),
    action: text("action").notNull(),
    /** ok | invalid_signature | replayed | rejected | error:<msg> */
    outcome: text("outcome").notNull(),
    runId: uuid("run_id"),
    stepExecutionId: uuid("step_execution_id"),
    idempotencyKey: text("idempotency_key"),
    /** Sanitized request payload (secrets stripped before persistence). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    actorUserId: text("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTriggerIdx: index("workflow_trigger_audit_company_trigger_idx").on(
      table.companyId,
      table.triggerId,
      table.createdAt,
    ),
    idempotencyUq: uniqueIndex("workflow_trigger_audit_idempotency_uq")
      .on(table.companyId, table.triggerId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  }),
);

export type WorkflowTriggerAuditRow = typeof workflowTriggerAudit.$inferSelect;
export type NewWorkflowTriggerAudit = typeof workflowTriggerAudit.$inferInsert;
