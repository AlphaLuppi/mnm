/**
 * productivity-review — stall / churn detection helpers.
 *
 * Phase 5 (paperclip-upstream-merge plan, "patterns volés intégrés").
 * Source patterns: paperclipai/paperclip #4083, #4419, #4587, #4700,
 * #4701 — Productivity Review service that auto-opens follow-up issues
 * for stalled work.
 *
 * **Scope of THIS file**:
 *   - Helper `detectStalledIssue(db, issueId, opts)` that returns a
 *     structured verdict the caller can act on (open a CAO comment,
 *     emit an `activityEvents.runStalled` event, escalate, etc).
 *   - Typed event-name constants `activityEventTypes` so the rest of
 *     the codebase doesn't sprinkle string literals (`"run_stalled"`,
 *     `"high_churn_loop"`, ...).
 *
 * **Out of scope (deliberately)**:
 *   - The full Productivity Review service (auto-opens review issues,
 *     dispatches recovery sweeps, idle inbox jumps). That's a dedicated
 *     sprint, not a Phase 5 deliverable. See plan §5.5 (defer).
 *   - The `governed_workflow_runs.resumable_token` column (Phase 4).
 *   - Any DB schema changes — `audit_events.action` is already free-form
 *     `text`, so the typed enum here is an emit-time invariant, not a
 *     migration. We only document this so future readers don't try to
 *     migrate.
 *
 * The helper is intentionally read-only against the DB so it's safe to
 * call from any context (CAO watchdog, scheduled sweep, ad-hoc tool).
 */

