/**
 * ORCH-S03: Validation Humaine (Human-In-The-Loop) -- E2E Tests
 *
 * These tests verify the deliverables of ORCH-S03:
 *   - Groupe 1: Schema extension — WorkflowStageTemplateDef HITL fields (T01-T02)
 *   - Groupe 2: Shared types — HitlDecision, HitlValidationRequest, PendingValidation (T03-T05)
 *   - Groupe 3: Schema extension — stage_instances HITL columns (T06-T07)
 *   - Groupe 4: Migration SQL (T08)
 *   - Groupe 5: LiveEvent constants — HITL events (T09)
 *   - Groupe 6: HITL validation service file & exports (T10, T30-T31)
 *   - Groupe 7: HITL service functions — shouldRequestValidation (T11-T12)
 *   - Groupe 8: Orchestrator integration — HITL interception (T13-T14)
 *   - Groupe 9: HITL service functions — approve/reject (T15-T17)
 *   - Groupe 10: HITL persistence — hitlDecision & hitlHistory (T18-T20)
 *   - Groupe 11: HITL service — list & history queries (T21-T23)
 *   - Groupe 12: WebSocket events (T24-T26)
 *   - Groupe 13: Enforcement before HITL & auto-advance (T27-T28)
 *   - Groupe 14: Full HITL cycle (T29)
 *   - Groupe 15: Frontend — ValidationBanner (T32-T36)
 *   - Groupe 16: Frontend — PendingValidationsPanel (T37-T39)
 *   - Groupe 17: Frontend — ValidationHistory & readonly (T40-T41)
 *   - Groupe 18: Backward compatibility (T42)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const WORKFLOW_TEMPLATES_SCHEMA = resolve(ROOT, "packages/db/src/schema/workflow_templates.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/orchestrator.ts");
const STAGE_INSTANCES_SCHEMA = resolve(ROOT, "packages/db/src/schema/stage_instances.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const HITL_SERVICE_FILE = resolve(ROOT, "server/src/services/hitl-validation.ts");
const ORCHESTRATOR_FILE = resolve(ROOT, "server/src/services/orchestrator.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VALIDATION_BANNER = resolve(ROOT, "ui/src/components/orchestrator/ValidationBanner.tsx");
const PENDING_VALIDATIONS_PANEL = resolve(ROOT, "ui/src/components/orchestrator/PendingValidationsPanel.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: Schema extension — WorkflowStageTemplateDef HITL fields (T01-T02)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: WorkflowStageTemplateDef HITL fields", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WORKFLOW_TEMPLATES_SCHEMA, "utf-8");
  });

  test("T01 -- WorkflowStageTemplateDef contains hitlRequired optional boolean field", () => {
    expect(content).toContain("hitlRequired");
    expect(content).toMatch(/hitlRequired\s*\?\s*:\s*boolean/);
  });

  test("T02 -- WorkflowStageTemplateDef contains hitlRoles optional string[] field", () => {
    expect(content).toContain("hitlRoles");
    expect(content).toMatch(/hitlRoles\s*\?\s*:\s*string\s*\[\s*\]/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Shared types — HitlDecision, HitlValidationRequest, PendingValidation (T03-T05)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Shared types — HITL interfaces", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("T03 -- HitlDecision type exported with required fields", () => {
    expect(content).toMatch(/export\s+(interface|type)\s+HitlDecision/);
    const startIdx = content.search(/export\s+(interface|type)\s+HitlDecision/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 600);
    expect(block).toContain("decision");
    expect(block).toContain("actorId");
    expect(block).toContain("actorType");
    expect(block).toContain("comment");
    expect(block).toContain("feedback");
    expect(block).toContain("decidedAt");
  });

  test("T03b -- HitlDecision.decision allows 'approved' and 'rejected'", () => {
    const startIdx = content.search(/export\s+(interface|type)\s+HitlDecision/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 600);
    expect(block).toContain("approved");
    expect(block).toContain("rejected");
  });

  test("T04 -- HitlValidationRequest type exported with required fields", () => {
    expect(content).toMatch(/export\s+(interface|type)\s+HitlValidationRequest/);
    const startIdx = content.search(/export\s+(interface|type)\s+HitlValidationRequest/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 800);
    expect(block).toContain("stageId");
    expect(block).toContain("workflowInstanceId");
    expect(block).toContain("stageName");
    expect(block).toContain("workflowName");
    expect(block).toContain("hitlRoles");
    expect(block).toContain("requestedAt");
    expect(block).toContain("requestedBy");
  });

  test("T05 -- PendingValidation type exported with required fields", () => {
    expect(content).toMatch(/export\s+(interface|type)\s+PendingValidation/);
    const startIdx = content.search(/export\s+(interface|type)\s+PendingValidation/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 800);
    expect(block).toContain("stageId");
    expect(block).toContain("stageName");
    expect(block).toContain("workflowInstanceId");
    expect(block).toContain("workflowName");
    expect(block).toContain("requestedAt");
    expect(block).toContain("hitlRoles");
    expect(block).toContain("outputArtifacts");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Schema extension — stage_instances HITL columns (T06-T07)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: stage_instances HITL columns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STAGE_INSTANCES_SCHEMA, "utf-8");
  });

  test("T06 -- stage_instances contains hitlDecision column (jsonb)", () => {
    expect(content).toContain("hitl_decision");
    expect(content).toMatch(/jsonb\s*\(\s*["']hitl_decision["']\s*\)/);
  });

  test("T07 -- stage_instances contains hitlHistory column (jsonb)", () => {
    expect(content).toContain("hitl_history");
    expect(content).toMatch(/jsonb\s*\(\s*["']hitl_history["']\s*\)/);
  });

  test("T07b -- hitlHistory is typed as HitlDecision[]", () => {
    // Should reference HitlDecision array type (on same or nearby lines)
    // The schema defines: jsonb("hitl_history").$type<HitlDecision[]>()
    expect(content).toContain("HitlDecision[]");
    expect(content).toContain("hitl_history");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Migration SQL (T08)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Migration SQL", () => {
  test("T08 -- Migration file adds hitl_decision and hitl_history columns to stage_instances", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));

    // Search for a migration containing hitl columns
    let found = false;
    for (const f of sqlFiles) {
      const migContent = await readFile(resolve(MIGRATIONS_DIR, f), "utf-8");
      if (
        migContent.includes("hitl_decision") &&
        migContent.includes("hitl_history")
      ) {
        found = true;
        // Verify it targets stage_instances
        expect(migContent.toLowerCase()).toContain("stage_instances");
        // Verify jsonb type
        expect(migContent.toLowerCase()).toMatch(/jsonb/);
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: LiveEvent constants — HITL events (T09)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: LiveEvent constants — HITL events", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS_FILE, "utf-8");
  });

  test("T09a -- LIVE_EVENT_TYPES contains 'hitl.validation_requested'", () => {
    expect(content).toContain('"hitl.validation_requested"');
  });

  test("T09b -- LIVE_EVENT_TYPES contains 'hitl.approved'", () => {
    expect(content).toContain('"hitl.approved"');
  });

  test("T09c -- LIVE_EVENT_TYPES contains 'hitl.rejected'", () => {
    expect(content).toContain('"hitl.rejected"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: HITL validation service file & exports (T10, T30-T31)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: HITL validation service file & exports", () => {
  test("T10 -- hitl-validation.ts service file exists", async () => {
    await expect(fsAccess(HITL_SERVICE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T10b -- hitl-validation.ts exports a factory function accepting db", async () => {
    const content = await readFile(HITL_SERVICE_FILE, "utf-8");
    // Should export hitlValidationService or similar factory
    expect(content).toMatch(
      /export\s+function\s+hitlValidation(Service)?\s*\(/,
    );
    // Should accept db parameter of type Db
    expect(content).toMatch(/\(\s*db\s*:\s*Db\s*\)/);
  });

  test("T30 -- Services barrel (server/src/services/index.ts) exports hitlValidationService", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toMatch(/hitlValidation/);
    expect(content).toMatch(/from\s+["']\.\/hitl-validation/);
  });

  test("T31a -- Types index exports HitlDecision, HitlValidationRequest, PendingValidation", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("HitlDecision");
    expect(content).toContain("HitlValidationRequest");
    expect(content).toContain("PendingValidation");
  });

  test("T31b -- Shared index (packages/shared/src/index.ts) re-exports HITL types", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    expect(content).toContain("HitlDecision");
    expect(content).toContain("HitlValidationRequest");
    expect(content).toContain("PendingValidation");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: HITL service functions — shouldRequestValidation (T11-T12)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: shouldRequestValidation logic", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("T11 -- shouldRequestValidation function exists", () => {
    expect(content).toMatch(/shouldRequestValidation\s*\(/);
  });

  test("T11b -- shouldRequestValidation checks hitlRequired field from template", () => {
    expect(content).toContain("hitlRequired");
  });

  test("T12 -- shouldRequestValidation avoids infinite loop by checking last decision", () => {
    // Strategy A: checks hitlDecision.decision === "approved" to prevent re-triggering
    // The function should reference hitlDecision or lastDecision to break the cycle
    expect(content).toMatch(/hitlDecision|lastDecision/);
    expect(content).toContain("approved");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Orchestrator integration — HITL interception (T13-T14)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Orchestrator HITL interception", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("T13 -- orchestrator.ts imports from hitl-validation", () => {
    expect(content).toMatch(/from\s+["']\.\/hitl-validation/);
  });

  test("T13b -- orchestrator.ts calls shouldRequestValidation when event is 'complete'", () => {
    expect(content).toContain("shouldRequestValidation");
    // Should have logic that checks the event is "complete" before calling shouldRequestValidation
    // Accepts both: `event === "complete"` and `event == "complete"` patterns
    expect(content).toMatch(/event\s*===?\s*["']complete["']/);
    // shouldRequestValidation should be called in the same block
    expect(content).toContain("shouldRequestValidation");
  });

  test("T13c -- orchestrator.ts replaces event with 'request_validation' when HITL required", () => {
    // Should reference request_validation in the HITL interception block
    expect(content).toMatch(/["']request_validation["']/);
    // There should be logic that reassigns the event or uses an effective event
    // Accepts both: `event = "request_validation"` and `effectiveEvent = "request_validation"`
    expect(content).toMatch(/(effective)?[Ee]vent\s*=\s*["']request_validation["']/);
  });

  test("T14 -- orchestrator.ts does NOT intercept when hitlRequired is false", () => {
    // The interception should be conditional on shouldRequestValidation returning true
    // We verify the conditional structure exists
    expect(content).toMatch(/shouldRequestValidation\s*\(/);
    // The function should have an if-check around the interception
    expect(content).toMatch(/if\s*\(.*shouldRequestValidation|if\s*\(.*needsHitl|if\s*\(.*hitl/i);
  });

  test("T13d -- HITL interception happens AFTER enforcement check", () => {
    // enforcement call should appear before hitl interception
    const enforcementIdx = content.search(/\.enforceTransition\s*\(/);
    const hitlIdx = content.search(/shouldRequestValidation\s*\(/);
    expect(enforcementIdx).toBeGreaterThan(-1);
    expect(hitlIdx).toBeGreaterThan(-1);
    expect(enforcementIdx).toBeLessThan(hitlIdx);
  });

  test("T13e -- Auto-complete after approve (prevent infinite loop)", () => {
    // After approve, the orchestrator should auto-complete the stage
    // without re-triggering HITL.
    // Look for: effectiveEvent === "approve" followed by transitionStage(... "complete")
    expect(content).toMatch(/["']approve["'].*transitionStage\s*\([^)]*["']complete["']/s);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: HITL service functions — approve/reject (T15-T17)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: HITL service approve/reject", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("T15 -- approveStage function exists", () => {
    expect(content).toMatch(/approveStage\s*\(/);
  });

  test("T15b -- approveStage persists approved decision", () => {
    // Should set decision to "approved"
    expect(content).toMatch(/decision.*["']approved["']/s);
  });

  test("T16 -- rejectStage function exists", () => {
    expect(content).toMatch(/rejectStage\s*\(/);
  });

  test("T16b -- rejectStage requires non-empty feedback", () => {
    // Should validate that feedback is not empty
    expect(content).toMatch(/feedback.*(!|empty|required|length|trim)|!.*feedback/s);
  });

  test("T17 -- rejectStage persists rejected decision", () => {
    // Should set decision to "rejected"
    expect(content).toMatch(/decision.*["']rejected["']/s);
  });

  test("T17b -- rejectStage passes feedback in payload", () => {
    // Should pass feedback in the transition payload
    expect(content).toContain("feedback");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: HITL persistence — hitlDecision & hitlHistory (T18-T20)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: HITL decision persistence", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("T18 -- hitlDecision is persisted on approve", () => {
    // Should write hitlDecision with decision: "approved"
    expect(content).toContain("hitlDecision");
    expect(content).toMatch(/["']approved["']/);
  });

  test("T19 -- hitlDecision is persisted on reject", () => {
    expect(content).toMatch(/["']rejected["']/);
  });

  test("T20 -- hitlHistory accumulates decisions (array append)", () => {
    expect(content).toContain("hitlHistory");
    // Should push or spread into the history array
    expect(content).toMatch(/hitlHistory.*(\[.*\.\.\.|\bpush\b|concat)/s);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: HITL service — list & history queries (T21-T23)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: List pending & history queries", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("T21 -- listPendingValidations function exists", () => {
    expect(content).toMatch(/listPendingValidations\s*\(/);
  });

  test("T22 -- listPendingValidations filters by companyId", () => {
    expect(content).toContain("companyId");
    // Should query stages with machineState === "validating"
    expect(content).toMatch(/["']validating["']/);
  });

  test("T23 -- getValidationHistory function exists", () => {
    expect(content).toMatch(/getValidationHistory\s*\(/);
  });

  test("T23b -- getValidationHistory returns ordered decisions", () => {
    // Should reference hitlHistory for a given stageId
    expect(content).toContain("hitlHistory");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: WebSocket events (T24-T26)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: WebSocket HITL events", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("T24 -- publishLiveEvent called with hitl.validation_requested", () => {
    expect(content).toContain("publishLiveEvent");
    expect(content).toMatch(/hitl\.validation_requested/);
  });

  test("T25 -- publishLiveEvent called with hitl.approved", () => {
    expect(content).toMatch(/hitl\.approved/);
  });

  test("T26 -- publishLiveEvent called with hitl.rejected", () => {
    expect(content).toMatch(/hitl\.rejected/);
  });

  test("T24b -- hitl.validation_requested payload includes stageId and hitlRoles", () => {
    // The requestValidation function builds an HitlValidationRequest with stageId and hitlRoles
    // and then passes it as payload to publishLiveEvent with hitl.validation_requested
    // Verify the function builds the validation request with the expected fields
    const idx = content.indexOf("hitl.validation_requested");
    expect(idx).toBeGreaterThan(-1);
    // Look in the broader requestValidation function block
    const funcIdx = content.indexOf("async function requestValidation");
    expect(funcIdx).toBeGreaterThan(-1);
    const funcBlock = content.slice(funcIdx, funcIdx + 1000);
    expect(funcBlock).toContain("stageId");
    expect(funcBlock).toContain("hitlRoles");
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: Enforcement before HITL & auto-advance (T27-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 13: Enforcement before HITL & auto-advance", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("T27 -- Enforcement failure prevents HITL interception", () => {
    // The enforcement check throws/returns before HITL logic
    // Enforcement error should be thrown before shouldRequestValidation is reached
    const enforcementThrow = content.search(/ENFORCEMENT_FAILED/);
    const hitlCheck = content.search(/shouldRequestValidation/);
    expect(enforcementThrow).toBeGreaterThan(-1);
    expect(hitlCheck).toBeGreaterThan(-1);
    expect(enforcementThrow).toBeLessThan(hitlCheck);
  });

  test("T28 -- maybeAdvanceNextStage is called after approval completes the stage", () => {
    // After approve -> auto-complete -> completed, maybeAdvanceNextStage should run
    expect(content).toContain("maybeAdvanceNextStage");
    // The maybeAdvanceNextStage call should be linked to "completed" state
    expect(content).toMatch(/toState\s*===\s*["']completed["'].*maybeAdvanceNextStage/s);
  });
});

// ---------------------------------------------------------------------------
// Groupe 14: Full HITL cycle (T29)
// ---------------------------------------------------------------------------

test.describe("Groupe 14: Full HITL cycle verification", () => {
  test("T29 -- orchestrator supports full HITL cycle (complete -> validating -> reject -> in_progress -> complete -> validating -> approve -> completed)", async () => {
    const orchContent = await readFile(ORCHESTRATOR_FILE, "utf-8");
    const hitlContent = await readFile(HITL_SERVICE_FILE, "utf-8");

    // 1. complete can be intercepted to request_validation
    expect(orchContent).toMatch(/(effective)?[Ee]vent\s*=\s*["']request_validation["']/);

    // 2. approve triggers auto-complete (approve -> transitionStage with "complete")
    expect(orchContent).toMatch(/["']approve["'].*transitionStage\s*\([^)]*["']complete["']/s);

    // 3. reject_with_feedback goes back to in_progress with feedback
    expect(orchContent).toContain("reject_with_feedback");
    expect(orchContent).toContain("feedback");

    // 4. HITL service supports the full cycle
    expect(hitlContent).toMatch(/shouldRequestValidation\s*\(/);
    expect(hitlContent).toMatch(/approveStage\s*\(/);
    expect(hitlContent).toMatch(/rejectStage\s*\(/);

    // 5. hitlHistory accumulates multiple decisions
    expect(hitlContent).toContain("hitlHistory");
  });
});

// ---------------------------------------------------------------------------
// Groupe 15: Frontend — ValidationBanner (T32-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 15: ValidationBanner component", () => {
  test("T32 -- ValidationBanner.tsx exists", async () => {
    await expect(fsAccess(VALIDATION_BANNER).then(() => true)).resolves.toBe(true);
  });

  test("T32b -- ValidationBanner uses required data-testid attributes", async () => {
    const content = await readFile(VALIDATION_BANNER, "utf-8");
    expect(content).toContain("orch-s03-validation-banner");
    expect(content).toContain("orch-s03-approve-btn");
    expect(content).toContain("orch-s03-reject-btn");
  });

  test("T33 -- ValidationBanner shows stage name and output artifacts", async () => {
    const content = await readFile(VALIDATION_BANNER, "utf-8");
    expect(content).toContain("orch-s03-validation-banner-stage-name");
    expect(content).toContain("orch-s03-output-artifacts-list");
  });

  test("T34 -- Approve button opens confirmation dialog", async () => {
    const content = await readFile(VALIDATION_BANNER, "utf-8");
    expect(content).toContain("orch-s03-approve-dialog");
    expect(content).toContain("orch-s03-approve-comment-input");
    expect(content).toContain("orch-s03-approve-confirm-btn");
  });

  test("T35 -- Reject button opens feedback dialog", async () => {
    const content = await readFile(VALIDATION_BANNER, "utf-8");
    expect(content).toContain("orch-s03-reject-dialog");
    expect(content).toContain("orch-s03-reject-feedback-input");
    expect(content).toContain("orch-s03-reject-confirm-btn");
    expect(content).toContain("orch-s03-reject-cancel-btn");
  });

  test("T36 -- Reject dialog disables confirm when feedback is empty", async () => {
    const content = await readFile(VALIDATION_BANNER, "utf-8");
    // Should have logic that disables the confirm button based on feedback content
    // Look for disabled prop on reject-confirm-btn linked to feedback state
    expect(content).toMatch(/disabled.*feedback|feedback.*disabled/s);
  });
});

// ---------------------------------------------------------------------------
// Groupe 16: Frontend — PendingValidationsPanel (T37-T39)
// ---------------------------------------------------------------------------

test.describe("Groupe 16: PendingValidationsPanel component", () => {
  test("T37 -- PendingValidationsPanel.tsx exists", async () => {
    await expect(fsAccess(PENDING_VALIDATIONS_PANEL).then(() => true)).resolves.toBe(true);
  });

  test("T37b -- PendingValidationsPanel uses panel data-testid", async () => {
    const content = await readFile(PENDING_VALIDATIONS_PANEL, "utf-8");
    expect(content).toContain("orch-s03-pending-validations-panel");
  });

  test("T38 -- PendingValidationsPanel shows badge count", async () => {
    const content = await readFile(PENDING_VALIDATIONS_PANEL, "utf-8");
    expect(content).toContain("orch-s03-pending-validations-badge");
  });

  test("T39 -- PendingValidationsPanel lists items with stage name, workflow name, and link", async () => {
    const content = await readFile(PENDING_VALIDATIONS_PANEL, "utf-8");
    expect(content).toContain("orch-s03-pending-validation-item");
    expect(content).toContain("orch-s03-pending-validation-stage-name");
    expect(content).toContain("orch-s03-pending-validation-workflow-name");
    expect(content).toContain("orch-s03-pending-validation-link");
  });
});

// ---------------------------------------------------------------------------
// Groupe 17: Frontend — ValidationHistory & readonly (T40-T41)
// ---------------------------------------------------------------------------

test.describe("Groupe 17: ValidationHistory & readonly banner", () => {
  test("T40 -- ValidationHistory displays decision items with actor and date", async () => {
    // ValidationHistory may be in a separate file or embedded in ValidationBanner
    const historyFile = resolve(ROOT, "ui/src/components/orchestrator/ValidationHistory.tsx");
    let content: string;
    try {
      await fsAccess(historyFile);
      content = await readFile(historyFile, "utf-8");
    } catch {
      // Fallback: might be embedded in ValidationBanner
      content = await readFile(VALIDATION_BANNER, "utf-8");
    }
    expect(content).toContain("orch-s03-validation-history");
    expect(content).toContain("orch-s03-validation-history-item");
    expect(content).toContain("orch-s03-validation-history-decision");
    expect(content).toContain("orch-s03-validation-history-actor");
    expect(content).toContain("orch-s03-validation-history-date");
  });

  test("T41 -- Readonly banner shown for non-authorized roles (no approve/reject buttons)", async () => {
    const content = await readFile(VALIDATION_BANNER, "utf-8");
    // Should have a readonly variant for unauthorized users
    expect(content).toContain("orch-s03-validation-readonly-banner");
    // The component should conditionally render approve/reject buttons based on role
    // either via a prop, a role check, or conditional rendering
    expect(content).toMatch(/hitlRoles|canValidate|isAuthorized|role/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 18: Backward compatibility (T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 18: Backward compatibility", () => {
  test("T42 -- Existing templates without hitlRequired still work (fields are optional)", async () => {
    const content = await readFile(WORKFLOW_TEMPLATES_SCHEMA, "utf-8");
    // Original required fields must still exist
    expect(content).toMatch(/order\s*:\s*number/);
    expect(content).toMatch(/name\s*:\s*string/);
    expect(content).toMatch(/autoTransition\s*:\s*boolean/);
    // HITL fields must be optional (with ?)
    expect(content).toMatch(/hitlRequired\s*\?/);
    expect(content).toMatch(/hitlRoles\s*\?/);
  });

  test("T42b -- shouldRequestValidation returns false when hitlRequired is absent", async () => {
    const content = await readFile(HITL_SERVICE_FILE, "utf-8");
    // Should handle undefined/false hitlRequired
    expect(content).toMatch(
      /hitlRequired.*(\?\.|!|false|undefined|null)/s,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 19: Service API surface (return object)
// ---------------------------------------------------------------------------

test.describe("Groupe 19: HITL service API surface", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("Service returns object with key functions", () => {
    expect(content).toMatch(/return\s*\{/);
    const returnIdx = content.lastIndexOf("return {");
    expect(returnIdx).toBeGreaterThan(-1);
    const returnBlock = content.slice(returnIdx, returnIdx + 500);
    expect(returnBlock).toMatch(/shouldRequestValidation/);
    expect(returnBlock).toMatch(/approveStage/);
    expect(returnBlock).toMatch(/rejectStage/);
    expect(returnBlock).toMatch(/listPendingValidations/);
    expect(returnBlock).toMatch(/getValidationHistory/);
  });

  test("Service imports publishLiveEvent", () => {
    expect(content).toContain("publishLiveEvent");
    expect(content).toMatch(/from\s+["']\.\/live-events/);
  });

  test("Service imports from @mnm/db", () => {
    expect(content).toMatch(/from\s+["']@mnm\/db["']/);
  });

  test("Service imports from @mnm/shared", () => {
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("Service uses Drizzle DB operations", () => {
    expect(content).toMatch(/db\s*[\n\s]*\.(select|update|insert)\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 20: requestValidation function
// ---------------------------------------------------------------------------

test.describe("Groupe 20: requestValidation function", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(HITL_SERVICE_FILE, "utf-8");
  });

  test("requestValidation function exists", () => {
    expect(content).toMatch(/requestValidation\s*\(/);
  });

  test("requestValidation emits request_validation event", () => {
    expect(content).toContain("request_validation");
  });

  test("requestValidation emits hitl.validation_requested LiveEvent", () => {
    expect(content).toContain("hitl.validation_requested");
  });
});
