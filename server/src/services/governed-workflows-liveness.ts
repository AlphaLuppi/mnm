/**
 * Run liveness + auto-recovery service for governed workflows (Phase 4).
 *
 * Ports concepts from upstream PRs:
 *   - #4083  Run liveness continuations + last-useful-action
 *   - #4419  Runtime lifecycle recovery + active-run watchdog
 *   - #4587  Configurable liveness auto-recovery (advisory + bounded)
 *
 * Spec: docs/superpowers/plans/2026-04-28-paperclip-upstream-merge.md §6.
 *
 * Design notes — multi-tenant + dynamic RBAC:
 *   - All queries are company-scoped. The watchdog runner shards by company
 *     so RLS context can be set before each scan.
 *   - Recovery never bypasses governed-workflow service invariants — it
 *     re-emits the same internal events (`governed_run.auto_recovered`) the
 *     state machine already consumes, plus a `governed_run.stalled` event
 *     for UI surfacing.
 *   - Auto-recovery is gated by a feature flag (LIVENESS_AUTO_RECOVERY) and
 *     a bounded retry counter (recovery_attempts). Default = advisory only.
 */

import { and, eq, gt, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  governedWorkflowRuns,
  type Db,
  type GovernedRunRecoveryPolicy,
} from "@mnm/db";
import type { LiveEventType } from "@mnm/shared";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Structural alias for a governed_workflow_runs row (post-0077).
 * Re-exported as a convenience so callers (routes, watchdog) don't need to
 * `import { typeof governedWorkflowRuns.$inferSelect }`.
 */
export type GovernedRunRow = typeof governedWorkflowRuns.$inferSelect;

/**
 * Minimal publish contract — same shape as `governed-run-events.ts`. Kept
 * inline so the test harness can pass a stub without importing the whole
 * realtime emitter module.
 */
export interface LivenessPublishFn {
  (event: { companyId: string; type: LiveEventType; payload?: Record<string, unknown> }): void;
}

/**
 * Default recovery policy used when the run row + company override are both
 * NULL. Conservative: advisory only by default (`enabled=false`). Operators
 * opt-in per-company or per-run.
 *
 * The defaults reflect plan §6.3 acceptance criteria:
 *   - retries: 3 (matches CAO watchdog cap)
 *   - backoffMs: 1000 (1s; exponential after first attempt)
 *   - stallTimeoutSeconds: 60 (AC says "<60s detection")
 */
export const DEFAULT_RECOVERY_POLICY: GovernedRunRecoveryPolicy = {
  enabled: false,
  retries: 3,
  backoffMs: 1000,
  stallTimeoutSeconds: 60,
} as const;

export interface DetectStalledRunsOptions {
  /**
   * Stall threshold in seconds. Falls back to the company default policy,
   * then DEFAULT_RECOVERY_POLICY.stallTimeoutSeconds.
   */
  stallTimeoutSeconds?: number;
  /**
   * Hard cap on the number of stalled rows returned per scan. Watchdog uses
   * a small batch (e.g. 50) to keep query latency bounded.
   */
  limit?: number;
  /**
   * Reference clock — only set in tests. In production we always use new Date().
   */
  now?: Date;
}

export interface DetectStalledRunsResult {
  /** Rows whose `last_useful_action_at` is older than the stall threshold. */
  stalled: GovernedRunRow[];
  /** When the scan ran — useful for the audit row in the watchdog. */
  scannedAt: Date;
}

export interface RecoverRunOptions {
  publishLiveEvent: LivenessPublishFn;
  /**
   * Override the resolved recovery policy. Useful for the manual REST
   * endpoint where an operator forces a recovery despite the policy being
   * advisory.
   */
  policyOverride?: Partial<GovernedRunRecoveryPolicy>;
  /**
   * If true, increments `recovery_attempts` even when the policy is
   * `enabled=false` (advisory-mode manual recovery). Default false.
   */
  forceManual?: boolean;
  /** Reference clock — only set in tests. */
  now?: Date;
}

