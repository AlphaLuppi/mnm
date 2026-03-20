/**
 * ORCH-S04: API Routes Orchestrateur -- E2E Tests
 *
 * These tests verify the deliverables of ORCH-S04:
 *   - Groupe 1: Route file existence & exports (T01-T02)
 *   - Groupe 2: Validators — Zod schemas in packages/shared/src/validators/orchestrator.ts (T03-T08)
 *   - Groupe 3: Validator barrel exports (T09-T10)
 *   - Groupe 4: POST transition route (T11-T16)
 *   - Groupe 5: GET stage enrichi (T17-T19)
 *   - Groupe 6: GET stage context (T20-T22)
 *   - Groupe 7: GET stage artifacts & history (T23-T25)
 *   - Groupe 8: GET workflow enrichi (T26-T28)
 *   - Groupe 9: GET workflows list & workflow stages (T29-T32)
 *   - Groupe 10: POST approve route (T33-T37)
 *   - Groupe 11: POST reject route (T38-T42)
 *   - Groupe 12: GET validations pending (T43-T45)
 *   - Groupe 13: GET validation-history (T46-T47)
 *   - Groupe 14: POST check-enforcement & GET enforcement-results (T48-T53)
 *   - Groupe 15: Cross-cutting — assertCompanyAccess, getActorInfo, route count (T54-T55, T62-T64)
 *   - Groupe 16: Validator strictness & enum constraints (T56-T59)
 *   - Groupe 17: Legacy routes unchanged (T60-T61)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const ROUTES_FILE = resolve(ROOT, "server/src/routes/orchestrator.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");
const VALIDATOR_FILE = resolve(
  ROOT,
  "packages/shared/src/validators/orchestrator.ts",
);
const VALIDATOR_INDEX = resolve(
  ROOT,
  "packages/shared/src/validators/index.ts",
);
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const LEGACY_STAGES_FILE = resolve(ROOT, "server/src/routes/stages.ts");
const LEGACY_WORKFLOWS_FILE = resolve(ROOT, "server/src/routes/workflows.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Route file existence & exports (T01-T02)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Route file existence & exports", () => {
  test("T01 -- orchestrator.ts route file exists and exports orchestratorRoutes(db)", async () => {
    await expect(fsAccess(ROUTES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(
      /export\s+function\s+orchestratorRoutes\s*\(\s*db\s*:\s*Db\s*\)/,
    );
  });

  test("T02 -- orchestratorRoutes exported from routes/index.ts", async () => {
    const content = await readFile(ROUTES_INDEX, "utf-8");
    expect(content).toContain("orchestratorRoutes");
    expect(content).toMatch(/from\s+["']\.\/orchestrator/);
  });

  test("T02b -- orchestratorRoutes mounted in app.ts", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toContain("orchestratorRoutes");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Validators -- Zod schemas (T03-T08)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Validators -- Zod schemas", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T03 -- orchestratorTransitionSchema exists with event, outputArtifacts, metadata", () => {
    expect(content).toContain("orchestratorTransitionSchema");
    expect(content).toMatch(
      /export\s+const\s+orchestratorTransitionSchema/,
    );
    // Should have event field (enum)
    expect(content).toMatch(/event\s*:/);
    // Should have optional outputArtifacts
    expect(content).toContain("outputArtifacts");
    // Should have optional metadata
    expect(content).toContain("metadata");
  });

  test("T04 -- orchestratorApproveSchema exists with optional comment", () => {
    expect(content).toContain("orchestratorApproveSchema");
    expect(content).toMatch(
      /export\s+const\s+orchestratorApproveSchema/,
    );
    expect(content).toContain("comment");
  });

  test("T05 -- orchestratorRejectSchema exists with feedback min 1 char", () => {
    expect(content).toContain("orchestratorRejectSchema");
    expect(content).toMatch(
      /export\s+const\s+orchestratorRejectSchema/,
    );
    expect(content).toContain("feedback");
    // Feedback should be a required string with min(1)
    expect(content).toMatch(/feedback\s*:\s*z\.string\(\)\.min\(\s*1/);
  });

  test("T06 -- orchestratorCheckEnforcementSchema exists with outputArtifacts and workspacePath", () => {
    expect(content).toContain("orchestratorCheckEnforcementSchema");
    expect(content).toMatch(
      /export\s+const\s+orchestratorCheckEnforcementSchema/,
    );
    expect(content).toContain("outputArtifacts");
    expect(content).toContain("workspacePath");
  });

  test("T07 -- orchestratorWorkflowFilterSchema exists with optional workflowState", () => {
    expect(content).toContain("orchestratorWorkflowFilterSchema");
    expect(content).toMatch(
      /export\s+const\s+orchestratorWorkflowFilterSchema/,
    );
    expect(content).toContain("workflowState");
  });

  test("T08 -- orchestratorStageFilterSchema exists with optional machineState", () => {
    expect(content).toContain("orchestratorStageFilterSchema");
    expect(content).toMatch(
      /export\s+const\s+orchestratorStageFilterSchema/,
    );
    expect(content).toContain("machineState");
  });

  test("T03b -- all 6 schemas use .strict()", () => {
    const strictCount = (content.match(/\.strict\(\)/g) || []).length;
    expect(strictCount).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Validator barrel exports (T09-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Validator barrel exports", () => {
  test("T09 -- validators/index.ts re-exports all orchestrator schemas", async () => {
    const content = await readFile(VALIDATOR_INDEX, "utf-8");
    expect(content).toContain("orchestratorTransitionSchema");
    expect(content).toContain("orchestratorApproveSchema");
    expect(content).toContain("orchestratorRejectSchema");
    expect(content).toContain("orchestratorCheckEnforcementSchema");
    expect(content).toContain("orchestratorWorkflowFilterSchema");
    expect(content).toContain("orchestratorStageFilterSchema");
    expect(content).toMatch(/from\s+["']\.\/orchestrator/);
  });

  test("T10 -- packages/shared/src/index.ts re-exports orchestrator validators", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    expect(content).toContain("orchestratorTransitionSchema");
    expect(content).toContain("orchestratorApproveSchema");
    expect(content).toContain("orchestratorRejectSchema");
    expect(content).toContain("orchestratorCheckEnforcementSchema");
    expect(content).toContain("orchestratorWorkflowFilterSchema");
    expect(content).toContain("orchestratorStageFilterSchema");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: POST transition route (T11-T16)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: POST transition route", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T11 -- POST /companies/:companyId/orchestrator/stages/:stageId/transition route exists", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/transition["']/,
    );
  });

  test("T12 -- POST transition uses requirePermission(db, 'workflows:enforce')", () => {
    const transitionIdx = content.indexOf("stages/:stageId/transition");
    expect(transitionIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, transitionIdx - 100),
      transitionIdx + 600,
    );
    expect(block).toContain("requirePermission");
    expect(block).toContain('"workflows:enforce"');
  });

  test("T13 -- POST transition uses validate(orchestratorTransitionSchema)", () => {
    const transitionIdx = content.indexOf("stages/:stageId/transition");
    expect(transitionIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, transitionIdx - 100),
      transitionIdx + 600,
    );
    expect(block).toContain("validate(orchestratorTransitionSchema)");
  });

  test("T14 -- POST transition calls orchestratorService.transitionStage", () => {
    const transitionIdx = content.indexOf("stages/:stageId/transition");
    expect(transitionIdx).toBeGreaterThan(-1);
    const block = content.slice(transitionIdx, transitionIdx + 1200);
    expect(block).toMatch(/orchestrator\s*\.\s*transitionStage\s*\(/);
  });

  test("T15 -- POST transition calls logActivity with 'orchestrator.stage_transitioned'", () => {
    expect(content).toContain('"orchestrator.stage_transitioned"');
    const transitionIdx = content.indexOf("stages/:stageId/transition");
    expect(transitionIdx).toBeGreaterThan(-1);
    const block = content.slice(transitionIdx, transitionIdx + 1500);
    expect(block).toContain("logActivity");
    expect(block).toContain('"orchestrator.stage_transitioned"');
  });

  test("T16 -- POST transition response contains stage, fromState, toState", () => {
    const transitionIdx = content.indexOf("stages/:stageId/transition");
    expect(transitionIdx).toBeGreaterThan(-1);
    const block = content.slice(transitionIdx, transitionIdx + 2500);
    // Response should include result which has stage, fromState, toState
    expect(block).toMatch(/res\.json\(/);
    expect(block).toContain("fromState");
    expect(block).toContain("toState");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: GET stage enrichi (T17-T19)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: GET stage enrichi", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T17 -- GET /companies/:companyId/orchestrator/stages/:stageId route exists", () => {
    // Must match a GET route for /orchestrator/stages/:stageId that is NOT followed by /transition, /context, etc.
    // We verify the standalone GET route exists
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId["']\s*,/,
    );
  });

  test("T18 -- GET stage enrichi calls getStageWithState", () => {
    expect(content).toContain("getStageWithState");
  });

  test("T19 -- GET stage enrichi response includes machineState and transitionHistory", () => {
    // The response comes from getStageWithState which returns machineState, transitionHistory
    expect(content).toContain("getStageWithState");
    // The route should call res.json with the stage data
    expect(content).toMatch(
      /getStageWithState\s*\([^)]*\)[\s\S]*?res\.json\(/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: GET stage context (T20-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: GET stage context", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T20 -- GET /companies/:companyId/orchestrator/stages/:stageId/context route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/context["']/,
    );
  });

  test("T21 -- GET stage context calls buildStageContext", () => {
    expect(content).toContain("buildStageContext");
  });

  test("T22 -- GET stage context response format (PrePromptPayload)", () => {
    // buildStageContext returns PrePromptPayload with stagePrePrompts, previousArtifacts, acceptanceCriteria
    const contextIdx = content.indexOf("stages/:stageId/context");
    expect(contextIdx).toBeGreaterThan(-1);
    const block = content.slice(contextIdx, contextIdx + 600);
    expect(block).toContain("buildStageContext");
    expect(block).toMatch(/res\.json\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: GET stage artifacts & history (T23-T25)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: GET stage artifacts & history", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T23 -- GET /companies/:companyId/orchestrator/stages/:stageId/artifacts route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/artifacts["']/,
    );
  });

  test("T24 -- GET /companies/:companyId/orchestrator/stages/:stageId/history route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/history["']/,
    );
  });

  test("T25 -- GET stage history response is TransitionRecord array", () => {
    const historyIdx = content.indexOf("stages/:stageId/history");
    expect(historyIdx).toBeGreaterThan(-1);
    const block = content.slice(historyIdx, historyIdx + 600);
    expect(block).toMatch(/res\.json\(/);
    // Should reference transitionHistory or similar
    expect(block).toMatch(/transitionHistory|history/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: GET workflow enrichi (T26-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: GET workflow enrichi", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T26 -- GET /companies/:companyId/orchestrator/workflows/:workflowId route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/workflows\/:workflowId["']\s*,/,
    );
  });

  test("T27 -- GET workflow enrichi calls getWorkflowWithState", () => {
    expect(content).toContain("getWorkflowWithState");
  });

  test("T28 -- GET workflow enrichi response includes workflowState and stages with machineState", () => {
    // getWorkflowWithState returns workflow with workflowState + stages array
    const workflowGetIdx = content.indexOf(
      "orchestrator/workflows/:workflowId",
    );
    expect(workflowGetIdx).toBeGreaterThan(-1);
    const block = content.slice(workflowGetIdx, workflowGetIdx + 600);
    expect(block).toContain("getWorkflowWithState");
    expect(block).toMatch(/res\.json\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: GET workflows list & workflow stages (T29-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: GET workflows list & workflow stages", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T29 -- GET /companies/:companyId/orchestrator/workflows route exists (list)", () => {
    // Must match a GET route ending with /orchestrator/workflows (without /:workflowId)
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/workflows["']\s*,/,
    );
  });

  test("T30 -- GET workflows list supports workflowState filter", () => {
    expect(content).toContain("workflowState");
    // Should use query params for filtering
    expect(content).toMatch(/req\.query|workflowState/);
  });

  test("T31 -- GET /companies/:companyId/orchestrator/workflows/:workflowId/stages route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/workflows\/:workflowId\/stages["']/,
    );
  });

  test("T32 -- GET workflow stages supports machineState filter", () => {
    expect(content).toContain("machineState");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: POST approve route (T33-T37)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: POST approve route", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T33 -- POST /companies/:companyId/orchestrator/stages/:stageId/approve route exists", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/approve["']/,
    );
  });

  test("T34 -- POST approve uses requirePermission(db, 'workflows:enforce')", () => {
    const approveIdx = content.indexOf("stages/:stageId/approve");
    expect(approveIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, approveIdx - 100),
      approveIdx + 600,
    );
    expect(block).toContain("requirePermission");
    expect(block).toContain('"workflows:enforce"');
  });

  test("T35 -- POST approve uses validate(orchestratorApproveSchema)", () => {
    const approveIdx = content.indexOf("stages/:stageId/approve");
    expect(approveIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, approveIdx - 100),
      approveIdx + 600,
    );
    expect(block).toContain("validate(orchestratorApproveSchema)");
  });

  test("T36 -- POST approve calls transitionStage with 'approve' event", () => {
    const approveIdx = content.indexOf("stages/:stageId/approve");
    expect(approveIdx).toBeGreaterThan(-1);
    const block = content.slice(approveIdx, approveIdx + 1200);
    expect(block).toMatch(/transitionStage\s*\(/);
    expect(block).toContain('"approve"');
  });

  test("T37 -- POST approve calls logActivity with 'orchestrator.stage_approved'", () => {
    expect(content).toContain('"orchestrator.stage_approved"');
    const approveIdx = content.indexOf("stages/:stageId/approve");
    expect(approveIdx).toBeGreaterThan(-1);
    const block = content.slice(approveIdx, approveIdx + 1500);
    expect(block).toContain("logActivity");
    expect(block).toContain('"orchestrator.stage_approved"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: POST reject route (T38-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: POST reject route", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T38 -- POST /companies/:companyId/orchestrator/stages/:stageId/reject route exists", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/reject["']/,
    );
  });

  test("T39 -- POST reject uses requirePermission(db, 'workflows:enforce')", () => {
    const rejectIdx = content.indexOf("stages/:stageId/reject");
    expect(rejectIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, rejectIdx - 100),
      rejectIdx + 600,
    );
    expect(block).toContain("requirePermission");
    expect(block).toContain('"workflows:enforce"');
  });

  test("T40 -- POST reject uses validate(orchestratorRejectSchema)", () => {
    const rejectIdx = content.indexOf("stages/:stageId/reject");
    expect(rejectIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, rejectIdx - 100),
      rejectIdx + 600,
    );
    expect(block).toContain("validate(orchestratorRejectSchema)");
  });

  test("T41 -- POST reject calls transitionStage with 'reject_with_feedback' event", () => {
    const rejectIdx = content.indexOf("stages/:stageId/reject");
    expect(rejectIdx).toBeGreaterThan(-1);
    const block = content.slice(rejectIdx, rejectIdx + 1200);
    expect(block).toMatch(/transitionStage\s*\(/);
    expect(block).toContain('"reject_with_feedback"');
  });

  test("T42 -- POST reject calls logActivity with 'orchestrator.stage_rejected'", () => {
    expect(content).toContain('"orchestrator.stage_rejected"');
    const rejectIdx = content.indexOf("stages/:stageId/reject");
    expect(rejectIdx).toBeGreaterThan(-1);
    const block = content.slice(rejectIdx, rejectIdx + 1500);
    expect(block).toContain("logActivity");
    expect(block).toContain('"orchestrator.stage_rejected"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: GET validations pending (T43-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: GET validations pending", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T43 -- GET /companies/:companyId/orchestrator/validations/pending route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/validations\/pending["']/,
    );
  });

  test("T44 -- GET validations pending uses requirePermission(db, 'workflows:enforce')", () => {
    const pendingIdx = content.indexOf("validations/pending");
    expect(pendingIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, pendingIdx - 200),
      pendingIdx + 400,
    );
    expect(block).toContain("requirePermission");
    expect(block).toContain('"workflows:enforce"');
  });

  test("T45 -- GET validations pending calls listPendingValidations", () => {
    const pendingIdx = content.indexOf("validations/pending");
    expect(pendingIdx).toBeGreaterThan(-1);
    const block = content.slice(pendingIdx, pendingIdx + 600);
    expect(block).toContain("listPendingValidations");
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: GET validation-history (T46-T47)
// ---------------------------------------------------------------------------

test.describe("Groupe 13: GET validation-history", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T46 -- GET /companies/:companyId/orchestrator/stages/:stageId/validation-history route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/validation-history["']/,
    );
  });

  test("T47 -- GET validation-history calls getValidationHistory", () => {
    const histIdx = content.indexOf("validation-history");
    expect(histIdx).toBeGreaterThan(-1);
    const block = content.slice(histIdx, histIdx + 600);
    expect(block).toContain("getValidationHistory");
  });
});

// ---------------------------------------------------------------------------
// Groupe 14: POST check-enforcement & GET enforcement-results (T48-T53)
// ---------------------------------------------------------------------------

test.describe("Groupe 14: Enforcement routes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T48 -- POST /companies/:companyId/orchestrator/stages/:stageId/check-enforcement route exists", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/check-enforcement["']/,
    );
  });

  test("T49 -- POST check-enforcement uses requirePermission(db, 'workflows:enforce')", () => {
    const checkIdx = content.indexOf("check-enforcement");
    expect(checkIdx).toBeGreaterThan(-1);
    const block = content.slice(
      Math.max(0, checkIdx - 200),
      checkIdx + 400,
    );
    expect(block).toContain("requirePermission");
    expect(block).toContain('"workflows:enforce"');
  });

  test("T50 -- POST check-enforcement calls enforcer.enforceTransition", () => {
    const checkIdx = content.indexOf("check-enforcement");
    expect(checkIdx).toBeGreaterThan(-1);
    const block = content.slice(checkIdx, checkIdx + 800);
    expect(block).toMatch(/enforcer\s*\.\s*enforceTransition\s*\(/);
  });

  test("T51 -- POST check-enforcement does NOT call transitionStage (dry-run)", () => {
    // Find the check-enforcement route handler block
    const checkIdx = content.indexOf("check-enforcement");
    expect(checkIdx).toBeGreaterThan(-1);
    // Find the next route definition after check-enforcement to bound the block
    const afterCheck = content.slice(checkIdx);
    const nextRouteIdx = afterCheck.search(
      /router\.(get|post|patch|delete)\(\s*\n?\s*["']/,
    );
    const block =
      nextRouteIdx > 0
        ? afterCheck.slice(0, nextRouteIdx)
        : afterCheck.slice(0, 800);
    // Should NOT contain transitionStage in this specific route handler
    expect(block).not.toContain("transitionStage");
  });

  test("T52 -- GET /companies/:companyId/orchestrator/stages/:stageId/enforcement-results route exists", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*orchestrator\/stages\/:stageId\/enforcement-results["']/,
    );
  });

  test("T53 -- GET enforcement-results returns persisted enforcementResults", () => {
    const resultsIdx = content.indexOf("enforcement-results");
    expect(resultsIdx).toBeGreaterThan(-1);
    const block = content.slice(resultsIdx, resultsIdx + 600);
    expect(block).toMatch(/res\.json\(/);
    expect(block).toMatch(/enforcement/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 15: Cross-cutting -- assertCompanyAccess, getActorInfo, route count (T54-T55, T62-T64)
// ---------------------------------------------------------------------------

test.describe("Groupe 15: Cross-cutting patterns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T54 -- assertCompanyAccess called on ALL routes", () => {
    expect(content).toContain("assertCompanyAccess");
    // Should have at least 14 occurrences (one per route)
    const occurrences = (content.match(/assertCompanyAccess\s*\(/g) || [])
      .length;
    expect(occurrences).toBeGreaterThanOrEqual(14);
  });

  test("T55 -- getActorInfo used for actor resolution in mutation routes", () => {
    expect(content).toContain("getActorInfo");
    // At least 3 mutation routes: transition, approve, reject (+check-enforcement optionally)
    const occurrences = (content.match(/getActorInfo\s*\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test("T62 -- Route file imports orchestratorService from services", () => {
    expect(content).toContain("orchestratorService");
    expect(content).toMatch(
      /from\s+["']\.\.\/services\/orchestrator|from\s+["']\.\.\/services\/index/,
    );
  });

  test("T63 -- Route file imports workflowEnforcerService from services", () => {
    expect(content).toContain("workflowEnforcerService");
    expect(content).toMatch(
      /from\s+["']\.\.\/services\/workflow-enforcer|from\s+["']\.\.\/services\/index/,
    );
  });

  test("T64 -- 14 routes total in orchestrator.ts", () => {
    // Count all router.get and router.post calls
    const getRoutes = (content.match(/router\.get\s*\(/g) || []).length;
    const postRoutes = (content.match(/router\.post\s*\(/g) || []).length;
    const totalRoutes = getRoutes + postRoutes;
    expect(totalRoutes).toBe(14);
  });

  test("T64b -- Correct HTTP method split: POST for mutations, GET for reads", () => {
    // 5 POST routes: transition, approve, reject, check-enforcement, (pending validations is GET)
    const postRoutes = (content.match(/router\.post\s*\(/g) || []).length;
    expect(postRoutes).toBe(4);
    // 10 GET routes: stage, context, artifacts, history, workflow, workflows, workflow-stages, pending, validation-history, enforcement-results
    const getRoutes = (content.match(/router\.get\s*\(/g) || []).length;
    expect(getRoutes).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Groupe 16: Validator strictness & enum constraints (T56-T59)
// ---------------------------------------------------------------------------

test.describe("Groupe 16: Validator strictness & enum constraints", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T56 -- orchestratorTransitionSchema uses z.enum for event field (STAGE_EVENTS)", () => {
    // event should be z.enum(STAGE_EVENTS)
    expect(content).toMatch(/event\s*:\s*z\.enum\(\s*STAGE_EVENTS\s*\)/);
  });

  test("T57 -- orchestratorRejectSchema feedback rejects empty string (min 1)", () => {
    // Already tested in T05, but ensure the min(1) pattern specifically
    expect(content).toMatch(/feedback\s*:\s*z\.string\(\)\.min\(\s*1/);
  });

  test("T58 -- orchestratorWorkflowFilterSchema uses z.enum(WORKFLOW_STATES)", () => {
    expect(content).toMatch(
      /workflowState\s*:\s*z\.enum\(\s*WORKFLOW_STATES\s*\)/,
    );
  });

  test("T59 -- orchestratorStageFilterSchema uses z.enum(STAGE_STATES)", () => {
    expect(content).toMatch(
      /machineState\s*:\s*z\.enum\(\s*STAGE_STATES\s*\)/,
    );
  });

  test("T56b -- Validator file imports STAGE_EVENTS, STAGE_STATES, WORKFLOW_STATES", () => {
    expect(content).toContain("STAGE_EVENTS");
    expect(content).toContain("STAGE_STATES");
    expect(content).toContain("WORKFLOW_STATES");
  });
});

// ---------------------------------------------------------------------------
// Groupe 17: Legacy routes unchanged (T60-T61)
// ---------------------------------------------------------------------------

test.describe("Groupe 17: Legacy routes unchanged", () => {
  test("T60 -- Legacy stages.ts still uses stageService (not orchestratorService)", async () => {
    const content = await readFile(LEGACY_STAGES_FILE, "utf-8");
    // Legacy stages.ts should still use stageService
    expect(content).toContain("stageService");
    // Should NOT contain orchestratorService
    expect(content).not.toContain("orchestratorService");
  });

  test("T61 -- Legacy workflows.ts still uses workflowService (not orchestratorService)", async () => {
    const content = await readFile(LEGACY_WORKFLOWS_FILE, "utf-8");
    expect(content).toContain("workflowService");
    expect(content).not.toContain("orchestratorService");
  });
});

// ---------------------------------------------------------------------------
// Groupe 18: Route imports & patterns
// ---------------------------------------------------------------------------

test.describe("Groupe 18: Route imports & patterns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("Routes imports Router from express", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*Router[^}]*\}\s+from\s+["']express["']/,
    );
  });

  test("Routes imports Db from @mnm/db", () => {
    expect(content).toMatch(/from\s+["']@mnm\/db["']/);
    expect(content).toContain("Db");
  });

  test("Routes imports validate middleware", () => {
    expect(content).toContain("validate");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/validate/);
  });

  test("Routes imports requirePermission middleware", () => {
    expect(content).toContain("requirePermission");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/require-permission/);
  });

  test("Routes imports assertCompanyAccess and getActorInfo from authz", () => {
    expect(content).toContain("assertCompanyAccess");
    expect(content).toContain("getActorInfo");
    expect(content).toMatch(/from\s+["']\.\/authz/);
  });

  test("Routes imports logActivity", () => {
    expect(content).toContain("logActivity");
  });

  test("Routes imports all 6 validator schemas from @mnm/shared", () => {
    expect(content).toContain("orchestratorTransitionSchema");
    expect(content).toContain("orchestratorApproveSchema");
    expect(content).toContain("orchestratorRejectSchema");
    expect(content).toContain("orchestratorCheckEnforcementSchema");
    expect(content).toContain("orchestratorWorkflowFilterSchema");
    expect(content).toContain("orchestratorStageFilterSchema");
  });

  test("Routes creates orchestratorService and workflowEnforcerService instances with db", () => {
    expect(content).toContain("orchestratorService(db)");
    expect(content).toContain("workflowEnforcerService(db)");
  });

  test("Routes returns a Router", () => {
    expect(content).toMatch(/return\s+router\s*;/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 19: Services barrel export verification
// ---------------------------------------------------------------------------

test.describe("Groupe 19: Services barrel exports", () => {
  test("orchestratorService exported from services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("orchestratorService");
    expect(content).toMatch(/from\s+["']\.\/orchestrator/);
  });

  test("workflowEnforcerService exported from services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("workflowEnforcerService");
    expect(content).toMatch(/from\s+["']\.\/workflow-enforcer/);
  });
});
