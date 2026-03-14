/**
 * DUAL-S03 — Cursor Enforcement: Orchestrator Integration
 *
 * File-content-based E2E tests verifying:
 * - Cursor enforcement service factory export and public API
 * - Agent-only guard logic (user/system bypass)
 * - Manual position blocking, assisted HITL redirect, auto allow
 * - Audit event emission and LiveEvent publishing
 * - Orchestrator integration (import, call position, error handling)
 * - Shared types (CursorEnforcementResult)
 * - Barrel exports for services and types
 * - Regression: ORCH-S01, ORCH-S02, ORCH-S03, ORCH-S04, DUAL-S01
 *
 * 45 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const CURSOR_ENFORCE_FILE = resolve(ROOT, "server/src/services/cursor-enforcement.ts");
const ORCHESTRATOR_FILE = resolve(ROOT, "server/src/services/orchestrator.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/automation-cursor.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const CURSOR_SVC_FILE = resolve(ROOT, "server/src/services/automation-cursors.ts");

// ============================================================
// Cursor Enforcement Service: cursor-enforcement.ts (T01–T20)
// ============================================================

test.describe("DUAL-S03 — Cursor Enforcement Service", () => {
  // T01 — Service factory export
  test("T01 — exports cursorEnforcementService function", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+cursorEnforcementService\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T02 — enforceCursor async function exists
  test("T02 — enforceCursor async function exists", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+enforceCursor\s*\(/);
  });

  // T03 — imports automationCursorService
  test("T03 — imports automationCursorService", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*automationCursorService[^}]*\}\s*from\s*["']\.\/automation-cursors/);
  });

  // T04 — imports stageInstances from @mnm/db
  test("T04 — imports stageInstances from @mnm/db", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*stageInstances[^}]*\}\s*from\s*["']@mnm\/db["']/);
  });

  // T05 — imports workflowInstances from @mnm/db
  test("T05 — imports workflowInstances from @mnm/db", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*workflowInstances[^}]*\}\s*from\s*["']@mnm\/db["']/);
  });

  // T06 — calls resolveEffective with companyId
  test("T06 — calls resolveEffective with companyId", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain("resolveEffective");
    expect(src).toMatch(/resolveEffective\s*\(\s*\n?\s*stage\.companyId/);
  });

  // T07 — checks actorType === "agent" guard
  test("T07 — checks actorType agent guard", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain('actor.actorType !== "agent"');
  });

  // T08 — returns allowed:true for non-agent actors
  test("T08 — returns allowed:true for non-agent actors", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    // The guard block returns allowed:true when actorType !== "agent"
    const guardBlock = src.indexOf('actor.actorType !== "agent"');
    const returnAfterGuard = src.indexOf("allowed: true", guardBlock);
    expect(returnAfterGuard).toBeGreaterThan(guardBlock);
  });

  // T09 — returns allowed:false for manual position
  test("T09 — returns allowed:false + reason for manual position", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain('position === "manual"');
    // After manual check, there should be allowed: false
    const manualIdx = src.indexOf('position === "manual"');
    const falseAfterManual = src.indexOf("allowed: false", manualIdx);
    expect(falseAfterManual).toBeGreaterThan(manualIdx);
  });

  // T10 — returns redirectToHitl:true for assisted position
  test("T10 — returns redirectToHitl:true for assisted position", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain('position === "assisted"');
    const assistedIdx = src.indexOf('position === "assisted"');
    const redirectAfterAssisted = src.indexOf("redirectToHitl: true", assistedIdx);
    expect(redirectAfterAssisted).toBeGreaterThan(assistedIdx);
  });

  // T11 — returns allowed:true for auto position
  test("T11 — returns allowed:true for auto position", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    // After manual and assisted checks, there's a final return with allowed: true
    // which covers the auto case
    const autoComment = src.indexOf("dual-s03-auto-allow");
    // There are two occurrences: one for non-agent, one for auto. Find the last one.
    const lastAutoComment = src.lastIndexOf("dual-s03-auto-allow");
    const allowedAfterAuto = src.indexOf("allowed: true", lastAutoComment);
    expect(allowedAfterAuto).toBeGreaterThan(lastAutoComment);
  });

  // T12 — emits cursor_enforcement.blocked LiveEvent
  test("T12 — emits cursor_enforcement.blocked LiveEvent", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain('"cursor_enforcement.blocked"');
    expect(src).toContain("publishLiveEvent");
  });

  // T13 — emits cursor_enforcement.hitl_required LiveEvent
  test("T13 — emits cursor_enforcement.hitl_required LiveEvent", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain('"cursor_enforcement.hitl_required"');
  });

  // T14 — calls auditService.emit for blocked transitions
  test("T14 — calls audit.emit for cursor enforcement events", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain("audit.emit");
    expect(src).toContain('"cursor_enforcement.blocked"');
    expect(src).toContain('"cursor_enforcement.hitl_required"');
  });

  // T15 — loads stage from DB using stageInstances
  test("T15 — loads stage from DB using stageInstances", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/\.from\s*\(\s*stageInstances\s*\)/);
  });

  // T16 — loads workflow from DB for projectId
  test("T16 — loads workflow from DB for projectId", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toMatch(/\.from\s*\(\s*workflowInstances\s*\)/);
    expect(src).toContain("workflow?.projectId");
  });

  // T17 — passes agentId from stage to resolveEffective
  test("T17 — passes agentId from stage to resolveEffective", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain("stage.agentId");
    expect(src).toMatch(/agentId[,\s]/);
  });

  // T18 — passes projectId from workflow to resolveEffective
  test("T18 — passes projectId from workflow to resolveEffective", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain("workflow?.projectId");
    expect(src).toMatch(/projectId[,\s]/);
  });

  // T19 — returns effectiveCursor in result
  test("T19 — returns effectiveCursor in result", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    // effectiveCursor should appear in return objects
    const matches = src.match(/effectiveCursor/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3); // type import + return objects
  });

  // T20 — handles missing stage (returns allowed:true)
  test("T20 — handles missing stage returns allowed true", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    expect(src).toContain("!stage");
    // After the !stage check, it should return allowed: true
    const missingIdx = src.indexOf("!stage");
    const allowedIdx = src.indexOf("allowed: true", missingIdx);
    expect(allowedIdx).toBeGreaterThan(missingIdx);
  });
});

// ============================================================
// Orchestrator Integration: orchestrator.ts (T21–T28)
// ============================================================

test.describe("DUAL-S03 — Orchestrator Integration", () => {
  // T21 — imports cursorEnforcementService
  test("T21 — imports cursorEnforcementService", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*cursorEnforcementService[^}]*\}\s*from\s*["']\.\/cursor-enforcement/);
  });

  // T22 — calls enforceCursor in transitionStage
  test("T22 — calls enforceCursor in transitionStage", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain("cursorEnforce.enforceCursor");
  });

  // T23 — enforceCursor call is AFTER enforcement check
  test("T23 — enforceCursor call is AFTER enforcement check", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    const enforcementIdx = src.indexOf("enforcer.enforceTransition");
    const cursorIdx = src.indexOf("cursorEnforce.enforceCursor");
    expect(enforcementIdx).toBeGreaterThan(-1);
    expect(cursorIdx).toBeGreaterThan(-1);
    expect(cursorIdx).toBeGreaterThan(enforcementIdx);
  });

  // T24 — enforceCursor call is BEFORE HITL interception
  test("T24 — enforceCursor call is BEFORE HITL interception", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    const cursorIdx = src.indexOf("cursorEnforce.enforceCursor");
    const hitlIdx = src.indexOf("hitl.shouldRequestValidation");
    expect(cursorIdx).toBeGreaterThan(-1);
    expect(hitlIdx).toBeGreaterThan(-1);
    expect(hitlIdx).toBeGreaterThan(cursorIdx);
  });

  // T25 — handles CursorEnforcementResult.allowed === false
  test("T25 — handles cursorResult allowed false", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain("!cursorResult.allowed");
    expect(src).toContain("CURSOR_ENFORCEMENT_BLOCKED");
  });

  // T26 — handles redirectToHitl by flagging cursorRequiresHitl
  test("T26 — handles redirectToHitl by setting cursorRequiresHitl", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain("cursorResult.redirectToHitl");
    expect(src).toContain("cursorRequiresHitl = true");
  });

  // T27 — throws conflict with CURSOR_ENFORCEMENT_BLOCKED
  test("T27 — throws conflict with CURSOR_ENFORCEMENT_BLOCKED error code", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain('error: "CURSOR_ENFORCEMENT_BLOCKED"');
  });

  // T28 — only enforces cursor for agent actors
  test("T28 — only enforces cursor for agent actors", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    // The cursor enforcement block is wrapped in actorType === "agent" check
    expect(src).toContain('actor.actorType === "agent"');
    const agentCheck = src.indexOf('actor.actorType === "agent"');
    const cursorCall = src.indexOf("cursorEnforce.enforceCursor", agentCheck);
    expect(cursorCall).toBeGreaterThan(agentCheck);
  });
});

// ============================================================
// Shared Types: automation-cursor.ts (T29–T34)
// ============================================================

test.describe("DUAL-S03 — CursorEnforcementResult Type", () => {
  // T29 — CursorEnforcementResult interface exists
  test("T29 — CursorEnforcementResult interface exists", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+CursorEnforcementResult/);
  });

  // T30 — CursorEnforcementResult has allowed: boolean
  test("T30 — CursorEnforcementResult has allowed boolean", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const ifaceIdx = src.indexOf("interface CursorEnforcementResult");
    const closeBrace = src.indexOf("}", ifaceIdx);
    const ifaceBody = src.slice(ifaceIdx, closeBrace);
    expect(ifaceBody).toContain("allowed: boolean");
  });

  // T31 — CursorEnforcementResult has position field
  test("T31 — CursorEnforcementResult has position field", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const ifaceIdx = src.indexOf("interface CursorEnforcementResult");
    const closeBrace = src.indexOf("}", ifaceIdx);
    const ifaceBody = src.slice(ifaceIdx, closeBrace);
    expect(ifaceBody).toContain("position: AutomationCursorPosition");
  });

  // T32 — CursorEnforcementResult has reason optional
  test("T32 — CursorEnforcementResult has reason optional", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const ifaceIdx = src.indexOf("interface CursorEnforcementResult");
    const closeBrace = src.indexOf("}", ifaceIdx);
    const ifaceBody = src.slice(ifaceIdx, closeBrace);
    expect(ifaceBody).toContain("reason?: string");
  });

  // T33 — CursorEnforcementResult has redirectToHitl optional
  test("T33 — CursorEnforcementResult has redirectToHitl optional", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const ifaceIdx = src.indexOf("interface CursorEnforcementResult");
    const closeBrace = src.indexOf("}", ifaceIdx);
    const ifaceBody = src.slice(ifaceIdx, closeBrace);
    expect(ifaceBody).toContain("redirectToHitl?: boolean");
  });

  // T34 — CursorEnforcementResult has effectiveCursor field
  test("T34 — CursorEnforcementResult has effectiveCursor field", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const ifaceIdx = src.indexOf("interface CursorEnforcementResult");
    const closeBrace = src.indexOf("}", ifaceIdx);
    const ifaceBody = src.slice(ifaceIdx, closeBrace);
    expect(ifaceBody).toContain("effectiveCursor: EffectiveCursor");
  });
});

// ============================================================
// Barrel Exports (T35–T37)
// ============================================================

test.describe("DUAL-S03 — Barrel Exports", () => {
  // T35 — services/index.ts exports cursorEnforcementService
  test("T35 — services/index.ts exports cursorEnforcementService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*cursorEnforcementService[^}]*\}\s*from\s*["']\.\/cursor-enforcement/);
  });

  // T36 — types/index.ts re-exports CursorEnforcementResult
  test("T36 — types/index.ts re-exports CursorEnforcementResult", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("CursorEnforcementResult");
  });

  // T37 — shared/src/index.ts re-exports CursorEnforcementResult
  test("T37 — shared/src/index.ts re-exports CursorEnforcementResult", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("CursorEnforcementResult");
  });
});

// ============================================================
// Additional Service Tests (T38–T39)
// ============================================================

test.describe("DUAL-S03 — Additional Service Logic", () => {
  // T38 — default position is "assisted" when no cursors found
  test("T38 — default position is assisted when no cursors found", async () => {
    const src = await readFile(CURSOR_SVC_FILE, "utf-8");
    // The resolveEffective function returns "assisted" as default
    expect(src).toContain('position: "assisted"');
    expect(src).toContain('ceiling: "auto"');
  });

  // T39 — system actor bypasses cursor enforcement
  test("T39 — system actor bypasses cursor enforcement", async () => {
    const src = await readFile(CURSOR_ENFORCE_FILE, "utf-8");
    // The guard checks for !== "agent", so system actors fall through
    // and get allowed: true immediately
    expect(src).toContain('actor.actorType !== "agent"');
    // Verify the guard returns early with allowed: true
    const guardIdx = src.indexOf('actor.actorType !== "agent"');
    const returnIdx = src.indexOf("return {", guardIdx);
    const allowedIdx = src.indexOf("allowed: true", returnIdx);
    expect(allowedIdx).toBeGreaterThan(guardIdx);
    expect(allowedIdx - guardIdx).toBeLessThan(300); // within the guard block
  });
});

// ============================================================
// Regression Tests (T40–T45)
// ============================================================

test.describe("DUAL-S03 — Regression Tests", () => {
  // T40 — ORCH-S01 transitionStage function still exists
  test("T40 — ORCH-S01 transitionStage function still exists", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+transitionStage\s*\(/);
  });

  // T41 — ORCH-S02 enforceTransition call still present
  test("T41 — ORCH-S02 enforceTransition call still present", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain("enforcer.enforceTransition");
    expect(src).toContain("ENFORCEMENT_FAILED");
  });

  // T42 — ORCH-S03 HITL interception still present
  test("T42 — ORCH-S03 HITL interception still present", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain("hitl.shouldRequestValidation");
    expect(src).toContain("hitl.requestValidation");
    expect(src).toContain('effectiveEvent = "request_validation"');
  });

  // T43 — ORCH-S04 routes still functional (import pattern)
  test("T43 — ORCH-S04 orchestrator export pattern intact", async () => {
    const src = await readFile(ORCHESTRATOR_FILE, "utf-8");
    expect(src).toContain("transitionStage,");
    expect(src).toContain("getStageWithState,");
    expect(src).toContain("getWorkflowWithState,");
    expect(src).toContain("listWorkflowsByState,");
    expect(src).toContain("listStagesByState,");
  });

  // T44 — DUAL-S01 resolveEffective function exists
  test("T44 — DUAL-S01 resolveEffective function exists", async () => {
    const src = await readFile(CURSOR_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+resolveEffective\s*\(/);
  });

  // T45 — DUAL-S01 setCursor function exists
  test("T45 — DUAL-S01 setCursor function exists", async () => {
    const src = await readFile(CURSOR_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+setCursor\s*\(/);
  });
});