import { and, eq, gte, sql, desc, isNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { issues, issueComments, heartbeatRuns } from "@mnm/db";

// ---------- typed activity-event names ----------

/**
 * Canonical event-type names for productivity / liveness signals.
 *
 * These are the values that should be passed as `action` (or its
 * equivalent column) when emitting through `audit-emitter`,
 * `activity_log`, or any future typed-events bus. Using the constants
 * instead of bare strings means a typo surfaces at TypeScript-compile
 * time and `Find Usages` works.
 *
 * The string values intentionally use `dot.case` (paperclip convention)
 * so future automation can group them by family (`run.*`, `issue.*`).
 *
 * If you add a new event type:
 *   1. Add it here with a brief comment.
 *   2. Reference it from the producing service.
 *   3. If the event needs a typed payload, declare it in
 *      `ActivityEventPayloads` below.
 */
export const activityEventTypes = {
  /** A heartbeat_runs row has been idle past its stall threshold. */
  runStalled: "run.stalled",
  /** An issue has been `in_progress` past its no-comment threshold. */
  issueNoCommentStreak: "issue.no_comment_streak",
  /** An issue is receiving comments rapidly without a status change. */
  issueHighChurnLoop: "issue.high_churn_loop",
} as const;

export type ActivityEventType = (typeof activityEventTypes)[keyof typeof activityEventTypes];

/**
 * Strongly-typed payload schemas keyed by event name. Consumers that
 * need to fan out events should import from here instead of redefining.
 */
export interface ActivityEventPayloads {
  [activityEventTypes.runStalled]: {
    runId: string;
    agentId: string;
    issueId: string | null;
    startedAt: string | null;
    lastEventAt: string | null;
    stalledForMs: number;
  };
  [activityEventTypes.issueNoCommentStreak]: {
    issueId: string;
    inProgressSince: string;
    lastCommentAt: string | null;
    streakHours: number;
  };
  [activityEventTypes.issueHighChurnLoop]: {
    issueId: string;
    commentCount: number;
    windowHours: number;
    lastStatusChangeAt: string | null;
  };
}

// ---------- options + verdict types ----------

/** Default thresholds — tweakable per call. Conservative on purpose. */
export const PRODUCTIVITY_REVIEW_DEFAULTS = {
  /** Issue stays `in_progress` longer than this without comments → stalled. */
  noCommentStreakHours: 24,
  /** More than this many comments inside the window → churn. */
  churnCommentsThreshold: 8,
  /** Sliding window for churn detection. */
  churnWindowHours: 4,
  /** Heartbeat run with `last_event_at` older than this → stalled. */
  runStalledMs: 15 * 60 * 1000,
} as const;

export interface DetectStalledIssueOptions {
  /** Reference timestamp; defaults to `new Date()`. Inject for tests. */
  now?: Date;
  /** Override individual thresholds (else use PRODUCTIVITY_REVIEW_DEFAULTS). */
  noCommentStreakHours?: number;
  churnCommentsThreshold?: number;
  churnWindowHours?: number;
  runStalledMs?: number;
}

/**
 * Result of `detectStalledIssue`. Each signal is independent; an issue
 * can trigger several at once (e.g. stalled run AND high churn).
 *
 * `recommendedEvent` picks the highest-priority active signal so callers
 * that want a single event can use it without merging logic.
 */
export interface StalledIssueVerdict {
  issueId: string;
  status: string | null;
  evaluatedAt: string;
  signals: {
    noCommentStreak: {
      triggered: boolean;
      streakHours: number;
      lastCommentAt: string | null;
    };
    highChurnLoop: {
      triggered: boolean;
      commentCount: number;
      windowHours: number;
      lastStatusChangeAt: string | null;
    };
    runStalled: {
      triggered: boolean;
      runId: string | null;
      agentId: string | null;
      startedAt: string | null;
      lastEventAt: string | null;
      stalledForMs: number | null;
    };
  };
  recommendedEvent: ActivityEventType | null;
}

// ---------- helpers ----------

function hoursBetween(later: Date, earlier: Date | null | undefined): number {
  if (!earlier) return Number.POSITIVE_INFINITY;
  const diffMs = later.getTime() - earlier.getTime();
  return diffMs / (60 * 60 * 1000);
}

/**
 * Detect whether an issue exhibits stall/churn patterns worth a
 * productivity-review touch. Pure read; never writes.
 *
 * Implementation notes:
 *   - We look up the issue once and short-circuit when status is
 *     terminal (`done` / `cancelled`) — those can never trigger.
 *   - For `noCommentStreak` we compare against the most recent comment
 *     OR `started_at` if the issue has none.
 *   - For `highChurnLoop` we count comments in the sliding window AND
 *     verify the issue's `updated_at` is unchanged in that span.
 *     `updated_at` proxies status changes here; if MnM later separates
 *     last-status-change-at from last-touched-at, swap the column.
 *   - For `runStalled` we use the issue's `executionRunId` if present;
 *     the heuristic is `now - max(updated_at, started_at) > runStalledMs`.
 *     A more precise signal would require a `last_useful_action_at` —
 *     when that lands (Phase 4 #4587), update this to use it.
 */
export async function detectStalledIssue(
  db: Db,
  issueId: string,
  opts: DetectStalledIssueOptions = {},
): Promise<StalledIssueVerdict> {
  const now = opts.now ?? new Date();
  const cfg = {
    noCommentStreakHours:
      opts.noCommentStreakHours ?? PRODUCTIVITY_REVIEW_DEFAULTS.noCommentStreakHours,
    churnCommentsThreshold:
      opts.churnCommentsThreshold ?? PRODUCTIVITY_REVIEW_DEFAULTS.churnCommentsThreshold,
    churnWindowHours:
      opts.churnWindowHours ?? PRODUCTIVITY_REVIEW_DEFAULTS.churnWindowHours,
    runStalledMs: opts.runStalledMs ?? PRODUCTIVITY_REVIEW_DEFAULTS.runStalledMs,
  };

  const baseVerdict: StalledIssueVerdict = {
    issueId,
    status: null,
    evaluatedAt: now.toISOString(),
    signals: {
      noCommentStreak: { triggered: false, streakHours: 0, lastCommentAt: null },
      highChurnLoop: {
        triggered: false,
        commentCount: 0,
        windowHours: cfg.churnWindowHours,
        lastStatusChangeAt: null,
      },
      runStalled: {
        triggered: false,
        runId: null,
        agentId: null,
        startedAt: null,
        lastEventAt: null,
        stalledForMs: null,
      },
    },
    recommendedEvent: null,
  };

  const [issueRow] = await db
    .select({
      id: issues.id,
      status: issues.status,
      startedAt: issues.startedAt,
      updatedAt: issues.updatedAt,
      executionRunId: issues.executionRunId,
      assigneeAgentId: issues.assigneeAgentId,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issueRow) return baseVerdict;
  baseVerdict.status = issueRow.status;
  // Terminal states can never be "stalled".
  if (issueRow.status === "done" || issueRow.status === "cancelled") {
    return baseVerdict;
  }

  // ---------- signal 1: no-comment streak ----------
  if (issueRow.status === "in_progress") {
    const [latest] = await db
      .select({ createdAt: issueComments.createdAt })
      .from(issueComments)
      .where(eq(issueComments.issueId, issueId))
      .orderBy(desc(issueComments.createdAt))
      .limit(1);
    const lastCommentAt = latest?.createdAt ?? null;
    const referenceForStreak = lastCommentAt ?? issueRow.startedAt ?? null;
    const streakHours = hoursBetween(now, referenceForStreak);
    const triggered = streakHours >= cfg.noCommentStreakHours;
    baseVerdict.signals.noCommentStreak = {
      triggered,
      streakHours: Number.isFinite(streakHours) ? Number(streakHours.toFixed(2)) : streakHours,
      lastCommentAt: lastCommentAt ? new Date(lastCommentAt).toISOString() : null,
    };
  }

  // ---------- signal 2: high churn loop ----------
  {
    const windowStart = new Date(now.getTime() - cfg.churnWindowHours * 60 * 60 * 1000);
    const [{ count }] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueComments)
      .where(
        and(
          eq(issueComments.issueId, issueId),
          gte(issueComments.createdAt, windowStart),
        ),
      )) as Array<{ count: number }>;
    const lastStatusChangeAt = issueRow.updatedAt
      ? new Date(issueRow.updatedAt).toISOString()
      : null;
    const updatedRecentlyMs = issueRow.updatedAt
      ? now.getTime() - new Date(issueRow.updatedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const updatedDuringWindow = updatedRecentlyMs <= cfg.churnWindowHours * 60 * 60 * 1000;
    const triggered =
      Number(count) >= cfg.churnCommentsThreshold && !updatedDuringWindow;
    baseVerdict.signals.highChurnLoop = {
      triggered,
      commentCount: Number(count),
      windowHours: cfg.churnWindowHours,
      lastStatusChangeAt,
    };
  }

  // ---------- signal 3: run stalled ----------
  if (issueRow.executionRunId) {
    const [runRow] = await db
      .select({
        id: heartbeatRuns.id,
        agentId: heartbeatRuns.agentId,
        startedAt: heartbeatRuns.startedAt,
        finishedAt: heartbeatRuns.finishedAt,
        updatedAt: heartbeatRuns.updatedAt,
        status: heartbeatRuns.status,
      })
      .from(heartbeatRuns)
      .where(and(eq(heartbeatRuns.id, issueRow.executionRunId), isNull(heartbeatRuns.finishedAt)))
      .limit(1);
    if (runRow) {
      const lastEvent = runRow.updatedAt ?? runRow.startedAt ?? null;
      const stalledForMs = lastEvent
        ? now.getTime() - new Date(lastEvent).getTime()
        : Number.POSITIVE_INFINITY;
      const triggered =
        Number.isFinite(stalledForMs) &&
        stalledForMs >= cfg.runStalledMs &&
        runRow.status !== "completed" &&
        runRow.status !== "succeeded" &&
        runRow.status !== "cancelled" &&
        runRow.status !== "failed";
      baseVerdict.signals.runStalled = {
        triggered,
        runId: runRow.id,
        agentId: runRow.agentId,
        startedAt: runRow.startedAt ? new Date(runRow.startedAt).toISOString() : null,
        lastEventAt: lastEvent ? new Date(lastEvent).toISOString() : null,
        stalledForMs: Number.isFinite(stalledForMs) ? stalledForMs : null,
      };
    }
  }

  // ---------- recommended event ----------
  // Priority: stalled run (most actionable) > churn (loud) > no-comment streak.
  if (baseVerdict.signals.runStalled.triggered) {
    baseVerdict.recommendedEvent = activityEventTypes.runStalled;
  } else if (baseVerdict.signals.highChurnLoop.triggered) {
    baseVerdict.recommendedEvent = activityEventTypes.issueHighChurnLoop;
  } else if (baseVerdict.signals.noCommentStreak.triggered) {
    baseVerdict.recommendedEvent = activityEventTypes.issueNoCommentStreak;
  }
  return baseVerdict;
}

// ---------- pure-function exports for unit testing ----------

/**
 * Pure version of `detectStalledIssue` that operates on already-fetched
 * data. The async helper above is just a thin DB-fetcher wrapping this.
 * Easier to unit-test (no DB needed).
 */
export interface DetectStalledIssueInput {
  issue: {
    id: string;
    status: string;
    startedAt: Date | null;
    updatedAt: Date | null;
    executionRunId: string | null;
  };
  comments: Array<{ createdAt: Date }>;
  run: {
    id: string;
    agentId: string;
    startedAt: Date | null;
    updatedAt: Date | null;
    finishedAt: Date | null;
    status: string;
  } | null;
}

export function detectStalledIssuePure(
  input: DetectStalledIssueInput,
  opts: DetectStalledIssueOptions = {},
): StalledIssueVerdict {
  const now = opts.now ?? new Date();
  const cfg = {
    noCommentStreakHours:
      opts.noCommentStreakHours ?? PRODUCTIVITY_REVIEW_DEFAULTS.noCommentStreakHours,
    churnCommentsThreshold:
      opts.churnCommentsThreshold ?? PRODUCTIVITY_REVIEW_DEFAULTS.churnCommentsThreshold,
    churnWindowHours:
      opts.churnWindowHours ?? PRODUCTIVITY_REVIEW_DEFAULTS.churnWindowHours,
    runStalledMs: opts.runStalledMs ?? PRODUCTIVITY_REVIEW_DEFAULTS.runStalledMs,
  };
  const verdict: StalledIssueVerdict = {
    issueId: input.issue.id,
    status: input.issue.status,
    evaluatedAt: now.toISOString(),
    signals: {
      noCommentStreak: { triggered: false, streakHours: 0, lastCommentAt: null },
      highChurnLoop: {
        triggered: false,
        commentCount: 0,
        windowHours: cfg.churnWindowHours,
        lastStatusChangeAt: null,
      },
      runStalled: {
        triggered: false,
        runId: null,
        agentId: null,
        startedAt: null,
        lastEventAt: null,
        stalledForMs: null,
      },
    },
    recommendedEvent: null,
  };
  if (input.issue.status === "done" || input.issue.status === "cancelled") {
    return verdict;
  }
  // Streak.
  if (input.issue.status === "in_progress") {
    const sortedComments = [...input.comments].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const lastCommentAt = sortedComments[0]?.createdAt ?? null;
    const reference = lastCommentAt ?? input.issue.startedAt ?? null;
    const streakHours = hoursBetween(now, reference);
    verdict.signals.noCommentStreak = {
      triggered: streakHours >= cfg.noCommentStreakHours,
      streakHours: Number.isFinite(streakHours) ? Number(streakHours.toFixed(2)) : streakHours,
      lastCommentAt: lastCommentAt ? lastCommentAt.toISOString() : null,
    };
  }
  // Churn.
  const windowStart = new Date(now.getTime() - cfg.churnWindowHours * 60 * 60 * 1000);
  const commentCount = input.comments.filter((c) => c.createdAt >= windowStart).length;
  const updatedRecentlyMs = input.issue.updatedAt
    ? now.getTime() - input.issue.updatedAt.getTime()
    : Number.POSITIVE_INFINITY;
  const updatedDuringWindow = updatedRecentlyMs <= cfg.churnWindowHours * 60 * 60 * 1000;
  verdict.signals.highChurnLoop = {
    triggered: commentCount >= cfg.churnCommentsThreshold && !updatedDuringWindow,
    commentCount,
    windowHours: cfg.churnWindowHours,
    lastStatusChangeAt: input.issue.updatedAt ? input.issue.updatedAt.toISOString() : null,
  };
  // Stalled run.
  if (input.run && input.run.finishedAt === null) {
    const lastEvent = input.run.updatedAt ?? input.run.startedAt ?? null;
    const stalledForMs = lastEvent
      ? now.getTime() - lastEvent.getTime()
      : Number.POSITIVE_INFINITY;
    const terminalStatuses = new Set(["completed", "succeeded", "cancelled", "failed"]);
    verdict.signals.runStalled = {
      triggered:
        Number.isFinite(stalledForMs) &&
        stalledForMs >= cfg.runStalledMs &&
        !terminalStatuses.has(input.run.status),
      runId: input.run.id,
      agentId: input.run.agentId,
      startedAt: input.run.startedAt ? input.run.startedAt.toISOString() : null,
      lastEventAt: lastEvent ? lastEvent.toISOString() : null,
      stalledForMs: Number.isFinite(stalledForMs) ? stalledForMs : null,
    };
  }
  if (verdict.signals.runStalled.triggered) {
    verdict.recommendedEvent = activityEventTypes.runStalled;
  } else if (verdict.signals.highChurnLoop.triggered) {
    verdict.recommendedEvent = activityEventTypes.issueHighChurnLoop;
  } else if (verdict.signals.noCommentStreak.triggered) {
    verdict.recommendedEvent = activityEventTypes.issueNoCommentStreak;
  }
  return verdict;
}