export interface RecoverRunResult {
  runId: string;
  /** True if the recovery wake event was emitted. */
  recovered: boolean;
  /** Why recovery was skipped, if `recovered` is false. */
  reason?:
    | "run_not_found"
    | "run_not_active"
    | "policy_disabled"
    | "max_retries_exceeded";
  /** Counter value after this call (unchanged when `recovered=false` unless forceManual). */
  recoveryAttempts: number;
  /** When the recovery was initiated. */
  recoveredAt?: Date;
}

// ── Policy resolution ─────────────────────────────────────────────────────

/**
 * Compose the effective recovery policy for a run row. Order of precedence:
 *
 *   1. `policyOverride` (caller, e.g. forced manual recovery)
 *   2. `run.recoveryPolicyJson` (per-run policy stored in DB)
 *   3. Company-level default — TODO: pull from instance settings once the
 *      key is wired in. For now we only honour the env flag below.
 *   4. Process env `LIVENESS_AUTO_RECOVERY=true` flips `enabled` to true on
 *      DEFAULT_RECOVERY_POLICY (kept off in CI/tests by default).
 *   5. DEFAULT_RECOVERY_POLICY.
 *
 * We keep the function pure (no DB access, no env reads beyond the single
 * flag) so tests can construct policies deterministically.
 */
export function resolveRecoveryPolicy(args: {
  run: Pick<GovernedRunRow, "recoveryPolicyJson">;
  policyOverride?: Partial<GovernedRunRecoveryPolicy>;
  envEnabled?: boolean;
}): GovernedRunRecoveryPolicy {
  const envFlag = args.envEnabled ?? process.env.LIVENESS_AUTO_RECOVERY === "true";
  const base: GovernedRunRecoveryPolicy = {
    ...DEFAULT_RECOVERY_POLICY,
    enabled: envFlag,
  };
  const runPolicy = (args.run.recoveryPolicyJson ?? null) as GovernedRunRecoveryPolicy | null;
  return {
    ...base,
    ...(runPolicy ?? {}),
    ...(args.policyOverride ?? {}),
  };
}

// ── detectStalledRuns ─────────────────────────────────────────────────────

/**
 * Find runs that have not made any useful forward progress within the stall
 * timeout window. The query is intentionally tight:
 *
 *   status = 'active'
 *   AND last_useful_action_at IS NOT NULL
 *   AND last_useful_action_at <= now() - timeout
 *
 * NULL `last_useful_action_at` rows are skipped — those are runs that just
 * launched and haven't had a chance to write anything yet. A separate
 * `bootstrap_timeout_seconds` knob can be added later if needed; for the
 * initial cut we lean on `started_at` clients fall back to.
 *
 * Caller responsibility: set the RLS context (companyId) before calling.
 * The function passes `companyId` explicitly so it works in the watchdog
 * path where the runner shards across all tenants.
 */
export async function detectStalledRuns(
  db: Db,
  companyId: string,
  opts: DetectStalledRunsOptions = {},
): Promise<DetectStalledRunsResult> {
  const now = opts.now ?? new Date();
  const timeoutSeconds = opts.stallTimeoutSeconds ?? DEFAULT_RECOVERY_POLICY.stallTimeoutSeconds;
  const cutoff = new Date(now.getTime() - timeoutSeconds * 1000);
  const limit = opts.limit ?? 50;

  const stalled = await db
    .select()
    .from(governedWorkflowRuns)
    .where(
      and(
        eq(governedWorkflowRuns.companyId, companyId),
        eq(governedWorkflowRuns.status, "active"),
        isNotNull(governedWorkflowRuns.lastUsefulActionAt),
        lte(governedWorkflowRuns.lastUsefulActionAt, cutoff),
      ),
    )
    .limit(limit);

  return { stalled, scannedAt: now };
}

// ── recoverRun ────────────────────────────────────────────────────────────

