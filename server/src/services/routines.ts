import { and, eq, desc, sql, lte, asc, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import type { Db } from "@mnm/db";
import {
  routines,
  routineTriggers,
  routineRuns,
  issues,
  companies,
  agents,
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
import { notFound, conflict, unprocessable, badRequest } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";

// ── Cron parsing ────────────────────────────────────────────────────────────

interface CronFields {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const stepParts = part.split("/");
    const rangePart = stepParts[0]!;
    const step = stepParts[1] ? parseInt(stepParts[1], 10) : 1;

    let start: number;
    let end: number;

    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [lo, hi] = rangePart.split("-");
      start = parseInt(lo!, 10);
      end = parseInt(hi!, 10);
    } else {
      start = parseInt(rangePart, 10);
      end = start;
    }

    if (isNaN(start) || isNaN(end) || isNaN(step)) continue;
    start = Math.max(start, min);
    end = Math.min(end, max);

    for (let i = start; i <= end; i += step) {
      values.add(i);
    }
  }

  return [...values].sort((a, b) => a - b);
}

function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw badRequest(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }
  return {
    minutes: parseCronField(parts[0]!, 0, 59),
    hours: parseCronField(parts[1]!, 0, 23),
    daysOfMonth: parseCronField(parts[2]!, 1, 31),
    months: parseCronField(parts[3]!, 1, 12),
    daysOfWeek: parseCronField(parts[4]!, 0, 6),
  };
}

/**
 * Convert a Date to the components in a given timezone using Intl.DateTimeFormat.
 */
function dateInTz(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    year: parseInt(parts.year!, 10),
    month: parseInt(parts.month!, 10),
    day: parseInt(parts.day!, 10),
    hour: parseInt(parts.hour!, 10),
    minute: parseInt(parts.minute!, 10),
    second: parseInt(parts.second!, 10),
  };
}

/**
 * Create a Date from components in a given timezone.
 */
function dateFromTz(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): Date {
  // Build an ISO-ish string and use the tz offset to invert
  const isoBase = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;

  // Estimate: create a date in UTC, then adjust by the offset
  const estimateUtc = new Date(`${isoBase}Z`);
  const inTz = dateInTz(estimateUtc, timezone);
  const offsetMinutes =
    (inTz.hour * 60 + inTz.minute) - (estimateUtc.getUTCHours() * 60 + estimateUtc.getUTCMinutes());
  const adjusted = new Date(estimateUtc.getTime() - offsetMinutes * 60_000);

  // Verify and correct (DST edge cases)
  const check = dateInTz(adjusted, timezone);
  if (check.hour !== hour || check.minute !== minute) {
    const delta = (hour - check.hour) * 60 + (minute - check.minute);
    return new Date(adjusted.getTime() + delta * 60_000);
  }
  return adjusted;
}

/**
 * Compute the next cron tick strictly after `after` in the given timezone.
 * Searches forward up to 366 days.
 */
export function nextCronTick(
  expression: string,
  timezone: string,
  after: Date = new Date(),
): Date {
  const cron = parseCron(expression);
  const maxIterations = 366 * 24 * 60; // safety cap
  const tz = dateInTz(after, timezone);

  let year = tz.year;
  let month = tz.month;
  let day = tz.day;
  let hour = tz.hour;
  let minute = tz.minute + 1; // strictly after

  for (let i = 0; i < maxIterations; i++) {
    // Normalize overflow
    if (minute > 59) {
      minute = 0;
      hour++;
    }
    if (hour > 23) {
      hour = 0;
      day++;
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month++;
    }
    if (month > 12) {
      month = 1;
      year++;
    }

    // Check month
    if (!cron.months.includes(month)) {
      day = 1;
      hour = 0;
      minute = 0;
      month++;
      continue;
    }

    // Check day of month
    if (!cron.daysOfMonth.includes(day)) {
      hour = 0;
      minute = 0;
      day++;
      continue;
    }

    // Check day of week
    const candidate = dateFromTz(year, month, day, hour, minute, 0, timezone);
    const candidateDow = candidate.getDay();
    if (!cron.daysOfWeek.includes(candidateDow)) {
      hour = 0;
      minute = 0;
      day++;
      continue;
    }

    // Check hour
    if (!cron.hours.includes(hour)) {
      minute = 0;
      hour++;
      continue;
    }

    // Check minute
    if (!cron.minutes.includes(minute)) {
      minute++;
      continue;
    }

    // All fields match — build the final date
    const result = dateFromTz(year, month, day, hour, minute, 0, timezone);
    if (result.getTime() > after.getTime()) {
      return result;
    }
    // Edge case: DST made us not actually be after `after`
    minute++;
  }

  throw unprocessable("Could not compute next cron tick within 366 days");
}

// ── Timing-safe string comparison ──────────────────────────────────────────

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

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

      if (data.kind === "webhook") {
        values.publicId = crypto.randomBytes(16).toString("hex");
        const secret = crypto.randomBytes(32).toString("hex");
        values.secretHash = secret; // stored as hex; verified via HMAC or bearer comparison
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
      });

      // For webhooks, include the secret in the response (only shown once at creation)
      if (data.kind === "webhook") {
        return {
          ...trigger!,
          secret: values.secretHash,
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

      publishLiveEvent({
        companyId: run.companyId,
        type: "routine.run_completed",
        payload: { routineId: run.routineId, runId: run.id, issueId, status: runStatus },
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

      const secret = trigger.secretHash!;

      if (trigger.signingMode === "bearer") {
        const token = headers.authorization?.replace(/^Bearer\s+/i, "");
        if (!token || !timingSafeCompare(token, secret)) {
          throw badRequest("Invalid bearer token");
        }
      } else if (trigger.signingMode === "hmac_sha256") {
        const signature = headers["x-routine-signature"];
        const timestamp = headers["x-routine-timestamp"];
        if (!signature || !timestamp) {
          throw badRequest("Missing signature or timestamp headers");
        }

        // Replay protection
        const tsNumber = parseInt(timestamp, 10);
        const windowSec = trigger.replayWindowSec ?? 300;
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - tsNumber) > windowSec) {
          throw badRequest("Timestamp outside replay window");
        }

        const expected = crypto
          .createHmac("sha256", secret)
          .update(`${timestamp}.${rawBody}`)
          .digest("hex");

        if (!timingSafeCompare(signature, expected)) {
          throw badRequest("Invalid HMAC signature");
        }
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
