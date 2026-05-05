import { and, eq, desc, sql, lte, asc, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  routines,
  routineTriggers,
  routineRuns,
  issues,
  companies,
  agents,
  issueReadStates,
} from "@mnm/db";
import {
  resolveRoutineVariableValues,
  interpolateRoutineTemplate,
  type CreateRoutine,
  type UpdateRoutine,
  type CreateRoutineTrigger,
  type UpdateRoutineTrigger,
  type RunRoutine,
} from "@mnm/shared";
import { notFound, conflict, unprocessable } from "../errors.js";
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

// ── Actor type ──────────────────────────────────────────────────────────────

interface Actor {
  userId?: string | null;
  agentId?: string | null;
}

// ── Terminal issue statuses ────────────────────────────────────────────────

const TERMINAL_ISSUE_STATUSES = ["done", "cancelled"];

// ── Service ─────────────────────────────────────────────────────────────────

export function routineService(db: Db) {
  // ── Helpers ─────────────────────────────────────────────────────────────

  async function assertRoutineOwnership(routineId: string, companyId: string) {
    const row = await db
      .select({ id: routines.id, companyId: routines.companyId })
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Routine not found");
    return row;
  }

  async function assertTriggerOwnership(triggerId: string, companyId: string) {
    const row = await db
      .select({
        id: routineTriggers.id,
        companyId: routineTriggers.companyId,
        routineId: routineTriggers.routineId,
      })
      .from(routineTriggers)
      .where(and(eq(routineTriggers.id, triggerId), eq(routineTriggers.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Trigger not found");
    return row;
  }

  async function assertAssignableAgent(companyId: string, agentId: string) {
    const assignee = await db
      .select({ id: agents.id, companyId: agents.companyId, status: agents.status })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);
    if (!assignee) throw notFound("Assignee agent not found");
    if (assignee.companyId !== companyId) {
      throw unprocessable("Assignee must belong to same company");
    }
    if (assignee.status === "pending_approval") {
      throw conflict("Cannot assign routine to pending approval agents");
    }
    if (assignee.status === "terminated") {
      throw conflict("Cannot assign routine to terminated agents");
    }
  }

  /**
   * Find the active (non-terminal) execution issue for a routine.
   */
  async function findActiveExecutionIssue(routineId: string, companyId: string) {
    const runs = await db
      .select({
        id: routineRuns.id,
        linkedIssueId: routineRuns.linkedIssueId,
        status: routineRuns.status,
      })
      .from(routineRuns)
      .where(
        and(
          eq(routineRuns.routineId, routineId),
          eq(routineRuns.companyId, companyId),
          inArray(routineRuns.status, ["received", "dispatched"]),
        ),
      )
      .orderBy(desc(routineRuns.triggeredAt))
      .limit(1);

    if (runs.length === 0) return null;
    const run = runs[0]!;
    if (!run.linkedIssueId) return { run, issue: null };

    const issue = await db
      .select({ id: issues.id, status: issues.status })
      .from(issues)
      .where(eq(issues.id, run.linkedIssueId))
      .then((rows) => rows[0] ?? null);

    if (!issue || TERMINAL_ISSUE_STATUSES.includes(issue.status)) {
      return null;
    }
    return { run, issue };
  }

  /**
   * Create an execution issue for a routine run.
   */
  async function createExecutionIssue(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    routine: typeof routines.$inferSelect,
    resolvedDescription: string,
    actor: Actor,
  ) {
    const [company] = await tx
      .update(companies)
      .set({ issueCounter: sql`${companies.issueCounter} + 1` })
      .where(eq(companies.id, routine.companyId))
      .returning({ issueCounter: companies.issueCounter, issuePrefix: companies.issuePrefix });

    const issueNumber = company!.issueCounter;
    const identifier = `${company!.issuePrefix}-${issueNumber}`;

    const [issue] = await tx
      .insert(issues)
      .values({
        companyId: routine.companyId,
        projectId: routine.projectId,
        goalId: routine.goalId,
        parentId: routine.parentIssueId,
        title: routine.title,
        description: resolvedDescription,
        status: "todo",
        priority: routine.priority,
        assigneeAgentId: routine.assigneeAgentId,
        createdByUserId: actor.userId ?? null,
        createdByAgentId: actor.agentId ?? null,
        issueNumber,
        identifier,
      })
      .returning();

    return issue!;
  }

  /**
   * v2026.428.0 #4615 — when a manual runner triggers a routine and the run
   * is coalesced/skipped (concurrency policy), surface the still-active issue
   * in the runner's inbox by touching their `issue_read_states` row. Without
   * this, manual runs disappear silently and the operator can't tell the
   * trigger fired.
   */
  async function touchIssueForUserInbox(
    companyId: string,
    issueId: string,
    userId: string,
  ) {
    const now = new Date();
    await db
      .insert(issueReadStates)
      .values({
        companyId,
        issueId,
        userId,
        lastReadAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [issueReadStates.companyId, issueReadStates.issueId, issueReadStates.userId],
        set: { lastReadAt: now, updatedAt: now },
      });
  }

  /**
   * Core run logic — extracted so it can be called from both runRoutine and tickScheduledTriggers.
   */
  async function dispatchRun(
    routineId: string,
    companyId: string,
    data: RunRoutine,
    actor: Actor,
  ) {
    const routine = await db
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.companyId, companyId)))
      .then((rows) => rows[0] ?? null);

    if (!routine) throw notFound("Routine not found");
    if (routine.status !== "active") {
      throw conflict("Routine is not active");
    }

    // 1. Resolve variables
    const variableDefs = (routine.variables ?? []) as Array<{
      name: string;
      label: string | null;
      type: "text" | "textarea" | "number" | "boolean" | "select";
      defaultValue: string | number | boolean | null;
      required: boolean;
      options: string[];
    }>;
    const resolvedVars = resolveRoutineVariableValues(variableDefs, {
      payload: data.payload ?? null,
      variables: data.variables ?? null,
    });

    // 2. Interpolate description
    const resolvedDescription = routine.description
      ? interpolateRoutineTemplate(routine.description, resolvedVars)
      : "";

    // 3. Check concurrency policy
    const activeExec = await findActiveExecutionIssue(routineId, companyId);

    // v2026.428.0 #4615 — keep manual runs visible in the runner inbox even
    // when coalesced/skipped. (MnM's Actor type only carries userId/agentId,
    // so we condition on data.source==="manual" + actor.userId presence.)
    const manualRunnerUserId =
      data.source === "manual" && actor.userId ? actor.userId : null;

    if (activeExec?.issue) {
      if (routine.concurrencyPolicy === "skip_if_active") {
        const [skippedRun] = await db
          .insert(routineRuns)
          .values({
            companyId,
            routineId,
            triggerId: data.triggerId ?? null,
            source: data.source,
            status: "skipped",
            triggerPayload: data.payload ?? {},
            idempotencyKey: data.idempotencyKey ?? null,
            failureReason: `Skipped: active issue ${activeExec.issue.id} already running`,
          })
          .returning();
        if (manualRunnerUserId) {
          await touchIssueForUserInbox(companyId, activeExec.issue.id, manualRunnerUserId);
        }
        return { run: skippedRun!, coalesced: false, skipped: true };
      }

      if (routine.concurrencyPolicy === "coalesce_if_active") {
        const [coalescedRun] = await db
          .insert(routineRuns)
          .values({
            companyId,
            routineId,
            triggerId: data.triggerId ?? null,
            source: data.source,
            status: "coalesced",
            triggerPayload: data.payload ?? {},
            idempotencyKey: data.idempotencyKey ?? null,
            coalescedIntoRunId: activeExec.run.id,
          })
          .returning();
        if (manualRunnerUserId) {
          await touchIssueForUserInbox(companyId, activeExec.issue.id, manualRunnerUserId);
        }
        return { run: coalescedRun!, coalesced: true, skipped: false };
      }
      // "always_enqueue" falls through
    }

    // 4. Idempotency check
    if (data.idempotencyKey) {
      const existing = await db
        .select({ id: routineRuns.id })
        .from(routineRuns)
        .where(
          and(
            eq(routineRuns.routineId, routineId),
            eq(routineRuns.companyId, companyId),
            eq(routineRuns.idempotencyKey, data.idempotencyKey),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (existing) {
        throw conflict("Duplicate idempotency key");
      }
    }

    // 5. Create run + execution issue in transaction
    const result = await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(routineRuns)
        .values({
          companyId,
          routineId,
          triggerId: data.triggerId ?? null,
          source: data.source,
          status: "dispatched",
          triggerPayload: data.payload ?? {},
          idempotencyKey: data.idempotencyKey ?? null,
        })
        .returning();

      const issue = await createExecutionIssue(tx, routine, resolvedDescription, actor);

      // Link issue to run
      await tx
        .update(routineRuns)
        .set({ linkedIssueId: issue.id, updatedAt: new Date() })
        .where(eq(routineRuns.id, run!.id));

      // Update routine timestamps
      await tx
        .update(routines)
        .set({
          lastTriggeredAt: new Date(),
          lastEnqueuedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(routines.id, routineId));

      return { run: { ...run!, linkedIssueId: issue.id }, issue };
    });

    // 6. Publish SSE events
    publishLiveEvent({
      companyId,
      type: "routine.run_created",
      visibility: { scope: "agents", agentIds: [routine.assigneeAgentId] },
      payload: { routineId, runId: result.run.id, issueId: result.issue.id },
    });

    return { run: result.run, coalesced: false, skipped: false, issue: result.issue };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  return {
    /**
     * List routines with their triggers and last run info.
     */
    list: async (companyId: string) => {
      const rows = await db
        .select()
        .from(routines)
        .where(eq(routines.companyId, companyId))
        .orderBy(desc(routines.createdAt));

      if (rows.length === 0) return [];

      const routineIds = rows.map((r) => r.id);

      // Fetch all triggers
      const allTriggers = await db
        .select()
        .from(routineTriggers)
        .where(
          and(
            eq(routineTriggers.companyId, companyId),
            inArray(routineTriggers.routineId, routineIds),
          ),
        )
        .orderBy(asc(routineTriggers.createdAt));

      // Fetch all runs (ordered desc) to find last run per routine
      const allRuns = await db
        .select()
        .from(routineRuns)
        .where(
          and(
            eq(routineRuns.companyId, companyId),
            inArray(routineRuns.routineId, routineIds),
          ),
        )
        .orderBy(desc(routineRuns.triggeredAt));

      // Group triggers by routine
      const triggersByRoutine = new Map<string, (typeof allTriggers)[number][]>();
      for (const t of allTriggers) {
        const arr = triggersByRoutine.get(t.routineId) ?? [];
        arr.push(t);
        triggersByRoutine.set(t.routineId, arr);
      }

      // Last run per routine (first occurrence because ordered desc)
      const lastRunByRoutine = new Map<string, (typeof allRuns)[number]>();
      for (const r of allRuns) {
        if (!lastRunByRoutine.has(r.routineId)) {
          lastRunByRoutine.set(r.routineId, r);
        }
      }

      return rows.map((routine) => ({
        ...routine,
        triggers: triggersByRoutine.get(routine.id) ?? [],
        lastRun: lastRunByRoutine.get(routine.id) ?? null,
      }));
    },

    /**
     * Get a single routine with triggers, recent runs, and active issue.
     */
    getById: async (companyId: string, id: string) => {
      const routine = await db
        .select()
        .from(routines)
        .where(and(eq(routines.id, id), eq(routines.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!routine) return null;

      const triggers = await db
        .select()
        .from(routineTriggers)
        .where(
          and(
            eq(routineTriggers.routineId, id),
            eq(routineTriggers.companyId, companyId),
          ),
        )
        .orderBy(asc(routineTriggers.createdAt));

      const recentRuns = await db
        .select()
        .from(routineRuns)
        .where(
          and(
            eq(routineRuns.routineId, id),
            eq(routineRuns.companyId, companyId),
          ),
        )
        .orderBy(desc(routineRuns.triggeredAt))
        .limit(25);

      const activeExecution = await findActiveExecutionIssue(id, companyId);

      return {
        ...routine,
        triggers,
        recentRuns,
        activeIssue: activeExecution?.issue ?? null,
      };
    },

    /**
     * Create a new routine.
     */
    create: async (companyId: string, data: CreateRoutine, actor: Actor) => {
      await assertAssignableAgent(companyId, data.assigneeAgentId);

      const [routine] = await db
        .insert(routines)
        .values({
          companyId,
          title: data.title,
          description: data.description ?? null,
          projectId: data.projectId ?? null,
          goalId: data.goalId ?? null,
          parentIssueId: data.parentIssueId ?? null,
          assigneeAgentId: data.assigneeAgentId,
          priority: data.priority,
          status: data.status,
          concurrencyPolicy: data.concurrencyPolicy,
          catchUpPolicy: data.catchUpPolicy,
          variables: data.variables,
          createdByUserId: actor.userId ?? null,
          createdByAgentId: actor.agentId ?? null,
        })
        .returning();

      publishLiveEvent({
        companyId,
        type: "routine.created",
        visibility: { scope: "agents", agentIds: [data.assigneeAgentId] },
        payload: { routineId: routine!.id },
      });

      return routine!;
    },

    /**
     * Update a routine.
     */
    update: async (id: string, companyId: string, data: UpdateRoutine, actor: Actor) => {
      await assertRoutineOwnership(id, companyId);

      if (data.assigneeAgentId) {
        await assertAssignableAgent(companyId, data.assigneeAgentId);
      }

      const patch: Partial<typeof routines.$inferInsert> = {
        ...data,
        updatedByUserId: actor.userId ?? null,
        updatedByAgentId: actor.agentId ?? null,
        updatedAt: new Date(),
      };

      const [updated] = await db
        .update(routines)
        .set(patch)
        .where(and(eq(routines.id, id), eq(routines.companyId, companyId)))
        .returning();

      if (!updated) throw notFound("Routine not found");

      publishLiveEvent({
        companyId,
        type: "routine.updated",
        payload: { routineId: id },
        visibility: { scope: "agents", agentIds: [updated.assigneeAgentId] },
      });

      return updated;
    },

    /**
     * Create a trigger for a routine.
     */
    createTrigger: async (
      routineId: string,
      companyId: string,
      data: CreateRoutineTrigger,
      actor: Actor,
    ) => {
      await assertRoutineOwnership(routineId, companyId);

      const values: typeof routineTriggers.$inferInsert = {
        companyId,
        routineId,
        kind: data.kind,
        label: data.label ?? null,
        createdByUserId: actor.userId ?? null,
        createdByAgentId: actor.agentId ?? null,
      };

      if (data.kind === "schedule") {
        values.cronExpression = data.cronExpression;
        values.timezone = data.timezone;
        values.nextRunAt = nextCronTick(data.cronExpression, data.timezone);
      }

      // SEC-T11-04: encrypt webhook secrets at rest
      let webhookPlaintextSecret: string | undefined;
      if (data.kind === "webhook") {
        values.publicId = generatePublicId();
        webhookPlaintextSecret = generateWebhookSecret();
        values.secretHash = encryptWebhookSecret(webhookPlaintextSecret);
        values.signingMode = data.signingMode;
        values.replayWindowSec = data.replayWindowSec;
        values.lastRotatedAt = new Date();
      }

      const [trigger] = await db
        .insert(routineTriggers)
        .values(values)
        .returning();

      publishLiveEvent({
        companyId,
        type: "routine.updated",
        payload: { routineId },
        visibility: { scope: "company-wide" },
      });

      // For webhooks, include the plaintext secret in the response (shown only once at creation)
      if (data.kind === "webhook" && webhookPlaintextSecret !== undefined) {
        return {
          ...trigger!,
          secret: webhookPlaintextSecret,
        };
      }

      return trigger!;
    },

    /**
     * Update a trigger.
     */
    updateTrigger: async (triggerId: string, companyId: string, data: UpdateRoutineTrigger) => {
      const existing = await assertTriggerOwnership(triggerId, companyId);

      const patch: Partial<typeof routineTriggers.$inferInsert> = {
        ...data,
        updatedAt: new Date(),
      };

      // If cron expression or timezone changed, recalculate nextRunAt
      if (data.cronExpression || data.timezone) {
        const trigger = await db
          .select()
          .from(routineTriggers)
          .where(eq(routineTriggers.id, triggerId))
          .then((rows) => rows[0]!);

        const expr = data.cronExpression ?? trigger.cronExpression;
        const tz = data.timezone ?? trigger.timezone ?? "UTC";
        if (expr) {
          patch.nextRunAt = nextCronTick(expr, tz);
        }
      }

      const [updated] = await db
        .update(routineTriggers)
        .set(patch)
        .where(and(eq(routineTriggers.id, triggerId), eq(routineTriggers.companyId, companyId)))
        .returning();

      if (!updated) throw notFound("Trigger not found");

      publishLiveEvent({
        companyId,
        type: "routine.updated",
        payload: { routineId: existing.routineId },
        visibility: { scope: "company-wide" },
      });

      return updated;
    },

    /**
     * Delete a trigger.
     */
    deleteTrigger: async (triggerId: string, companyId: string) => {
      const existing = await assertTriggerOwnership(triggerId, companyId);

      await db
        .delete(routineTriggers)
        .where(and(eq(routineTriggers.id, triggerId), eq(routineTriggers.companyId, companyId)));

      publishLiveEvent({
        companyId,
        type: "routine.updated",
        payload: { routineId: existing.routineId },
        visibility: { scope: "company-wide" },
      });
    },

    /**
     * Manually trigger a routine run (or via API trigger).
     */
    runRoutine: dispatchRun,

    /**
     * List runs for a routine.
     */
    listRuns: async (routineId: string, companyId: string, limit = 50) => {
      await assertRoutineOwnership(routineId, companyId);

      return db
        .select()
        .from(routineRuns)
        .where(
          and(
            eq(routineRuns.routineId, routineId),
            eq(routineRuns.companyId, companyId),
          ),
        )
        .orderBy(desc(routineRuns.triggeredAt))
        .limit(limit);
    },

    /**
     * Tick all scheduled triggers whose nextRunAt <= now.
     * Called periodically by a cron service.
     */
    tickScheduledTriggers: async () => {
      const now = new Date();
      const dueTriggers = await db
        .select({
          trigger: routineTriggers,
          routine: routines,
        })
        .from(routineTriggers)
        .innerJoin(routines, eq(routineTriggers.routineId, routines.id))
        .where(
          and(
            eq(routineTriggers.kind, "schedule"),
            eq(routineTriggers.enabled, true),
            lte(routineTriggers.nextRunAt, now),
            eq(routines.status, "active"),
          ),
        );

      const results: Array<{ triggerId: string; routineId: string; status: string }> = [];

      for (const { trigger, routine } of dueTriggers) {
        try {
          // Compute next run time before dispatching
          const nextRun = nextCronTick(
            trigger.cronExpression!,
            trigger.timezone ?? "UTC",
            now,
          );

          // Update trigger nextRunAt + lastFiredAt
          await db
            .update(routineTriggers)
            .set({
              nextRunAt: nextRun,
              lastFiredAt: now,
              lastResult: "ok",
              updatedAt: now,
            })
            .where(eq(routineTriggers.id, trigger.id));

          // Dispatch run
          const runResult = await dispatchRun(
            routine.id,
            routine.companyId,
            {
              source: "api",
              triggerId: trigger.id,
            },
            { userId: routine.createdByUserId, agentId: routine.createdByAgentId },
          );

          results.push({
            triggerId: trigger.id,
            routineId: routine.id,
            status: runResult.skipped ? "skipped" : runResult.coalesced ? "coalesced" : "dispatched",
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          await db
            .update(routineTriggers)
            .set({
              lastFiredAt: now,
              lastResult: `error: ${message}`,
              updatedAt: now,
            })
            .where(eq(routineTriggers.id, trigger.id));

          results.push({
            triggerId: trigger.id,
            routineId: routine.id,
            status: `error: ${message}`,
          });
        }
      }

      return results;
    },

    /**
     * When an issue reaches a terminal status, update the linked routine run.
     */
    syncRunStatusForIssue: async (issueId: string) => {
      const run = await db
        .select()
        .from(routineRuns)
        .where(eq(routineRuns.linkedIssueId, issueId))
        .then((rows) => rows[0] ?? null);

      if (!run) return null;

      const issue = await db
        .select({ id: issues.id, status: issues.status })
        .from(issues)
        .where(eq(issues.id, issueId))
        .then((rows) => rows[0] ?? null);

      if (!issue || !TERMINAL_ISSUE_STATUSES.includes(issue.status)) {
        return null;
      }

      const now = new Date();
      const runStatus = issue.status === "done" ? "completed" : "cancelled";

      const [updated] = await db
        .update(routineRuns)
        .set({
          status: runStatus,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(routineRuns.id, run.id))
        .returning();

      // Look up the routine's assignee agent for scoped visibility
      const routine = await db
        .select({ assigneeAgentId: routines.assigneeAgentId })
        .from(routines)
        .where(eq(routines.id, run.routineId))
        .then((rows) => rows[0] ?? null);

      publishLiveEvent({
        companyId: run.companyId,
        type: "routine.run_completed",
        payload: { routineId: run.routineId, runId: run.id, issueId, status: runStatus },
        visibility: routine?.assigneeAgentId
          ? { scope: "agents", agentIds: [routine.assigneeAgentId] }
          : { scope: "company-wide" },
      });

      return updated;
    },

    /**
     * Verify a webhook request and fire the routine.
     */
    verifyWebhookAndFire: async (
      publicId: string,
      headers: {
        authorization?: string;
        "x-routine-signature"?: string;
        "x-routine-timestamp"?: string;
      },
      rawBody: string,
    ) => {
      const trigger = await db
        .select()
        .from(routineTriggers)
        .where(eq(routineTriggers.publicId, publicId))
        .then((rows) => rows[0] ?? null);

      if (!trigger) throw notFound("Webhook not found");
      if (!trigger.enabled) throw conflict("Webhook trigger is disabled");

      const routine = await db
        .select()
        .from(routines)
        .where(eq(routines.id, trigger.routineId))
        .then((rows) => rows[0] ?? null);

      if (!routine) throw notFound("Routine not found");
      if (routine.status !== "active") throw conflict("Routine is not active");

      // SEC-T11-04: decrypt the stored secret before using it for comparison
      const secret = decryptWebhookSecret(trigger.secretHash!);

      if (trigger.signingMode === "bearer") {
        verifyBearerSecret(headers.authorization, secret);
      } else if (trigger.signingMode === "hmac_sha256") {
        verifyHmacSignature({
          signature: headers["x-routine-signature"],
          timestamp: headers["x-routine-timestamp"],
          rawBody,
          secret,
          replayWindowSec: trigger.replayWindowSec ?? 300,
        });
      }

      // Dispatch the run
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(rawBody);
      } catch {
        // non-JSON body is fine, just empty payload
      }

      const result = await dispatchRun(
        routine.id,
        routine.companyId,
        {
          source: "api",
          triggerId: trigger.id,
          payload,
        },
        { userId: routine.createdByUserId, agentId: routine.createdByAgentId },
      );

      // Update trigger lastFiredAt
      await db
        .update(routineTriggers)
        .set({
          lastFiredAt: new Date(),
          lastResult: result.skipped ? "skipped" : result.coalesced ? "coalesced" : "ok",
          updatedAt: new Date(),
        })
        .where(eq(routineTriggers.id, trigger.id));

      return result;
    },
  };
}