/**
 * Trigger an auto-recovery wake on a stalled run.
 *
 * The actual replay-of-the-resumable-token is the agent runtime's
 * responsibility — this function only:
 *   1. Verifies the run is still active and within retry budget.
 *   2. Bumps `recovery_attempts` + `last_recovered_at` atomically (the
 *      `recovery_attempts < retries` predicate prevents two concurrent
 *      watchdog instances from both blowing past the cap).
 *   3. Emits `governed_run.auto_recovered` so the runtime + UI react.
 *
 * Returns `{ recovered: false, reason: ... }` when the run is missing,
 * already past status='active', the policy is disabled, or retries exhausted.
 */
export async function recoverRun(
  db: Db,
  args: { runId: string; companyId: string },
  options: RecoverRunOptions,
): Promise<RecoverRunResult> {
  const now = options.now ?? new Date();

  // 1. Load the row with FOR UPDATE so concurrent watchdog instances don't
  //    race the attempt counter. This is per-company (RLS context already
  //    set by the caller) so the lock scope is small.
  const [run] = await db
    .select()
    .from(governedWorkflowRuns)
    .where(
      and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ),
    )
    .for("update");

  if (!run) {
    return { runId: args.runId, recovered: false, reason: "run_not_found", recoveryAttempts: 0 };
  }

  if (run.status !== "active") {
    return { runId: args.runId, recovered: false, reason: "run_not_active", recoveryAttempts: run.recoveryAttempts };
  }

  const policy = resolveRecoveryPolicy({
    run,
    policyOverride: options.policyOverride,
  });

  // Advisory mode short-circuit — unless the operator forced a manual recovery.
  if (!policy.enabled && !options.forceManual) {
    return {
      runId: args.runId,
      recovered: false,
      reason: "policy_disabled",
      recoveryAttempts: run.recoveryAttempts,
    };
  }

  if (run.recoveryAttempts >= policy.retries) {
    return {
      runId: args.runId,
      recovered: false,
      reason: "max_retries_exceeded",
      recoveryAttempts: run.recoveryAttempts,
    };
  }

  // 2. Bump the counter atomically.
  const newAttempts = run.recoveryAttempts + 1;
  await db
    .update(governedWorkflowRuns)
    .set({
      recoveryAttempts: newAttempts,
      lastRecoveredAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ),
    );

  // 3. Emit the live event — the runtime / CAO will pick it up and replay.
  options.publishLiveEvent({
    companyId: args.companyId,
    type: "governed_run.auto_recovered",
    payload: {
      runId: args.runId,
      attempt: newAttempts,
      maxRetries: policy.retries,
      recoveredAt: now.toISOString(),
      manual: options.forceManual === true,
      // Surface the resumable token + hint so the runtime doesn't have to
      // re-query the DB. Both can be null when the runtime hadn't recorded
      // anything yet — consumer must handle gracefully.
      resumableToken: run.resumableToken ?? null,
      nextActionHint: run.nextActionHint ?? null,
    },
  });

  return {
    runId: args.runId,
    recovered: true,
    recoveryAttempts: newAttempts,
    recoveredAt: now,
  };
}

// ── emitStalled ───────────────────────────────────────────────────────────

/**
 * Emit a `governed_run.stalled` event without touching the run row. The
 * watchdog calls this for each stalled run as a one-shot heads-up, separate
 * from the `recoverRun` mutation. Operators can subscribe to this in the
 * UI even when auto-recovery is off.
 */
export function emitRunStalled(args: {
  publishLiveEvent: LivenessPublishFn;
  companyId: string;
  runId: string;
  lastUsefulActionAt: Date | null;
  nextActionHint: string | null;
  recoveryAttempts: number;
  detectedAt: Date;
}): void {
  args.publishLiveEvent({
    companyId: args.companyId,
    type: "governed_run.stalled",
    payload: {
      runId: args.runId,
      lastUsefulActionAt: args.lastUsefulActionAt?.toISOString() ?? null,
      nextActionHint: args.nextActionHint,
      recoveryAttempts: args.recoveryAttempts,
      detectedAt: args.detectedAt.toISOString(),
    },
  });
}

