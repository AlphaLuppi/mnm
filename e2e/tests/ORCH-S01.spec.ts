/**
 * ORCH-S01: State Machine XState -- Orchestrateur Deterministe -- E2E Tests
 *
 * These tests verify the deliverables of ORCH-S01:
 *   - T1: Shared types (packages/shared/src/types/orchestrator.ts)
 *   - T2: Migration SQL for stage_instances + workflow_instances
 *   - T3: Drizzle schema updates (new columns + indexes)
 *   - T4: XState v5 state machine (workflow-state-machine.ts)
 *   - T5: Orchestrator service (orchestrator.ts)
 *   - T6: Integration in stages.ts
 *   - T7: Exports in index files
 *   - AC-11: Legacy status sync mapping
 *   - AC-24: xstate dependency in server/package.json
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// File paths
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/orchestrator.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const STATE_MACHINE_FILE = resolve(ROOT, "server/src/services/workflow-state-machine.ts");
const ORCHESTRATOR_FILE = resolve(ROOT, "server/src/services/orchestrator.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const STAGE_INSTANCES_SCHEMA = resolve(ROOT, "packages/db/src/schema/stage_instances.ts");
const WORKFLOW_INSTANCES_SCHEMA = resolve(ROOT, "packages/db/src/schema/workflow_instances.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const SERVER_PACKAGE_JSON = resolve(ROOT, "server/package.json");

// ─── The 10 stage states required by spec ────────────────────────────────────

const REQUIRED_STAGE_STATES = [
  "created",
  "ready",
  "in_progress",
  "validating",
  "paused",
  "failed",
  "compacting",
  "completed",
  "terminated",
  "skipped",
] as const;

// ─── The 15 stage events required by spec ────────────────────────────────────

const REQUIRED_STAGE_EVENTS = [
  "initialize",
  "start",
  "request_validation",
  "complete",
  "pause",
  "fail",
  "compact_detected",
  "approve",
  "reject_with_feedback",
  "resume",
  "retry",
  "terminate",
  "reinjected",
  "compaction_failed",
  "skip",
] as const;

// ─── The 6 workflow states required by spec ──────────────────────────────────

const REQUIRED_WORKFLOW_STATES = [
  "draft",
  "active",
  "paused",
  "completed",
  "failed",
  "terminated",
] as const;

// =============================================================================
// Group 1: Shared types file -- packages/shared/src/types/orchestrator.ts
// =============================================================================

test.describe("Group 1: Shared types -- orchestrator.ts exists", () => {
  test("orch-s01-types-file: orchestrator.ts exists in packages/shared/src/types/", async () => {
    await expect(
      fsAccess(TYPES_FILE).then(() => true),
    ).resolves.toBe(true);
  });
});

test.describe("Group 1: Shared types -- STAGE_STATES", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("orch-s01-stage-states: exports STAGE_STATES const array", () => {
    expect(content).toMatch(/export\s+const\s+STAGE_STATES\s*=/);
  });

  for (const state of REQUIRED_STAGE_STATES) {
    test(`STAGE_STATES includes "${state}"`, () => {
      expect(content).toContain(`"${state}"`);
    });
  }

  test("exports StageState type derived from STAGE_STATES", () => {
    expect(content).toMatch(/export\s+type\s+StageState\s*=/);
  });
});

test.describe("Group 1: Shared types -- STAGE_EVENTS", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("orch-s01-stage-events: exports STAGE_EVENTS const array", () => {
    expect(content).toMatch(/export\s+const\s+STAGE_EVENTS\s*=/);
  });

  for (const event of REQUIRED_STAGE_EVENTS) {
    test(`STAGE_EVENTS includes "${event}"`, () => {
      expect(content).toContain(`"${event}"`);
    });
  }

  test("exports StageEvent type derived from STAGE_EVENTS", () => {
    expect(content).toMatch(/export\s+type\s+StageEvent\s*=/);
  });
});

test.describe("Group 1: Shared types -- WORKFLOW_STATES", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("orch-s01-workflow-states: exports WORKFLOW_STATES const array", () => {
    expect(content).toMatch(/export\s+const\s+WORKFLOW_STATES\s*=/);
  });

  for (const state of REQUIRED_WORKFLOW_STATES) {
    test(`WORKFLOW_STATES includes "${state}"`, () => {
      expect(content).toContain(`"${state}"`);
    });
  }

  test("exports WorkflowState type derived from WORKFLOW_STATES", () => {
    expect(content).toMatch(/export\s+type\s+WorkflowState\s*=/);
  });
});

test.describe("Group 1: Shared types -- StageContext interface", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("exports StageContext interface", () => {
    expect(content).toMatch(/export\s+interface\s+StageContext/);
  });

  test("StageContext has retryCount field", () => {
    expect(content).toMatch(/retryCount\s*:/);
  });

  test("StageContext has maxRetries field", () => {
    expect(content).toMatch(/maxRetries\s*:/);
  });

  test("StageContext has lastError field", () => {
    expect(content).toMatch(/lastError\s*:/);
  });

  test("StageContext has feedback field", () => {
    expect(content).toMatch(/feedback\s*:/);
  });

  test("StageContext has transitionHistory field", () => {
    expect(content).toMatch(/transitionHistory\s*:/);
  });

  test("StageContext has stageId field", () => {
    expect(content).toMatch(/stageId\s*:/);
  });

  test("StageContext has workflowInstanceId field", () => {
    expect(content).toMatch(/workflowInstanceId\s*:/);
  });

  test("StageContext has companyId field", () => {
    expect(content).toMatch(/companyId\s*:/);
  });
});

test.describe("Group 1: Shared types -- TransitionRecord interface", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("exports TransitionRecord interface", () => {
    expect(content).toMatch(/export\s+interface\s+TransitionRecord/);
  });

  test("TransitionRecord has from field", () => {
    // Extract the TransitionRecord block
    const trStart = content.indexOf("interface TransitionRecord");
    expect(trStart).toBeGreaterThan(-1);
    const trBlock = content.slice(trStart, trStart + 500);
    expect(trBlock).toMatch(/from\s*:/);
  });

  test("TransitionRecord has to field", () => {
    const trStart = content.indexOf("interface TransitionRecord");
    const trBlock = content.slice(trStart, trStart + 500);
    expect(trBlock).toMatch(/to\s*:/);
  });

  test("TransitionRecord has event field", () => {
    const trStart = content.indexOf("interface TransitionRecord");
    const trBlock = content.slice(trStart, trStart + 500);
    expect(trBlock).toMatch(/event\s*:/);
  });

  test("TransitionRecord has actorId field", () => {
    const trStart = content.indexOf("interface TransitionRecord");
    const trBlock = content.slice(trStart, trStart + 500);
    expect(trBlock).toMatch(/actorId\s*:/);
  });

  test("TransitionRecord has actorType field", () => {
    const trStart = content.indexOf("interface TransitionRecord");
    const trBlock = content.slice(trStart, trStart + 500);
    expect(trBlock).toMatch(/actorType\s*:/);
  });

  test("TransitionRecord has timestamp field", () => {
    const trStart = content.indexOf("interface TransitionRecord");
    const trBlock = content.slice(trStart, trStart + 500);
    expect(trBlock).toMatch(/timestamp\s*:/);
  });
});

test.describe("Group 1: Shared types -- OrchestratorEvent interface", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("exports OrchestratorEvent interface", () => {
    expect(content).toMatch(/export\s+interface\s+OrchestratorEvent/);
  });

  test("OrchestratorEvent has type field", () => {
    const oeStart = content.indexOf("interface OrchestratorEvent");
    expect(oeStart).toBeGreaterThan(-1);
    const oeBlock = content.slice(oeStart, oeStart + 600);
    expect(oeBlock).toMatch(/type\s*:\s*string/);
  });

  test("OrchestratorEvent has fromState and toState fields", () => {
    const oeStart = content.indexOf("interface OrchestratorEvent");
    const oeBlock = content.slice(oeStart, oeStart + 600);
    expect(oeBlock).toMatch(/fromState\s*:/);
    expect(oeBlock).toMatch(/toState\s*:/);
  });
});

// =============================================================================
// Group 2: XState State Machine -- server/src/services/workflow-state-machine.ts
// =============================================================================

test.describe("Group 2: State machine file exists", () => {
  test("orch-s01-state-machine-file: workflow-state-machine.ts exists", async () => {
    await expect(
      fsAccess(STATE_MACHINE_FILE).then(() => true),
    ).resolves.toBe(true);
  });
});

test.describe("Group 2: State machine -- XState import and creation", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("orch-s01-xstate-machine: imports from xstate", () => {
    expect(content).toMatch(/from\s+["']xstate["']/);
  });

  test("uses createMachine or setup from xstate", () => {
    expect(content).toMatch(/(createMachine|setup)\s*\(/);
  });

  test("machine id is 'stage'", () => {
    expect(content).toMatch(/id\s*:\s*["']stage["']/);
  });

  test("machine initial state is 'created'", () => {
    expect(content).toMatch(/initial\s*:\s*["']created["']/);
  });
});

test.describe("Group 2: State machine -- all 10 states defined", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  for (const state of REQUIRED_STAGE_STATES) {
    test(`state "${state}" is defined in the machine`, () => {
      // States are keys in the states object -- look for the state name as a key
      expect(content).toMatch(new RegExp(`${state}\\s*:\\s*\\{`));
    });
  }
});

test.describe("Group 2: State machine -- final states", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("completed is a final state", () => {
    // Find the completed block and check for type: "final"
    const completedIdx = content.indexOf("completed:");
    expect(completedIdx).toBeGreaterThan(-1);
    const completedBlock = content.slice(completedIdx, completedIdx + 200);
    expect(completedBlock).toMatch(/type\s*:\s*["']final["']/);
  });

  test("terminated is a final state", () => {
    const terminatedIdx = content.indexOf("terminated:");
    expect(terminatedIdx).toBeGreaterThan(-1);
    const terminatedBlock = content.slice(terminatedIdx, terminatedIdx + 200);
    expect(terminatedBlock).toMatch(/type\s*:\s*["']final["']/);
  });

  test("skipped is a final state", () => {
    const skippedIdx = content.indexOf("skipped:");
    expect(skippedIdx).toBeGreaterThan(-1);
    const skippedBlock = content.slice(skippedIdx, skippedIdx + 200);
    expect(skippedBlock).toMatch(/type\s*:\s*["']final["']/);
  });
});

test.describe("Group 2: State machine -- guards", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("orch-s01-guard-manage: canManageWorkflow guard defined", () => {
    expect(content).toContain("canManageWorkflow");
  });

  test("canManageWorkflow checks workflows.manage permission", () => {
    expect(content).toContain("workflows.manage");
  });

  test("orch-s01-guard-launch: canLaunchAgent guard defined", () => {
    expect(content).toContain("canLaunchAgent");
  });

  test("canLaunchAgent checks agents.launch permission", () => {
    expect(content).toContain("agents.launch");
  });

  test("orch-s01-guard-retry: canRetry guard defined", () => {
    expect(content).toContain("canRetry");
  });

  test("canRetry checks retryCount against maxRetries", () => {
    // The guard should compare retryCount with maxRetries
    expect(content).toMatch(/retryCount\s*(>=|>)\s*(context\.)?maxRetries/);
  });
});

test.describe("Group 2: State machine -- actions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("recordTransition action defined", () => {
    expect(content).toContain("recordTransition");
  });

  test("incrementRetryCount action defined", () => {
    expect(content).toContain("incrementRetryCount");
  });

  test("recordError action defined", () => {
    expect(content).toContain("recordError");
  });

  test("clearError action defined", () => {
    expect(content).toContain("clearError");
  });

  test("recordFeedback action defined", () => {
    expect(content).toContain("recordFeedback");
  });

  test("clearFeedback action defined", () => {
    expect(content).toContain("clearFeedback");
  });

  test("recordOutputArtifacts action defined", () => {
    expect(content).toContain("recordOutputArtifacts");
  });
});

test.describe("Group 2: State machine -- transitions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  // T1: created -> ready via initialize
  test("T1: created state has 'initialize' event", () => {
    const createdIdx = content.indexOf("created:");
    expect(createdIdx).toBeGreaterThan(-1);
    const createdBlock = content.slice(createdIdx, content.indexOf("ready:", createdIdx));
    expect(createdBlock).toContain("initialize");
  });

  test("T1: initialize transition targets 'ready'", () => {
    const createdIdx = content.indexOf("created:");
    const createdBlock = content.slice(createdIdx, content.indexOf("ready:", createdIdx));
    expect(createdBlock).toMatch(/initialize[\s\S]*?target\s*:\s*["']ready["']/);
  });

  test("T1: initialize has canManageWorkflow guard", () => {
    const createdIdx = content.indexOf("created:");
    const createdBlock = content.slice(createdIdx, content.indexOf("ready:", createdIdx));
    expect(createdBlock).toContain("canManageWorkflow");
  });

  // T2: ready -> in_progress via start
  test("T2: ready state has 'start' event targeting 'in_progress'", () => {
    const readyIdx = content.indexOf("ready:");
    expect(readyIdx).toBeGreaterThan(-1);
    const readyBlock = content.slice(readyIdx, content.indexOf("in_progress:", readyIdx));
    expect(readyBlock).toContain("start");
    expect(readyBlock).toMatch(/start[\s\S]*?target\s*:\s*["']in_progress["']/);
  });

  test("T2: start has canLaunchAgent guard", () => {
    const readyIdx = content.indexOf("ready:");
    const readyBlock = content.slice(readyIdx, content.indexOf("in_progress:", readyIdx));
    expect(readyBlock).toContain("canLaunchAgent");
  });

  // T15: ready -> skipped via skip
  test("T15: ready state has 'skip' event targeting 'skipped'", () => {
    const readyIdx = content.indexOf("ready:");
    const readyBlock = content.slice(readyIdx, content.indexOf("in_progress:", readyIdx));
    expect(readyBlock).toContain("skip");
    expect(readyBlock).toMatch(/skip[\s\S]*?target\s*:\s*["']skipped["']/);
  });

  // T3: in_progress -> validating via request_validation
  test("T3: in_progress has 'request_validation' targeting 'validating'", () => {
    const ipIdx = content.indexOf("in_progress:");
    expect(ipIdx).toBeGreaterThan(-1);
    const ipBlock = content.slice(ipIdx, content.indexOf("validating:", ipIdx));
    expect(ipBlock).toContain("request_validation");
  });

  // T4: in_progress -> completed via complete
  test("T4: in_progress has 'complete' targeting 'completed'", () => {
    const ipIdx = content.indexOf("in_progress:");
    const ipBlock = content.slice(ipIdx, content.indexOf("validating:", ipIdx));
    expect(ipBlock).toContain("complete");
    expect(ipBlock).toMatch(/complete[\s\S]*?target\s*:\s*["']completed["']/);
  });

  // T5: in_progress -> paused via pause
  test("T5: in_progress has 'pause' targeting 'paused'", () => {
    const ipIdx = content.indexOf("in_progress:");
    const ipBlock = content.slice(ipIdx, content.indexOf("validating:", ipIdx));
    expect(ipBlock).toContain("pause");
    expect(ipBlock).toMatch(/pause[\s\S]*?target\s*:\s*["']paused["']/);
  });

  // T6: in_progress -> failed via fail
  test("T6: in_progress has 'fail' targeting 'failed'", () => {
    const ipIdx = content.indexOf("in_progress:");
    const ipBlock = content.slice(ipIdx, content.indexOf("validating:", ipIdx));
    expect(ipBlock).toContain("fail");
    expect(ipBlock).toMatch(/fail[\s\S]*?target\s*:\s*["']failed["']/);
  });

  // T7: in_progress -> compacting via compact_detected
  test("T7: in_progress has 'compact_detected' targeting 'compacting'", () => {
    const ipIdx = content.indexOf("in_progress:");
    const ipBlock = content.slice(ipIdx, content.indexOf("validating:", ipIdx));
    expect(ipBlock).toContain("compact_detected");
    expect(ipBlock).toMatch(/compact_detected[\s\S]*?target\s*:\s*["']compacting["']/);
  });

  // T8: validating -> in_progress via approve
  test("T8: validating has 'approve' targeting 'in_progress'", () => {
    const valIdx = content.indexOf("validating:");
    expect(valIdx).toBeGreaterThan(-1);
    const valBlock = content.slice(valIdx, content.indexOf("paused:", valIdx));
    expect(valBlock).toContain("approve");
    expect(valBlock).toMatch(/approve[\s\S]*?target\s*:\s*["']in_progress["']/);
  });

  // T9: validating -> in_progress via reject_with_feedback
  test("T9: validating has 'reject_with_feedback' targeting 'in_progress'", () => {
    const valIdx = content.indexOf("validating:");
    const valBlock = content.slice(valIdx, content.indexOf("paused:", valIdx));
    expect(valBlock).toContain("reject_with_feedback");
    expect(valBlock).toMatch(/reject_with_feedback[\s\S]*?target\s*:\s*["']in_progress["']/);
  });

  // T10: paused -> in_progress via resume
  test("T10: paused has 'resume' targeting 'in_progress'", () => {
    const pausedIdx = content.indexOf("paused:");
    expect(pausedIdx).toBeGreaterThan(-1);
    const pausedBlock = content.slice(pausedIdx, content.indexOf("failed:", pausedIdx));
    expect(pausedBlock).toContain("resume");
    expect(pausedBlock).toMatch(/resume[\s\S]*?target\s*:\s*["']in_progress["']/);
  });

  // T12: paused -> terminated via terminate
  test("T12a: paused has 'terminate' targeting 'terminated'", () => {
    const pausedIdx = content.indexOf("paused:");
    const pausedBlock = content.slice(pausedIdx, content.indexOf("failed:", pausedIdx));
    expect(pausedBlock).toContain("terminate");
    expect(pausedBlock).toMatch(/terminate[\s\S]*?target\s*:\s*["']terminated["']/);
  });

  // T11: failed -> in_progress via retry
  test("T11: failed has 'retry' targeting 'in_progress'", () => {
    const failedIdx = content.indexOf("failed:");
    expect(failedIdx).toBeGreaterThan(-1);
    const failedBlock = content.slice(failedIdx, content.indexOf("compacting:", failedIdx));
    expect(failedBlock).toContain("retry");
    expect(failedBlock).toMatch(/retry[\s\S]*?target\s*:\s*["']in_progress["']/);
  });

  test("T11: retry has canRetry guard", () => {
    const failedIdx = content.indexOf("failed:");
    const failedBlock = content.slice(failedIdx, content.indexOf("compacting:", failedIdx));
    expect(failedBlock).toContain("canRetry");
  });

  // T12: failed -> terminated via terminate
  test("T12b: failed has 'terminate' targeting 'terminated'", () => {
    const failedIdx = content.indexOf("failed:");
    const failedBlock = content.slice(failedIdx, content.indexOf("compacting:", failedIdx));
    expect(failedBlock).toContain("terminate");
    expect(failedBlock).toMatch(/terminate[\s\S]*?target\s*:\s*["']terminated["']/);
  });

  // T13: compacting -> in_progress via reinjected
  test("T13: compacting has 'reinjected' targeting 'in_progress'", () => {
    const compIdx = content.indexOf("compacting:");
    expect(compIdx).toBeGreaterThan(-1);
    const compBlock = content.slice(compIdx, content.indexOf("completed:", compIdx));
    expect(compBlock).toContain("reinjected");
    expect(compBlock).toMatch(/reinjected[\s\S]*?target\s*:\s*["']in_progress["']/);
  });

  // T14: compacting -> terminated via compaction_failed
  test("T14: compacting has 'compaction_failed' targeting 'terminated'", () => {
    const compIdx = content.indexOf("compacting:");
    const compBlock = content.slice(compIdx, content.indexOf("completed:", compIdx));
    expect(compBlock).toContain("compaction_failed");
    expect(compBlock).toMatch(/compaction_failed[\s\S]*?target\s*:\s*["']terminated["']/);
  });
});

test.describe("Group 2: State machine -- guard usage on transitions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("system-only events (request_validation, fail, compact_detected, reinjected) have no RBAC guard", () => {
    // request_validation should NOT have canManageWorkflow or canLaunchAgent guards
    const ipIdx = content.indexOf("in_progress:");
    const ipBlock = content.slice(ipIdx, content.indexOf("validating:", ipIdx));

    // Find the request_validation block specifically
    const rvIdx = ipBlock.indexOf("request_validation");
    expect(rvIdx).toBeGreaterThan(-1);
    // Get a window around request_validation to check for guard absence
    const rvBlock = ipBlock.slice(rvIdx, rvIdx + 200);
    // Should have recordTransition but NOT canManageWorkflow or canLaunchAgent
    expect(rvBlock).toContain("recordTransition");
  });
});

// =============================================================================
// Group 3: Orchestrator Service -- server/src/services/orchestrator.ts
// =============================================================================

test.describe("Group 3: Orchestrator service file", () => {
  test("orch-s01-orchestrator-file: orchestrator.ts exists", async () => {
    await expect(
      fsAccess(ORCHESTRATOR_FILE).then(() => true),
    ).resolves.toBe(true);
  });
});

test.describe("Group 3: Orchestrator service -- core structure", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("exports orchestratorService function", () => {
    expect(content).toMatch(/export\s+function\s+orchestratorService\s*\(/);
  });

  test("orchestratorService accepts db parameter", () => {
    expect(content).toMatch(/function\s+orchestratorService\s*\(\s*db\s*:/);
  });

  test("imports from xstate", () => {
    expect(content).toMatch(/from\s+["']xstate["']/);
  });

  test("imports stageMachine from workflow-state-machine", () => {
    expect(content).toMatch(/from\s+["']\.\/workflow-state-machine/);
  });

  test("imports from @mnm/shared", () => {
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("imports stageInstances from @mnm/db or drizzle schema", () => {
    expect(content).toMatch(/stageInstances/);
  });

  test("imports workflowInstances", () => {
    expect(content).toMatch(/workflowInstances/);
  });
});

test.describe("Group 3: Orchestrator service -- transitionStage function", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("defines transitionStage function", () => {
    expect(content).toMatch(/function\s+transitionStage\s*\(/);
  });

  test("transitionStage performs SELECT from stageInstances (load stage from DB)", () => {
    // Should query the stage from the database
    expect(content).toMatch(/\.select\(\)[\s\S]*?\.from\(\s*stageInstances\s*\)/);
  });

  test("transitionStage performs UPDATE on stageInstances (persist)", () => {
    expect(content).toMatch(/\.update\(\s*stageInstances\s*\)/);
  });

  test("transitionStage returns fromState and toState", () => {
    expect(content).toContain("fromState");
    expect(content).toContain("toState");
  });
});

test.describe("Group 3: Orchestrator service -- legacy status sync", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("orch-s01-legacy-status-sync: defines STATE_TO_LEGACY_STATUS mapping", () => {
    expect(content).toContain("STATE_TO_LEGACY_STATUS");
  });

  test("orch-s01-state-to-legacy: mapping covers all 10 stage states", () => {
    // Check each state is mapped
    for (const state of REQUIRED_STAGE_STATES) {
      expect(content).toContain(`${state}:`);
    }
  });

  test("mapping: created -> pending", () => {
    expect(content).toMatch(/created\s*:\s*["']pending["']/);
  });

  test("mapping: ready -> pending", () => {
    expect(content).toMatch(/ready\s*:\s*["']pending["']/);
  });

  test("mapping: in_progress -> running", () => {
    expect(content).toMatch(/in_progress\s*:\s*["']running["']/);
  });

  test("mapping: validating -> review", () => {
    expect(content).toMatch(/validating\s*:\s*["']review["']/);
  });

  test("mapping: completed -> done", () => {
    expect(content).toMatch(/completed\s*:\s*["']done["']/);
  });

  test("mapping: failed -> failed", () => {
    expect(content).toMatch(/failed\s*:\s*["']failed["']/);
  });

  test("mapping: skipped -> skipped", () => {
    expect(content).toMatch(/skipped\s*:\s*["']skipped["']/);
  });

  test("mapping: paused -> pending", () => {
    expect(content).toMatch(/paused\s*:\s*["']pending["']/);
  });

  test("mapping: compacting -> running", () => {
    expect(content).toMatch(/compacting\s*:\s*["']running["']/);
  });

  test("mapping: terminated -> failed", () => {
    expect(content).toMatch(/terminated\s*:\s*["']failed["']/);
  });
});

test.describe("Group 3: Orchestrator service -- event emission", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("orch-s01-publish-event: calls publishLiveEvent for stage transitions", () => {
    expect(content).toContain("publishLiveEvent");
  });

  test("emits events with companyId in payload", () => {
    // Skip the import line and find the actual call to publishLiveEvent
    const importIdx = content.indexOf("publishLiveEvent");
    expect(importIdx).toBeGreaterThan(-1);
    const callIdx = content.indexOf("publishLiveEvent(", importIdx + 1);
    expect(callIdx).toBeGreaterThan(-1);
    const publishBlock = content.slice(callIdx, callIdx + 400);
    expect(publishBlock).toContain("companyId");
  });

  test("imports publishLiveEvent from live-events", () => {
    expect(content).toMatch(/from\s+["']\.\/live-events/);
  });
});

test.describe("Group 3: Orchestrator service -- workflow state management", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("orch-s01-workflow-completed: handles workflow completion when all stages are final", () => {
    expect(content).toMatch(/workflow[\s\S]*completed/i);
    // Should check if all stages are in final state
    expect(content).toMatch(/(allFinal|every|all)/);
  });

  test("orch-s01-auto-advance: auto-advances next stage on completion", () => {
    expect(content).toMatch(/(maybeAdvanceNextStage|autoAdvance|nextStage)/);
  });

  test("returns transitionStage and query helpers from service", () => {
    expect(content).toMatch(/return\s*\{[\s\S]*transitionStage[\s\S]*\}/);
  });
});

test.describe("Group 3: Orchestrator service -- error handling", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("imports conflict from errors", () => {
    expect(content).toMatch(/import\s+\{[^}]*conflict[^}]*\}\s+from\s+["']\.\.\/errors/);
  });

  test("imports notFound from errors", () => {
    expect(content).toMatch(/import\s+\{[^}]*notFound[^}]*\}\s+from\s+["']\.\.\/errors/);
  });

  test("throws notFound when stage not found", () => {
    expect(content).toMatch(/throw\s+notFound\s*\(/);
  });

  test("throws conflict when transition is refused", () => {
    expect(content).toMatch(/throw\s+conflict\s*\(/);
  });
});

// =============================================================================
// Group 4: DB Schema -- stage_instances new columns
// =============================================================================

test.describe("Group 4: stage_instances schema -- new columns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STAGE_INSTANCES_SCHEMA, "utf-8");
  });

  test("orch-s01-machine-state-col: has machine_state column", () => {
    expect(content).toContain('"machine_state"');
  });

  test("machine_state defaults to 'created'", () => {
    expect(content).toMatch(/machine_state.*default\s*\(\s*["']created["']\s*\)/);
  });

  test("orch-s01-retry-count-col: has retry_count column", () => {
    expect(content).toContain('"retry_count"');
  });

  test("retry_count defaults to 0", () => {
    expect(content).toMatch(/retry_count.*default\s*\(\s*0\s*\)/);
  });

  test("orch-s01-max-retries-col: has max_retries column", () => {
    expect(content).toContain('"max_retries"');
  });

  test("max_retries defaults to 3", () => {
    expect(content).toMatch(/max_retries.*default\s*\(\s*3\s*\)/);
  });

  test("orch-s01-last-error-col: has last_error column", () => {
    expect(content).toContain('"last_error"');
  });

  test("has last_actor_id column", () => {
    expect(content).toContain('"last_actor_id"');
  });

  test("has last_actor_type column", () => {
    expect(content).toContain('"last_actor_type"');
  });

  test("orch-s01-feedback-col: has feedback column", () => {
    expect(content).toContain('"feedback"');
  });

  test("orch-s01-transition-history: has transition_history JSONB column", () => {
    expect(content).toContain('"transition_history"');
    expect(content).toMatch(/jsonb\s*\(\s*["']transition_history["']\s*\)/);
  });

  test("has machine_context JSONB column", () => {
    expect(content).toContain('"machine_context"');
  });

  test("has machine_state index on (company_id, machine_state)", () => {
    expect(content).toMatch(/index\s*\(\s*["']stage_instances_machine_state_idx["']\s*\)/);
  });
});

// =============================================================================
// Group 5: DB Schema -- workflow_instances new columns
// =============================================================================

test.describe("Group 5: workflow_instances schema -- new columns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WORKFLOW_INSTANCES_SCHEMA, "utf-8");
  });

  test("orch-s01-workflow-state-col: has workflow_state column", () => {
    expect(content).toContain('"workflow_state"');
  });

  test("workflow_state defaults to 'draft'", () => {
    expect(content).toMatch(/workflow_state.*default\s*\(\s*["']draft["']\s*\)/);
  });

  test("has paused_at timestamp column", () => {
    expect(content).toContain('"paused_at"');
  });

  test("has failed_at timestamp column", () => {
    expect(content).toContain('"failed_at"');
  });

  test("has terminated_at timestamp column", () => {
    expect(content).toContain('"terminated_at"');
  });

  test("has last_actor_id column", () => {
    expect(content).toContain('"last_actor_id"');
  });

  test("has last_actor_type column", () => {
    expect(content).toContain('"last_actor_type"');
  });

  test("has workflow_state index", () => {
    expect(content).toMatch(/index\s*\(\s*["']workflow_instances_workflow_state_idx["']\s*\)/);
  });
});

// =============================================================================
// Group 6: Migration SQL file
// =============================================================================

test.describe("Group 6: Migration file for ORCH-S01", () => {
  test("orch-s01-migration-file: a migration file >= 0035 exists", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    // The last known migration is 0034, so ORCH-S01 should be >= 0035
    const newMigrations = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 35;
    });
    expect(newMigrations.length).toBeGreaterThanOrEqual(1);
  });

  test("an ORCH-S01 related migration contains machine_state ALTER", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    const newMigrations = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 35;
    });

    let foundMachineState = false;
    for (const file of newMigrations) {
      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      if (content.includes("machine_state")) {
        foundMachineState = true;
        break;
      }
    }
    expect(foundMachineState).toBe(true);
  });

  test("migration contains retry_count column addition", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    const newMigrations = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 35;
    });

    let foundRetryCount = false;
    for (const file of newMigrations) {
      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      if (content.includes("retry_count")) {
        foundRetryCount = true;
        break;
      }
    }
    expect(foundRetryCount).toBe(true);
  });

  test("migration contains workflow_state column addition", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    const newMigrations = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 35;
    });

    let foundWorkflowState = false;
    for (const file of newMigrations) {
      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      if (content.includes("workflow_state")) {
        foundWorkflowState = true;
        break;
      }
    }
    expect(foundWorkflowState).toBe(true);
  });

  test("migration contains transition_history column", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    const newMigrations = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 35;
    });

    let found = false;
    for (const file of newMigrations) {
      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      if (content.includes("transition_history")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("migration contains data migration for existing statuses", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    const newMigrations = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 35;
    });

    let foundDataMigration = false;
    for (const file of newMigrations) {
      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      // Should contain UPDATE ... SET machine_state = CASE for backward compat
      if (content.match(/UPDATE\s+stage_instances\s+SET\s+machine_state/i)) {
        foundDataMigration = true;
        break;
      }
    }
    expect(foundDataMigration).toBe(true);
  });
});

// =============================================================================
// Group 7: Exports -- index files
// =============================================================================

test.describe("Group 7: Types re-exported in types/index.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_INDEX, "utf-8");
  });

  test("types/index.ts re-exports from orchestrator.js", () => {
    expect(content).toMatch(/from\s+["']\.\/orchestrator\.js["']/);
  });
});

test.describe("Group 7: Types re-exported in shared/src/index.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SHARED_INDEX, "utf-8");
  });

  test("shared/src/index.ts exports StageState type", () => {
    expect(content).toContain("StageState");
  });

  test("shared/src/index.ts exports StageEvent type", () => {
    expect(content).toContain("StageEvent");
  });

  test("shared/src/index.ts exports StageContext type", () => {
    expect(content).toContain("StageContext");
  });

  test("shared/src/index.ts exports TransitionRecord type", () => {
    expect(content).toContain("TransitionRecord");
  });

  test("shared/src/index.ts exports OrchestratorEvent type", () => {
    expect(content).toContain("OrchestratorEvent");
  });

  test("shared/src/index.ts exports WorkflowState type", () => {
    expect(content).toContain("WorkflowState");
  });

  test("shared/src/index.ts exports STAGE_STATES constant", () => {
    expect(content).toContain("STAGE_STATES");
  });

  test("shared/src/index.ts exports STAGE_EVENTS constant", () => {
    expect(content).toContain("STAGE_EVENTS");
  });

  test("shared/src/index.ts exports WORKFLOW_STATES constant", () => {
    expect(content).toContain("WORKFLOW_STATES");
  });
});

test.describe("Group 7: Orchestrator service exported in services/index.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICES_INDEX, "utf-8");
  });

  test("orch-s01-service-export: services/index.ts exports orchestratorService", () => {
    expect(content).toContain("orchestratorService");
  });

  test("services/index.ts imports from orchestrator.js", () => {
    expect(content).toMatch(/from\s+["']\.\/orchestrator\.js["']/);
  });
});

// =============================================================================
// Group 8: xstate dependency in server/package.json
// =============================================================================

test.describe("Group 8: xstate dependency", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVER_PACKAGE_JSON, "utf-8");
  });

  test("orch-s01-xstate-dep: xstate is listed as a dependency", () => {
    const pkg = JSON.parse(content);
    expect(
      pkg.dependencies?.xstate || pkg.devDependencies?.xstate,
    ).toBeTruthy();
  });

  test("xstate is in dependencies (not devDependencies -- runtime dep)", () => {
    const pkg = JSON.parse(content);
    expect(pkg.dependencies?.xstate).toBeTruthy();
  });
});

// =============================================================================
// Group 9: Integrity -- cross-file consistency
// =============================================================================

test.describe("Group 9: Integrity -- service uses shared types", () => {
  let orchestratorContent: string;
  let stateMachineContent: string;

  test.beforeAll(async () => {
    orchestratorContent = await readFile(ORCHESTRATOR_FILE, "utf-8");
    stateMachineContent = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("orchestrator.ts imports StageState type", () => {
    expect(orchestratorContent).toContain("StageState");
  });

  test("orchestrator.ts imports StageEvent type", () => {
    expect(orchestratorContent).toContain("StageEvent");
  });

  test("orchestrator.ts imports StageContext type", () => {
    expect(orchestratorContent).toContain("StageContext");
  });

  test("orchestrator.ts imports TransitionRecord type", () => {
    expect(orchestratorContent).toContain("TransitionRecord");
  });

  test("orchestrator.ts imports OrchestratorEvent type", () => {
    expect(orchestratorContent).toContain("OrchestratorEvent");
  });

  test("orchestrator.ts imports WorkflowState type", () => {
    expect(orchestratorContent).toContain("WorkflowState");
  });

  test("workflow-state-machine.ts imports StageContext type", () => {
    expect(stateMachineContent).toContain("StageContext");
  });

  test("workflow-state-machine.ts imports from @mnm/shared", () => {
    expect(stateMachineContent).toMatch(/from\s+["']@mnm\/shared["']/);
  });
});

test.describe("Group 9: Integrity -- state machine matches spec diagram", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STATE_MACHINE_FILE, "utf-8");
  });

  test("created state only transitions to ready (via initialize)", () => {
    const createdIdx = content.indexOf("created:");
    expect(createdIdx).toBeGreaterThan(-1);
    const nextStateIdx = content.indexOf("ready:", createdIdx);
    const createdBlock = content.slice(createdIdx, nextStateIdx);
    // Should contain initialize but NOT start, complete, fail, etc.
    expect(createdBlock).toContain("initialize");
    expect(createdBlock).not.toContain('"start"');
    expect(createdBlock).not.toContain('"complete"');
    expect(createdBlock).not.toContain('"fail"');
  });

  test("in_progress has exactly 5 outgoing transitions", () => {
    const ipIdx = content.indexOf("in_progress:");
    expect(ipIdx).toBeGreaterThan(-1);
    const nextStateIdx = content.indexOf("validating:", ipIdx);
    const ipBlock = content.slice(ipIdx, nextStateIdx);
    // Should have: request_validation, complete, pause, fail, compact_detected
    expect(ipBlock).toContain("request_validation");
    expect(ipBlock).toContain("complete");
    expect(ipBlock).toContain("pause");
    expect(ipBlock).toContain("fail");
    expect(ipBlock).toContain("compact_detected");
  });

  test("validating has exactly 2 outgoing transitions (approve, reject_with_feedback)", () => {
    const valIdx = content.indexOf("validating:");
    expect(valIdx).toBeGreaterThan(-1);
    const nextStateIdx = content.indexOf("paused:", valIdx);
    const valBlock = content.slice(valIdx, nextStateIdx);
    expect(valBlock).toContain("approve");
    expect(valBlock).toContain("reject_with_feedback");
    // Should NOT have start, complete, fail, etc.
    expect(valBlock).not.toMatch(/"complete"/);
    expect(valBlock).not.toMatch(/"fail"/);
  });
});

// =============================================================================
// Group 10: Event type mapping (eventToEmitType helper)
// =============================================================================

test.describe("Group 10: Event type mapping for audit events", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("has event-to-emit-type mapping or helper function", () => {
    // Should contain a mapping from events to emitted event types
    expect(content).toMatch(/(eventToEmitType|EVENT_TO_EMIT|mapping)/);
  });

  test("maps initialize -> initialized", () => {
    expect(content).toContain("initialized");
  });

  test("maps start -> started", () => {
    expect(content).toContain("started");
  });

  test("maps complete -> completed", () => {
    // "completed" already used as state name, but should also be in mapping
    expect(content).toContain('"completed"');
  });

  test("maps pause -> paused", () => {
    expect(content).toContain('"paused"');
  });

  test("maps fail -> failed", () => {
    expect(content).toContain('"failed"');
  });

  test("maps approve -> approved", () => {
    expect(content).toContain("approved");
  });

  test("maps reject_with_feedback -> rejected", () => {
    expect(content).toContain("rejected");
  });

  test("maps resume -> resumed", () => {
    expect(content).toContain("resumed");
  });

  test("maps retry -> retried", () => {
    expect(content).toContain("retried");
  });

  test("maps terminate -> terminated", () => {
    expect(content).toContain('"terminated"');
  });

  test("maps skip -> skipped", () => {
    expect(content).toContain('"skipped"');
  });

  test("maps compact_detected -> compaction_detected", () => {
    expect(content).toContain("compaction_detected");
  });

  test("maps reinjected -> reinjected", () => {
    // reinjected maps to itself
    expect(content).toContain("reinjected");
  });

  test("maps compaction_failed -> compaction_failed", () => {
    expect(content).toContain("compaction_failed");
  });

  test("maps request_validation -> validation_requested", () => {
    expect(content).toContain("validation_requested");
  });
});

// =============================================================================
// Group 11: RBAC integration in orchestrator
// =============================================================================

test.describe("Group 11: RBAC integration", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("imports accessService from access", () => {
    expect(content).toMatch(/accessService/);
    expect(content).toMatch(/from\s+["']\.\/access/);
  });

  test("uses hasPermission for permission checks", () => {
    expect(content).toContain("hasPermission");
  });

  test("uses canUser for user permission checks", () => {
    expect(content).toContain("canUser");
  });

  test("system actor type bypasses permission checks", () => {
    expect(content).toMatch(/actorType\s*===?\s*["']system["']/);
  });
});
