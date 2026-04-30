/**
 * Tests for governed-workflows-liveness service (Phase 4 / migration 0077).
 *
 * Three layers:
 *   1. Pure-functional tests for resolveRecoveryPolicy + emitRunStalled
 *      (no DB, no env, run anywhere).
 *   2. DB-integration tests for detectStalledRuns + recoverRun + recordUsefulAction.
 *      Use setupTestDb (embedded postgres on port 5433); skipped on Windows
 *      CI where the embedded DB is unavailable.
 *   3. Watchdog runner tick test using stubbed listCompaniesWithActiveRuns
 *      and a captured publishLiveEvent — exercises the per-tenant fan-out.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import {
  DEFAULT_RECOVERY_POLICY,
  detectStalledRuns,
  emitRunStalled,
  getRunLiveness,
  recordUsefulAction,
  recoverRun,
  resolveRecoveryPolicy,
  runWatchdogTick,
  type LivenessPublishFn,
} from "../governed-workflows-liveness.js";
import { governedWorkflowRuns, governedWorkflowDefinitions, type Db, type GovernedRunRecoveryPolicy } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { setTenantContext } from "../../middleware/tenant-context.js";

// ── Layer 1: pure-functional tests (no DB) ────────────────────────────────

describe("resolveRecoveryPolicy", () => {
  it("returns the disabled default when run + override + env are unset", () => {
    const policy = resolveRecoveryPolicy({ run: { recoveryPolicyJson: null }, envEnabled: false });
    expect(policy.enabled).toBe(false);
    expect(policy.retries).toBe(DEFAULT_RECOVERY_POLICY.retries);
    expect(policy.stallTimeoutSeconds).toBe(DEFAULT_RECOVERY_POLICY.stallTimeoutSeconds);
  });

  it("flips enabled to true when LIVENESS_AUTO_RECOVERY env is set", () => {
    const policy = resolveRecoveryPolicy({ run: { recoveryPolicyJson: null }, envEnabled: true });
    expect(policy.enabled).toBe(true);
  });

  it("merges per-run policy on top of the env baseline", () => {
    const runPolicy: GovernedRunRecoveryPolicy = {
      enabled: true,
      retries: 5,
      backoffMs: 2000,
      stallTimeoutSeconds: 120,
    };
    const policy = resolveRecoveryPolicy({
      run: { recoveryPolicyJson: runPolicy },
      envEnabled: false,
    });
    expect(policy.enabled).toBe(true);
    expect(policy.retries).toBe(5);
    expect(policy.stallTimeoutSeconds).toBe(120);
  });

  it("override wins over per-run policy", () => {
    const runPolicy: GovernedRunRecoveryPolicy = {
      enabled: true,
      retries: 5,
      backoffMs: 2000,
      stallTimeoutSeconds: 120,
    };
    const policy = resolveRecoveryPolicy({
      run: { recoveryPolicyJson: runPolicy },
      policyOverride: { retries: 1, enabled: false },
      envEnabled: true,
    });
    expect(policy.retries).toBe(1);
    expect(policy.enabled).toBe(false);
    // Non-overridden fields fall back through the chain
    expect(policy.stallTimeoutSeconds).toBe(120);
  });
});

describe("emitRunStalled", () => {
  it("publishes a governed_run.stalled event with the expected payload shape", () => {
    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const publish: LivenessPublishFn = (e) => { captured.push(e); };
    const detected = new Date("2026-04-30T01:00:00Z");
    const lastUseful = new Date("2026-04-30T00:58:00Z");

    emitRunStalled({
      publishLiveEvent: publish,
      companyId: "co-1",
      runId: "run-abc",
      lastUsefulActionAt: lastUseful,
      nextActionHint: "waiting on review",
      recoveryAttempts: 0,
      detectedAt: detected,
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.type).toBe("governed_run.stalled");
    expect(captured[0]?.companyId).toBe("co-1");
    expect(captured[0]?.payload).toEqual({
      runId: "run-abc",
      lastUsefulActionAt: lastUseful.toISOString(),
      nextActionHint: "waiting on review",
      recoveryAttempts: 0,
      detectedAt: detected.toISOString(),
    });
  });

  it("serialises a null lastUsefulActionAt as null", () => {
    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    emitRunStalled({
      publishLiveEvent: (e) => { captured.push(e); },
      companyId: "co-1",
      runId: "run-no-action",
      lastUsefulActionAt: null,
      nextActionHint: null,
      recoveryAttempts: 2,
      detectedAt: new Date("2026-04-30T01:00:00Z"),
    });
    expect(captured[0]?.payload?.lastUsefulActionAt).toBeNull();
    expect(captured[0]?.payload?.nextActionHint).toBeNull();
  });
});

// ── Layer 2 + 3: DB-integration + watchdog tests ───────────────────────────
// These require the embedded test DB. Skipped automatically on Windows CI by
// setupTestDb when the DB is unreachable (pre-existing platform limitation).

describe("detectStalledRuns + recoverRun + recordUsefulAction", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-000000000d01";
  const otherCompanyId = "00000000-0000-0000-0000-000000000d02";
  let workflowDefId: string;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'LivenessCo', 'LIV')`);
    await db.execute(sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${otherCompanyId}, 'OtherCo', 'OTH')`);
    const [def] = await db
      .insert(governedWorkflowDefinitions)
      .values({
        companyId,
        name: "liveness-wf",
        description: "test",
        latestGitTag: "liveness-wf/v1.0.0",
        enabled: true,
      })
      .returning({ id: governedWorkflowDefinitions.id });
    workflowDefId = def!.id;
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(async () => {
    await setTenantContext(db, companyId);
    await db.execute(sql`DELETE FROM governed_workflow_runs WHERE company_id = ${companyId} OR company_id = ${otherCompanyId}`);
  });

  async function insertRun(overrides: Partial<typeof governedWorkflowRuns.$inferInsert> = {}) {
    const [row] = await db
      .insert(governedWorkflowRuns)
      .values({
        companyId,
        workflowDefId,
        workflowGitTag: "liveness-wf/v1.0.0",
        workflowGitSha: "deadbeef".repeat(5),
        initiatedByActorType: "user",
        initiatedByActorId: "00000000-0000-0000-0000-000000000aaa",
        status: "active",
        startedAt: new Date(),
        ...overrides,
      })
      .returning();
    return row!;
  }

  it("detects runs whose last_useful_action_at is older than the timeout", async () => {
    const old = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    const fresh = new Date(Date.now() - 5 * 1000); // 5s ago
    const stalledRun = await insertRun({ lastUsefulActionAt: old });
    await insertRun({ lastUsefulActionAt: fresh });
    await insertRun({ lastUsefulActionAt: null }); // skipped by NULL filter

    const { stalled } = await detectStalledRuns(db, companyId, { stallTimeoutSeconds: 60 });
    expect(stalled.map((r) => r.id)).toEqual([stalledRun.id]);
  });

  it("does not return runs from a different company (tenant isolation)", async () => {
    const old = new Date(Date.now() - 5 * 60 * 1000);
    await insertRun({ lastUsefulActionAt: old, companyId: otherCompanyId });
    await insertRun({ lastUsefulActionAt: old }); // current company

    const { stalled } = await detectStalledRuns(db, companyId, { stallTimeoutSeconds: 60 });
    expect(stalled).toHaveLength(1);
    expect(stalled[0]?.companyId).toBe(companyId);
  });

  it("does not return non-active runs (completed/failed/cancelled/draft)", async () => {
    const old = new Date(Date.now() - 5 * 60 * 1000);
    await insertRun({ lastUsefulActionAt: old, status: "completed" });
    await insertRun({ lastUsefulActionAt: old, status: "failed" });
    await insertRun({ lastUsefulActionAt: old, status: "draft" });

    const { stalled } = await detectStalledRuns(db, companyId, { stallTimeoutSeconds: 60 });
    expect(stalled).toHaveLength(0);
  });

  it("recordUsefulAction bumps last_useful_action_at + writes the token", async () => {
    const run = await insertRun({ lastUsefulActionAt: null });
    const ok = await recordUsefulAction(db, {
      runId: run.id,
      companyId,
      resumableToken: { phase: "step-2", checkpoint: "after-tool" },
      nextActionHint: "retrying tool call",
    });
    expect(ok).toBe(true);
    const [updated] = await db.select().from(governedWorkflowRuns).where(sql`id = ${run.id}`);
    expect(updated?.lastUsefulActionAt).not.toBeNull();
    expect(updated?.resumableToken).toEqual({ phase: "step-2", checkpoint: "after-tool" });
    expect(updated?.nextActionHint).toBe("retrying tool call");
  });

  it("recordUsefulAction returns false when the run does not exist", async () => {
    const ok = await recordUsefulAction(db, {
      runId: "00000000-0000-0000-0000-000000000000",
      companyId,
    });
    expect(ok).toBe(false);
  });

  it("recoverRun emits auto_recovered when policy is enabled + bumps the counter", async () => {
    const run = await insertRun({
      lastUsefulActionAt: new Date(Date.now() - 5 * 60 * 1000),
      recoveryPolicyJson: { ...DEFAULT_RECOVERY_POLICY, enabled: true } as GovernedRunRecoveryPolicy,
      resumableToken: { phase: "step-1" },
      nextActionHint: "stuck on tool",
    });

    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const result = await recoverRun(
      db,
      { runId: run.id, companyId },
      { publishLiveEvent: (e) => { captured.push(e); } },
    );

    expect(result.recovered).toBe(true);
    expect(result.recoveryAttempts).toBe(1);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.type).toBe("governed_run.auto_recovered");
    expect(captured[0]?.payload?.runId).toBe(run.id);
    expect(captured[0]?.payload?.attempt).toBe(1);
    expect(captured[0]?.payload?.resumableToken).toEqual({ phase: "step-1" });

    const [after] = await db.select().from(governedWorkflowRuns).where(sql`id = ${run.id}`);
    expect(after?.recoveryAttempts).toBe(1);
    expect(after?.lastRecoveredAt).not.toBeNull();
  });

  it("recoverRun is policy_disabled when neither env nor run policy nor override enables it", async () => {
    const run = await insertRun({});
    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const result = await recoverRun(
      db,
      { runId: run.id, companyId },
      { publishLiveEvent: (e) => { captured.push(e); } },
    );
    expect(result.recovered).toBe(false);
    expect(result.reason).toBe("policy_disabled");
    expect(captured).toHaveLength(0);
  });

  it("recoverRun supports forceManual to bypass advisory mode", async () => {
    const run = await insertRun({});
    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const result = await recoverRun(
      db,
      { runId: run.id, companyId },
      { publishLiveEvent: (e) => { captured.push(e); }, forceManual: true },
    );
    expect(result.recovered).toBe(true);
    expect(result.recoveryAttempts).toBe(1);
    expect(captured[0]?.payload?.manual).toBe(true);
  });

  it("recoverRun returns max_retries_exceeded once the counter hits the cap", async () => {
    const run = await insertRun({
      recoveryAttempts: 3,
      recoveryPolicyJson: { ...DEFAULT_RECOVERY_POLICY, enabled: true, retries: 3 } as GovernedRunRecoveryPolicy,
    });
    const result = await recoverRun(
      db,
      { runId: run.id, companyId },
      { publishLiveEvent: () => {} },
    );
    expect(result.recovered).toBe(false);
    expect(result.reason).toBe("max_retries_exceeded");
  });

  it("recoverRun returns run_not_active for a completed run", async () => {
    const run = await insertRun({ status: "completed" });
    const result = await recoverRun(
      db,
      { runId: run.id, companyId },
      { publishLiveEvent: () => {}, forceManual: true },
    );
    expect(result.recovered).toBe(false);
    expect(result.reason).toBe("run_not_active");
  });

  it("getRunLiveness returns a stalled snapshot for an old active run", async () => {
    const lastUseful = new Date(Date.now() - 5 * 60 * 1000);
    const run = await insertRun({
      lastUsefulActionAt: lastUseful,
      nextActionHint: "tool stuck",
      resumableToken: { phase: "x" },
    });
    const snap = await getRunLiveness(db, { runId: run.id, companyId });
    expect(snap).not.toBeNull();
    expect(snap?.isStalled).toBe(true);
    expect(snap?.resumableTokenPresent).toBe(true);
    expect(snap?.nextActionHint).toBe("tool stuck");
    expect(snap?.recoveryAttempts).toBe(0);
  });

  it("getRunLiveness returns null for an unknown run id", async () => {
    const snap = await getRunLiveness(db, {
      runId: "00000000-0000-0000-0000-000000000000",
      companyId,
    });
    expect(snap).toBeNull();
  });

  it("runWatchdogTick fans out per-company and emits stalled events", async () => {
    const old = new Date(Date.now() - 5 * 60 * 1000);
    await insertRun({ lastUsefulActionAt: old });
    await insertRun({ lastUsefulActionAt: old });

    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const result = await runWatchdogTick({
      db,
      publishLiveEvent: (e) => { captured.push(e); },
      setTenantContext: async (innerDb, cid) => { await setTenantContext(innerDb, cid); },
      listCompaniesWithActiveRuns: async () => [companyId],
      autoRecover: false,
    });

    expect(result.stalledCount).toBe(2);
    expect(result.recoveredCount).toBe(0);
    expect(captured.filter((e) => e.type === "governed_run.stalled")).toHaveLength(2);
    expect(captured.filter((e) => e.type === "governed_run.auto_recovered")).toHaveLength(0);
  });

  it("runWatchdogTick triggers recoveries when autoRecover=true and policy allows", async () => {
    const old = new Date(Date.now() - 5 * 60 * 1000);
    await insertRun({
      lastUsefulActionAt: old,
      recoveryPolicyJson: { ...DEFAULT_RECOVERY_POLICY, enabled: true } as GovernedRunRecoveryPolicy,
    });

    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const result = await runWatchdogTick({
      db,
      publishLiveEvent: (e) => { captured.push(e); },
      setTenantContext: async (innerDb, cid) => { await setTenantContext(innerDb, cid); },
      listCompaniesWithActiveRuns: async () => [companyId],
      autoRecover: true,
    });

    expect(result.stalledCount).toBe(1);
    expect(result.recoveredCount).toBe(1);
    expect(captured.some((e) => e.type === "governed_run.stalled")).toBe(true);
    expect(captured.some((e) => e.type === "governed_run.auto_recovered")).toBe(true);
  });

  it("runWatchdogTick swallows per-company errors so one tenant cannot break others", async () => {
    const old = new Date(Date.now() - 5 * 60 * 1000);
    await insertRun({ lastUsefulActionAt: old });

    const warnings: string[] = [];
    const captured: Array<Parameters<LivenessPublishFn>[0]> = [];
    const result = await runWatchdogTick(
      {
        db,
        publishLiveEvent: (e) => { captured.push(e); },
        setTenantContext: async (innerDb, cid) => {
          if (cid === "broken-co") throw new Error("tenant context failure");
          await setTenantContext(innerDb, cid);
        },
        listCompaniesWithActiveRuns: async () => ["broken-co", companyId],
        autoRecover: false,
      },
      { warn: (msg) => { warnings.push(msg); } },
    );

    expect(warnings.length).toBeGreaterThan(0);
    // Healthy company still got its scan done
    expect(result.stalledCount).toBe(1);
  });
});
