/**
 * Unified workflow autonomous triggers — Phase 2 service.
 *
 * One service handles all three channels (schedule / webhook / issue) and
 * all three actions (launch_run / launch_step / complete_step) for a
 * Governed Workflow. The data model lives in `workflow_triggers` +
 * `workflow_trigger_audit` (see migration `0084_workflow_triggers.sql`).
 *
 * The schedule tick (which uses `pg_advisory_xact_lock` to serialize
 * concurrent ticks across instances) lives in `./workflow-triggers-tick.js`
 * to keep this module focused on CRUD + the synchronous webhook fire path.
 *
 * **Identity model (§1.7 human traceability)**
 *   Every fire surfaces under the identity of the user who CREATED the
 *   trigger, regardless of channel:
 *     - schedule  → `created_by_user_id` (no live actor at fire time)
 *     - webhook   → `created_by_user_id` (the request is signed, not
 *                   authenticated as a user — the audit attributes back
 *                   to the human who installed the trigger)
 *     - issue     → `created_by_user_id` of the trigger, NOT the issue's
 *                   actor (the issue actor is captured separately in
 *                   `actor_user_id`).
 *
 * **Idempotency**
 *   Webhook fires require an `Idempotency-Key` header. The server uses
 *   `(company_id, trigger_id, idempotency_key)` as a partial unique
 *   index — replays return 200 with the original audit row, never
 *   re-fire downstream.
 *
 * **Action whitelisting (`complete_step`)**
 *   `complete_step` triggers can ONLY approve/reject steps listed in
 *   `allowed_step_keys`. This is the single guard between a leaked
 *   webhook secret and an attacker greenlighting a prod deploy. The
 *   trigger's own `stepKey` MUST be present in the whitelist for the
 *   trigger to be created (cf. `assertCreateInput`).
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  workflowTriggers,
  workflowTriggerAudit,
  type WorkflowTriggerRow,
  type WorkflowTriggerAuditRow,
} from "@mnm/db";
import { notFound, conflict, badRequest, forbidden, unprocessable } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";
import { nextCronTick } from "./_cron.js";
import {
  encryptWebhookSecret,
  decryptWebhookSecret,
  generatePublicId,
  generateWebhookSecret,
  verifyBearerSecret,
  verifyHmacSignature,
} from "./_webhook-signing.js";
import type { GovernedWorkflowService } from "./governed-workflows.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkflowTriggerKind = "schedule" | "webhook" | "issue";
export type WorkflowTriggerAction = "launch_run" | "launch_step" | "complete_step";
export type WorkflowTriggerSigningMode = "bearer" | "hmac_sha256";

export interface CreateWorkflowTriggerInput {
  workflowDefRef: string;
  kind: WorkflowTriggerKind;
  action: WorkflowTriggerAction;
  stepKey?: string | null;
  allowedStepKeys?: string[];
  label?: string | null;
  enabled?: boolean;
  cronExpression?: string | null;
  timezone?: string | null;
  signingMode?: WorkflowTriggerSigningMode;
  replayWindowSec?: number | null;
  issueMatch?: Record<string, unknown> | null;
  payloadTemplate?: Record<string, unknown>;
}

export interface UpdateWorkflowTriggerInput {
  enabled?: boolean;
  label?: string | null;
  cronExpression?: string | null;
  timezone?: string | null;
  replayWindowSec?: number | null;
  signingMode?: WorkflowTriggerSigningMode;
  stepKey?: string | null;
  allowedStepKeys?: string[];
  issueMatch?: Record<string, unknown> | null;
  payloadTemplate?: Record<string, unknown>;
}

export interface FireWebhookInput {
  publicId: string;
  headers: {
    authorization?: string;
    "x-trigger-signature"?: string;
    "x-trigger-timestamp"?: string;
  };
  rawBody: string;
  /** Mandatory dedup key. Routes reject missing header BEFORE the service. */
  idempotencyKey: string;
}

export interface FireRequestBody {
  inputs?: Record<string, unknown>;
  runId?: string;
  stepExecutionId?: string;
  verdict?: "approved" | "rejected";
  note?: string;
}

export interface FireResult {
  outcome: "ok" | "replayed";
  runId: string | null;
  stepExecutionId: string | null;
  audit: WorkflowTriggerAuditRow;
}