// ── recordUsefulAction ────────────────────────────────────────────────────

/**
 * Helper for adapter / runtime code to bump `last_useful_action_at` after
 * any forward-progress event. Optionally writes the resumable token + hint
 * in the same statement so the runtime doesn't have to issue two updates.
 *
 * Idempotent and tenant-scoped. Returns true when the row was updated, false
 * when the run is missing (avoids 500s on race conditions where the runtime
 * tries to record progress on a just-cancelled run).
 */
export async function recordUsefulAction(
  db: Db,
  args: {
    runId: string;
    companyId: string;
    resumableToken?: Record<string, unknown> | null;
    nextActionHint?: string | null;
    now?: Date;
  },
): Promise<boolean> {
  const now = args.now ?? new Date();
  const updates: Record<string, unknown> = {
    lastUsefulActionAt: now,
    updatedAt: now,
  };
  if (args.resumableToken !== undefined) updates.resumableToken = args.resumableToken;
  if (args.nextActionHint !== undefined) updates.nextActionHint = args.nextActionHint;

  const result = await db
    .update(governedWorkflowRuns)
    .set(updates)
    .where(
      and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ),
    )
    .returning({ id: governedWorkflowRuns.id });

  return result.length > 0;
}

// ── getRunLiveness ────────────────────────────────────────────────────────

/**
 * Lightweight read for the GET /liveness endpoint. Returns the liveness
 * snapshot for a run, or null when missing. Kept as a dedicated helper so
 * the route doesn't have to project the full row.
 */
export interface RunLivenessSnapshot {
  runId: string;
  status: GovernedRunRow["status"];
  startedAt: Date | null;
  lastUsefulActionAt: Date | null;
  nextActionHint: string | null;
  recoveryAttempts: number;
  lastRecoveredAt: Date | null;
  resumableTokenPresent: boolean;
  /** Effective policy for this run (resolved at read time). */
  effectivePolicy: GovernedRunRecoveryPolicy;
  /** True if the run looks stalled at read time (computed from policy). */
  isStalled: boolean;
}

export async function getRunLiveness(
  db: Db,
  args: { runId: string; companyId: string; now?: Date },
): Promise<RunLivenessSnapshot | null> {
  const [run] = await db
    .select()
    .from(governedWorkflowRuns)
    .where(
      and(
        eq(governedWorkflowRuns.id, args.runId),
        eq(governedWorkflowRuns.companyId, args.companyId),
      ),
    );

  if (!run) return null;

  const now = args.now ?? new Date();
  const policy = resolveRecoveryPolicy({ run });
  const isStalled =
    run.status === "active"
    && run.lastUsefulActionAt !== null
    && now.getTime() - run.lastUsefulActionAt.getTime() >= policy.stallTimeoutSeconds * 1000;

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.startedAt,
    lastUsefulActionAt: run.lastUsefulActionAt,
    nextActionHint: run.nextActionHint,
    recoveryAttempts: run.recoveryAttempts,
    lastRecoveredAt: run.lastRecoveredAt,
    resumableTokenPresent: run.resumableToken !== null && run.resumableToken !== undefined,
    effectivePolicy: policy,
    isStalled,
  };
}

// ── Watchdog runner ───────────────────────────────────────────────────────