export interface WorkflowTriggersServiceDeps {
  /**
   * Governed Workflows service. Required for any *fire* path
   * (`verifyAndFire`, plus the tick in `workflow-triggers-tick.js`).
   * CRUD methods do not need it — config-only callers can omit.
   */
  governed?: GovernedWorkflowService;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a `workflow_def_ref`. Accepted forms:
 *   - `workflows/<name>@<git-tag>`  (canonical, mirrors composite uses)
 *   - `workflows/<name>`            (no pinning)
 *   - `<name>`                      (loose convenience form)
 */
export function parseWorkflowDefRef(ref: string): { name: string; gitTag?: string } {
  const m = /^workflows\/([^@]+)(?:@(.+))?$/.exec(ref);
  if (m) {
    const name = m[1]!;
    const gitTag = m[2];
    return gitTag === undefined ? { name } : { name, gitTag };
  }
  return { name: ref };
}

const TRIGGER_KINDS: WorkflowTriggerKind[] = ["schedule", "webhook", "issue"];
const TRIGGER_ACTIONS: WorkflowTriggerAction[] = ["launch_run", "launch_step", "complete_step"];

function assertCreateInput(data: CreateWorkflowTriggerInput): void {
  if (!data.workflowDefRef || data.workflowDefRef.trim().length === 0) {
    throw badRequest("workflowDefRef is required");
  }
  if (!TRIGGER_KINDS.includes(data.kind)) {
    throw badRequest(`Invalid trigger kind: ${data.kind}`);
  }
  if (!TRIGGER_ACTIONS.includes(data.action)) {
    throw badRequest(`Invalid trigger action: ${data.action}`);
  }

  if (data.action !== "launch_run" && !data.stepKey) {
    throw badRequest(`stepKey is required for action=${data.action}`);
  }
  if (data.action === "complete_step") {
    const whitelist = data.allowedStepKeys ?? [];
    if (whitelist.length === 0) {
      throw badRequest(
        "allowedStepKeys whitelist must list at least one stepKey for complete_step triggers",
      );
    }
    if (data.stepKey && !whitelist.includes(data.stepKey)) {
      throw badRequest(
        "stepKey must be present in allowedStepKeys whitelist for complete_step",
      );
    }
  }

  if (data.kind === "schedule") {
    if (!data.cronExpression) throw badRequest("cronExpression is required for schedule triggers");
    if (!data.timezone) throw badRequest("timezone is required for schedule triggers");
  }
  if (data.kind === "webhook") {
    if (!data.signingMode) throw badRequest("signingMode is required for webhook triggers");
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export function workflowTriggersService(db: Db, deps: WorkflowTriggersServiceDeps = {}) {
  function requireGoverned(): GovernedWorkflowService {
    if (!deps.governed) {
      throw unprocessable(
        "workflowTriggersService was constructed without a Governed Workflows dependency — fire paths are unavailable",
      );
    }
    return deps.governed;
  }

  async function getTriggerById(id: string, companyId: string): Promise<WorkflowTriggerRow> {
    const row = await db
      .select()
      .from(workflowTriggers)
      .where(and(eq(workflowTriggers.id, id), eq(workflowTriggers.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Workflow trigger not found");
    return row;
  }

  async function getTriggerByPublicId(publicId: string): Promise<WorkflowTriggerRow> {
    const row = await db
      .select()
      .from(workflowTriggers)
      .where(eq(workflowTriggers.publicId, publicId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Workflow trigger not found");
    return row;
  }

  async function findAuditByIdempotencyKey(
    companyId: string,
    triggerId: string,
    idempotencyKey: string,
  ): Promise<WorkflowTriggerAuditRow | null> {
    const row = await db
      .select()
      .from(workflowTriggerAudit)
      .where(
        and(
          eq(workflowTriggerAudit.companyId, companyId),
          eq(workflowTriggerAudit.triggerId, triggerId),
          eq(workflowTriggerAudit.idempotencyKey, idempotencyKey),
        ),
      )
      .then((rows) => rows[0] ?? null);
    return row;
  }

  async function insertAudit(args: {
    companyId: string;
    triggerId: string | null;
    workflowDefRef: string;
    action: string;
    outcome: string;
    runId: string | null;
    stepExecutionId: string | null;
    idempotencyKey: string | null;
    payload: Record<string, unknown>;
    actorUserId: string | null;
  }): Promise<WorkflowTriggerAuditRow> {
    const [row] = await db
      .insert(workflowTriggerAudit)
      .values({
        companyId: args.companyId,
        triggerId: args.triggerId,
        workflowDefRef: args.workflowDefRef,
        action: args.action,
        outcome: args.outcome,
        runId: args.runId,
        stepExecutionId: args.stepExecutionId,
        idempotencyKey: args.idempotencyKey,
        payload: args.payload,
        actorUserId: args.actorUserId,
      })
      .returning();
    return row!;
  }

  async function markFired(triggerId: string, outcome: string): Promise<void> {
    await db
      .update(workflowTriggers)
      .set({
        lastFiredAt: new Date(),
        lastResult: outcome,
        updatedAt: new Date(),
      })
      .where(eq(workflowTriggers.id, triggerId));
  }

  /** Strip well-known secret-bearing keys before persisting an audit payload. */
  function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const SENSITIVE_KEYS = new Set([
      "authorization", "Authorization",
      "x-trigger-signature", "X-Trigger-Signature",
      "secret", "token", "api_key", "apiKey", "password",
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }

  function parseFireBody(rawBody: string): FireRequestBody {
    if (rawBody.length === 0) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw badRequest("Request body is not valid JSON");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequest("Request body must be a JSON object");
    }
    const body = parsed as Record<string, unknown>;
    const out: FireRequestBody = {};
    if (body.inputs !== undefined) {
      if (typeof body.inputs !== "object" || body.inputs === null || Array.isArray(body.inputs)) {
        throw badRequest("body.inputs must be an object");
      }
      out.inputs = body.inputs as Record<string, unknown>;
    }
    if (body.runId !== undefined) {
      if (typeof body.runId !== "string") throw badRequest("body.runId must be a string");
      out.runId = body.runId;
    }
    if (body.stepExecutionId !== undefined) {
      if (typeof body.stepExecutionId !== "string") {
        throw badRequest("body.stepExecutionId must be a string");
      }
      out.stepExecutionId = body.stepExecutionId;
    }
    if (body.verdict !== undefined) {
      if (body.verdict !== "approved" && body.verdict !== "rejected") {
        throw badRequest("body.verdict must be 'approved' or 'rejected'");
      }
      out.verdict = body.verdict;
    }
    if (body.note !== undefined) {
      if (typeof body.note !== "string") throw badRequest("body.note must be a string");
      out.note = body.note;
    }
    return out;
  }

  async function dispatch(args: {
    trigger: WorkflowTriggerRow;
    body: FireRequestBody;
  }): Promise<{ runId: string | null; stepExecutionId: string | null }> {
    const governed = requireGoverned();
    const trigger = args.trigger;
    const actor = { type: "user" as const, id: trigger.createdByUserId };

    switch (trigger.action) {
      case "launch_run": {
        const { name, gitTag } = parseWorkflowDefRef(trigger.workflowDefRef);
        const params: Record<string, unknown> = {
          ...((trigger.payloadTemplate as Record<string, unknown>) ?? {}),
          ...(args.body.inputs ?? {}),
        };
        const result = await governed.launchWorkflow({
          companyId: trigger.companyId,
          name,
          gitTag,
          params,
          actor,
        });
        return { runId: result.runId, stepExecutionId: null };
      }

      case "launch_step": {
        if (!args.body.runId) {
          throw badRequest("body.runId is required for launch_step triggers");
        }
        if (!trigger.stepKey) {
          throw unprocessable("trigger.stepKey is missing — cannot launch step");
        }
        await governed.launchStep({
          companyId: trigger.companyId,
          runId: args.body.runId,
          stepId: trigger.stepKey,
          actor,
        });
        return { runId: args.body.runId, stepExecutionId: null };
      }

      case "complete_step": {
        if (!args.body.runId) {
          throw badRequest("body.runId is required for complete_step triggers");
        }
        if (!trigger.stepKey) {
          throw unprocessable("trigger.stepKey is missing — cannot complete step");
        }
        const whitelist = (trigger.allowedStepKeys as string[] | null) ?? [];
        if (!whitelist.includes(trigger.stepKey)) {
          throw forbidden(
            "stepKey is not present in allowed_step_keys whitelist — refusing to complete",
          );
        }
        if (args.body.verdict !== "approved" && args.body.verdict !== "rejected") {
          throw badRequest("body.verdict must be 'approved' or 'rejected' for complete_step");
        }
        await governed.completeStep({
          companyId: trigger.companyId,
          runId: args.body.runId,
          stepId: trigger.stepKey,
          artifact: {
            outputs: [],
            data: {
              verdict: args.body.verdict,
              note: args.body.note ?? null,
              completed_via_trigger_public_id: trigger.publicId,
            },
          },
          actor,
        });
        return { runId: args.body.runId, stepExecutionId: null };
      }

      default:
        throw unprocessable(`Unknown trigger action: ${trigger.action}`);
    }
  }

  return {
    // ── Internal accessors (used by the tick module) ───────────────────────
    _internals: { dispatch, insertAudit, markFired },

    // ── CRUD ───────────────────────────────────────────────────────────────

    async list(
      companyId: string,
      filter: { workflowDefRef?: string; kind?: WorkflowTriggerKind } = {},
    ): Promise<WorkflowTriggerRow[]> {
      const conditions = [eq(workflowTriggers.companyId, companyId)];
      if (filter.workflowDefRef) {
        conditions.push(eq(workflowTriggers.workflowDefRef, filter.workflowDefRef));
      }
      if (filter.kind) {
        conditions.push(eq(workflowTriggers.kind, filter.kind));
      }
      return db
        .select()
        .from(workflowTriggers)
        .where(and(...conditions));
    },

    async getById(id: string, companyId: string): Promise<WorkflowTriggerRow> {
      return getTriggerById(id, companyId);
    },

    async create(
      companyId: string,
      data: CreateWorkflowTriggerInput,
      createdByUserId: string,
    ): Promise<WorkflowTriggerRow & { secret?: string }> {
      assertCreateInput(data);

      const values: typeof workflowTriggers.$inferInsert = {
        companyId,
        workflowDefRef: data.workflowDefRef,
        kind: data.kind,
        action: data.action,
        stepKey: data.stepKey ?? null,
        allowedStepKeys: data.allowedStepKeys ?? [],
        label: data.label ?? null,
        enabled: data.enabled ?? true,
        payloadTemplate: data.payloadTemplate ?? {},
        createdByUserId,
      };

      let plaintextSecret: string | undefined;

      if (data.kind === "schedule") {
        values.cronExpression = data.cronExpression;
        values.timezone = data.timezone;
        values.nextRunAt = nextCronTick(data.cronExpression!, data.timezone!);
      }
      if (data.kind === "webhook") {
        values.publicId = generatePublicId();
        plaintextSecret = generateWebhookSecret();
        values.secretHash = encryptWebhookSecret(plaintextSecret);
        values.signingMode = data.signingMode!;
        values.replayWindowSec = data.replayWindowSec ?? 300;
        values.lastRotatedAt = new Date();
      }
      if (data.kind === "issue") {
        values.issueMatch = data.issueMatch ?? null;
      }

      const [trigger] = await db.insert(workflowTriggers).values(values).returning();

      publishLiveEvent({
        companyId,
        type: "workflow_trigger.created",
        payload: { triggerId: trigger!.id, workflowDefRef: data.workflowDefRef, kind: data.kind },
        visibility: { scope: "company-wide" },
      });

      if (plaintextSecret !== undefined) {
        return { ...trigger!, secret: plaintextSecret };
      }
      return trigger!;
    },

    async update(
      id: string,
      companyId: string,
      patch: UpdateWorkflowTriggerInput,
    ): Promise<WorkflowTriggerRow> {
      const existing = await getTriggerById(id, companyId);

      const update: Partial<typeof workflowTriggers.$inferInsert> = {
        ...patch,
        updatedAt: new Date(),
      };

      if (existing.kind === "schedule" && (patch.cronExpression || patch.timezone)) {
        const expr = patch.cronExpression ?? existing.cronExpression;
        const tz = patch.timezone ?? existing.timezone ?? "UTC";
        if (expr) update.nextRunAt = nextCronTick(expr, tz);
      }

      const [updated] = await db
        .update(workflowTriggers)
        .set(update)
        .where(and(eq(workflowTriggers.id, id), eq(workflowTriggers.companyId, companyId)))
        .returning();

      publishLiveEvent({
        companyId,
        type: "workflow_trigger.updated",
        payload: { triggerId: id, workflowDefRef: existing.workflowDefRef },
        visibility: { scope: "company-wide" },
      });

      return updated!;
    },

    async delete(id: string, companyId: string): Promise<void> {
      const existing = await getTriggerById(id, companyId);
      await db
        .delete(workflowTriggers)
        .where(and(eq(workflowTriggers.id, id), eq(workflowTriggers.companyId, companyId)));

      publishLiveEvent({
        companyId,
        type: "workflow_trigger.deleted",
        payload: { triggerId: id, workflowDefRef: existing.workflowDefRef },
        visibility: { scope: "company-wide" },
      });
    },

    async rotateSecret(
      id: string,
      companyId: string,
    ): Promise<{ trigger: WorkflowTriggerRow; secret: string }> {
      const existing = await getTriggerById(id, companyId);
      if (existing.kind !== "webhook") {
        throw conflict("Secret rotation is only valid for webhook triggers");
      }

      const plaintext = generateWebhookSecret();
      const [updated] = await db
        .update(workflowTriggers)
        .set({
          secretHash: encryptWebhookSecret(plaintext),
          lastRotatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowTriggers.id, id))
        .returning();

      publishLiveEvent({
        companyId,
        type: "workflow_trigger.secret_rotated",
        payload: { triggerId: id, workflowDefRef: existing.workflowDefRef },
        visibility: { scope: "company-wide" },
      });

      return { trigger: updated!, secret: plaintext };
    },

    // ── Public fire path ───────────────────────────────────────────────────

    async verifyAndFire(input: FireWebhookInput): Promise<FireResult> {
      const trigger = await getTriggerByPublicId(input.publicId);

      if (!trigger.enabled) {
        throw conflict("Workflow trigger is disabled");
      }
      if (trigger.kind !== "webhook") {
        throw conflict("Public fire is only available for webhook triggers");
      }

      // Idempotency dedup BEFORE signature work — a leaked Idempotency-Key
      // alone can only LOOKUP an existing audit, not fire something new.
      const replay = await findAuditByIdempotencyKey(
        trigger.companyId,
        trigger.id,
        input.idempotencyKey,
      );
      if (replay) {
        return {
          outcome: "replayed",
          runId: replay.runId,
          stepExecutionId: replay.stepExecutionId,
          audit: replay,
        };
      }

      const secret = decryptWebhookSecret(trigger.secretHash!);
      if (trigger.signingMode === "bearer") {
        verifyBearerSecret(input.headers.authorization, secret);
      } else if (trigger.signingMode === "hmac_sha256") {
        verifyHmacSignature({
          signature: input.headers["x-trigger-signature"],
          timestamp: input.headers["x-trigger-timestamp"],
          rawBody: input.rawBody,
          secret,
          replayWindowSec: trigger.replayWindowSec ?? 300,
        });
      } else {
        throw unprocessable("Trigger has no signing_mode set");
      }

      const body = parseFireBody(input.rawBody);

      let dispatchOutcome: { runId: string | null; stepExecutionId: string | null };
      try {
        dispatchOutcome = await dispatch({ trigger, body });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const audit = await insertAudit({
          companyId: trigger.companyId,
          triggerId: trigger.id,
          workflowDefRef: trigger.workflowDefRef,
          action: trigger.action,
          outcome: `error:${message}`.slice(0, 256),
          runId: null,
          stepExecutionId: null,
          idempotencyKey: input.idempotencyKey,
          payload: sanitizePayload(body as unknown as Record<string, unknown>),
          actorUserId: trigger.createdByUserId,
        });
        await markFired(trigger.id, audit.outcome);
        throw err;
      }

      const audit = await insertAudit({
        companyId: trigger.companyId,
        triggerId: trigger.id,
        workflowDefRef: trigger.workflowDefRef,
        action: trigger.action,
        outcome: "ok",
        runId: dispatchOutcome.runId,
        stepExecutionId: dispatchOutcome.stepExecutionId,
        idempotencyKey: input.idempotencyKey,
        payload: sanitizePayload(body as unknown as Record<string, unknown>),
        actorUserId: trigger.createdByUserId,
      });
      await markFired(trigger.id, "ok");

      publishLiveEvent({
        companyId: trigger.companyId,
        type: "workflow_trigger.fired",
        payload: {
          triggerId: trigger.id,
          workflowDefRef: trigger.workflowDefRef,
          action: trigger.action,
          runId: dispatchOutcome.runId,
        },
        visibility: { scope: "company-wide" },
      });

      return {
        outcome: "ok",
        runId: dispatchOutcome.runId,
        stepExecutionId: dispatchOutcome.stepExecutionId,
        audit,
      };
    },
  };
}

export type WorkflowTriggersService = ReturnType<typeof workflowTriggersService>;