export interface LivenessWatchdogOptions {
  /** Drizzle handle (multi-tenant — the runner sets RLS per-company). */
  db: Db;
  /** Live-event publisher. */
  publishLiveEvent: LivenessPublishFn;
  /**
   * Function to set the per-tenant RLS context. The watchdog runs across
   * companies, so we hand off RLS responsibility to the caller — same
   * shape as `setTenantContext` from `middleware/tenant-context.ts` to keep
   * the dependency injection trivial.
   */
  setTenantContext: (db: Db, companyId: string) => Promise<void>;
  /** Optional supplier for the company list to scan. Defaults to "every company that has at least one active run". */
  listCompaniesWithActiveRuns?: (db: Db) => Promise<string[]>;
  /** Tick interval in ms. Default 30_000 (30s — half the default 60s stall threshold). */
  intervalMs?: number;
  /**
   * If false (default), the watchdog only emits `governed_run.stalled` events
   * — no DB mutation. Set true (or LIVENESS_AUTO_RECOVERY=true env) to also
   * fire `recoverRun` on each stalled row.
   */
  autoRecover?: boolean;
}

/** Default company-list supplier — reads every active company id with ≥1 active run. */
async function defaultListCompaniesWithActiveRuns(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ companyId: governedWorkflowRuns.companyId })
    .from(governedWorkflowRuns)
    .where(eq(governedWorkflowRuns.status, "active"));
  return rows.map((r) => r.companyId);
}

/**
 * Single watchdog tick — useful in tests to drive the loop deterministically.
 * Returns the count of stalled runs detected and the count of recoveries
 * triggered.
 *
 * Failures inside the per-company loop are caught + logged so a single
 * tenant's broken row can't take down the whole watchdog.
 */
export async function runWatchdogTick(
  opts: LivenessWatchdogOptions,
  logger: { warn: (msg: string, meta?: Record<string, unknown>) => void } = console,
): Promise<{ stalledCount: number; recoveredCount: number }> {
  const lister = opts.listCompaniesWithActiveRuns ?? defaultListCompaniesWithActiveRuns;
  const autoRecover = opts.autoRecover ?? process.env.LIVENESS_AUTO_RECOVERY === "true";

  let stalledCount = 0;
  let recoveredCount = 0;

  const companyIds = await lister(opts.db);
  for (const companyId of companyIds) {
    try {
      await opts.setTenantContext(opts.db, companyId);
      const { stalled, scannedAt } = await detectStalledRuns(opts.db, companyId);
      stalledCount += stalled.length;

      for (const run of stalled) {
        // Always emit the heads-up event so operators see the stall even when
        // recovery is off.
        emitRunStalled({
          publishLiveEvent: opts.publishLiveEvent,
          companyId,
          runId: run.id,
          lastUsefulActionAt: run.lastUsefulActionAt,
          nextActionHint: run.nextActionHint,
          recoveryAttempts: run.recoveryAttempts,
          detectedAt: scannedAt,
        });

        if (autoRecover) {
          const result = await recoverRun(
            opts.db,
            { runId: run.id, companyId },
            { publishLiveEvent: opts.publishLiveEvent, now: scannedAt },
          );
          if (result.recovered) recoveredCount += 1;
        }
      }
    } catch (err) {
      logger.warn("liveness watchdog tick failed for company", {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { stalledCount, recoveredCount };
}

/**
 * Long-running watchdog loop. Returns a stop function. The caller (server
 * bootstrap) is responsible for invoking the stop on shutdown.
 *
 * Use this **only** when the server process owns the lease (single-instance
 * dev / desktop). In multi-instance deployments, run the watchdog as a
 * single-leader sidecar — the DB-side advisory lock is left as a TODO.
 */
export function startLivenessWatchdog(opts: LivenessWatchdogOptions): () => void {
  const intervalMs = opts.intervalMs ?? 30_000;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await runWatchdogTick(opts);
    } catch (err) {
      // Last-resort guard — runWatchdogTick already swallows per-company
      // errors. Anything reaching here is a programming bug.
      // eslint-disable-next-line no-console
      console.error("liveness watchdog top-level failure", err);
    } finally {
      if (!stopped) {
        timer = setTimeout(tick, intervalMs);
      }
    }
  };

  // Kick off after a short jitter so the first tick doesn't pile on with
  // server boot.
  timer = setTimeout(tick, Math.min(intervalMs, 5_000));

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
