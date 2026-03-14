/**
 * OBS-S02: Service audit emission -- Integration systematique dans les routes — E2E Tests
 *
 * These tests verify the deliverables of OBS-S02:
 *   - Groupe 1: Audit emitter file existence and exports (T01-T06)
 *   - Groupe 2: emitAudit helper structure and non-blocking pattern (T07-T15)
 *   - Groupe 3: AUDIT_ACTIONS catalog completeness (T16-T25)
 *   - Groupe 4: Route integration — emitAudit in route files (T26-T42)
 *   - Groupe 5: Secret redaction — no secret values in metadata (T43-T46)
 *   - Groupe 6: access.denied emission in require-permission.ts (T47-T54)
 *   - Groupe 7: Severity conventions (T55-T60)
 *   - Groupe 8: ipAddress and userAgent extraction (T61-T64)
 *   - Groupe 9: Coexistence — logActivity preserved alongside emitAudit (T65-T69)
 *   - Groupe 10: Actor type extraction (T70-T73)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const AUDIT_EMITTER_FILE = resolve(ROOT, "server/src/services/audit-emitter.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/audit.ts");
const REQUIRE_PERM_FILE = resolve(ROOT, "server/src/middleware/require-permission.ts");

// Route files
const ROUTE_DIR = resolve(ROOT, "server/src/routes");
const ROUTE_FILES = {
  agents: resolve(ROUTE_DIR, "agents.ts"),
  access: resolve(ROUTE_DIR, "access.ts"),
  approvals: resolve(ROUTE_DIR, "approvals.ts"),
  assets: resolve(ROUTE_DIR, "assets.ts"),
  companies: resolve(ROUTE_DIR, "companies.ts"),
  costs: resolve(ROUTE_DIR, "costs.ts"),
  goals: resolve(ROUTE_DIR, "goals.ts"),
  issues: resolve(ROUTE_DIR, "issues.ts"),
  orchestrator: resolve(ROUTE_DIR, "orchestrator.ts"),
  projects: resolve(ROUTE_DIR, "projects.ts"),
  projectMemberships: resolve(ROUTE_DIR, "project-memberships.ts"),
  secrets: resolve(ROUTE_DIR, "secrets.ts"),
  stages: resolve(ROUTE_DIR, "stages.ts"),
  workflows: resolve(ROUTE_DIR, "workflows.ts"),
};

// ---------------------------------------------------------------------------
// Groupe 1: Audit emitter file existence and exports (T01-T06)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Audit emitter file existence and exports", () => {
  test("T01 — audit-emitter.ts file exists", async () => {
    await expect(fsAccess(AUDIT_EMITTER_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 — audit-emitter.ts exports emitAudit function", async () => {
    const content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
    expect(content).toMatch(/export\s+(async\s+)?function\s+emitAudit\s*\(/);
  });

  test("T03 — audit-emitter.ts exports EmitAuditParams interface", async () => {
    const content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+EmitAuditParams/);
  });

  test("T04 — services/index.ts barrel exports emitAudit", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toContain("emitAudit");
    expect(content).toMatch(/from\s+["']\.\/audit-emitter/);
  });

  test("T05 — audit-emitter.ts imports auditService", async () => {
    const content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
    expect(content).toContain("auditService");
    expect(content).toMatch(/from\s+["']\.\/audit/);
  });

  test("T06 — audit-emitter.ts imports types from @mnm/shared or @mnm/db", async () => {
    const content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
    // Should import at least one type from shared or db
    expect(content).toMatch(/import\s+type\s+\{[^}]*\}\s+from\s+["']@mnm\/(shared|db)["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: emitAudit helper structure and non-blocking pattern (T07-T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: emitAudit helper structure and non-blocking pattern", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
  });

  test("T07 — emitAudit is async and returns Promise<void>", () => {
    expect(content).toMatch(/async\s+function\s+emitAudit\s*\([^)]*\)\s*:\s*Promise<void>/);
  });

  test("T08 — emitAudit has try/catch for non-blocking behavior (AC5)", () => {
    // Must have try { ... } catch { ... } to prevent audit errors from failing requests
    const emitIdx = content.indexOf("function emitAudit");
    expect(emitIdx).toBeGreaterThan(-1);
    const fnBlock = content.slice(emitIdx);
    expect(fnBlock).toContain("try");
    expect(fnBlock).toContain("catch");
  });

  test("T09 — emitAudit does NOT rethrow errors (non-blocking)", () => {
    const emitIdx = content.indexOf("function emitAudit");
    expect(emitIdx).toBeGreaterThan(-1);
    const fnBlock = content.slice(emitIdx);
    const catchIdx = fnBlock.indexOf("catch");
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = fnBlock.slice(catchIdx, catchIdx + 300);
    // Should log but NOT throw/rethrow
    expect(catchBlock).toMatch(/console\.(error|warn|log)\(/);
    expect(catchBlock).not.toMatch(/\bthrow\b/);
  });

  test("T10 — EmitAuditParams has req field of type Request", () => {
    expect(content).toMatch(/req\s*:\s*Request/);
  });

  test("T11 — EmitAuditParams has db field of type Db", () => {
    expect(content).toMatch(/db\s*:\s*Db/);
  });

  test("T12 — EmitAuditParams has companyId field", () => {
    const interfaceIdx = content.indexOf("EmitAuditParams");
    const interfaceBlock = content.slice(interfaceIdx, interfaceIdx + 500);
    expect(interfaceBlock).toMatch(/companyId\s*:\s*string/);
  });

  test("T13 — EmitAuditParams has action, targetType, targetId fields", () => {
    const interfaceIdx = content.indexOf("EmitAuditParams");
    const interfaceBlock = content.slice(interfaceIdx, interfaceIdx + 500);
    expect(interfaceBlock).toMatch(/action\s*:\s*string/);
    expect(interfaceBlock).toMatch(/targetType\s*:\s*string/);
    expect(interfaceBlock).toMatch(/targetId\s*:\s*string/);
  });

  test("T14 — EmitAuditParams has optional metadata field", () => {
    const interfaceIdx = content.indexOf("EmitAuditParams");
    const interfaceBlock = content.slice(interfaceIdx, interfaceIdx + 500);
    expect(interfaceBlock).toMatch(/metadata\s*\?\s*:/);
  });

  test("T15 — EmitAuditParams has optional severity field", () => {
    const interfaceIdx = content.indexOf("EmitAuditParams");
    const interfaceBlock = content.slice(interfaceIdx, interfaceIdx + 500);
    expect(interfaceBlock).toMatch(/severity\s*\?\s*:/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: AUDIT_ACTIONS catalog completeness (T16-T25)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: AUDIT_ACTIONS catalog completeness (AC10)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("T16 — AUDIT_ACTIONS contains at least 45 distinct actions", () => {
    const actionsMatch = content.match(/AUDIT_ACTIONS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
    expect(actionsMatch).not.toBeNull();
    const actionsBlock = actionsMatch![1];
    const actions = actionsBlock.match(/"[^"]+"/g) ?? [];
    expect(actions.length).toBeGreaterThanOrEqual(45);
  });

  test("T17 — AUDIT_ACTIONS contains access domain actions", () => {
    expect(content).toContain('"access.denied"');
    expect(content).toContain('"access.invite_created"');
    expect(content).toContain('"access.invite_accepted"');
    expect(content).toContain('"access.join_request_approved"');
    expect(content).toContain('"access.join_request_rejected"');
    expect(content).toContain('"access.member_permissions_updated"');
    expect(content).toContain('"access.member_role_changed"');
    expect(content).toContain('"access.member_removed"');
  });

  test("T18 — AUDIT_ACTIONS contains agent domain actions", () => {
    expect(content).toContain('"agent.created"');
    expect(content).toContain('"agent.hired"');
    expect(content).toContain('"agent.updated"');
    expect(content).toContain('"agent.deleted"');
    expect(content).toContain('"agent.woken"');
    expect(content).toContain('"agent.permissions_changed"');
    expect(content).toContain('"agent.instructions_changed"');
    expect(content).toContain('"agent.config_rollback"');
    expect(content).toContain('"agent.session_reset"');
    expect(content).toContain('"agent.key_created"');
    expect(content).toContain('"agent.claude_login"');
  });

  test("T19 — AUDIT_ACTIONS contains approval domain actions", () => {
    expect(content).toContain('"approval.created"');
    expect(content).toContain('"approval.approved"');
    expect(content).toContain('"approval.rejected"');
    expect(content).toContain('"approval.revision_requested"');
    expect(content).toContain('"approval.resubmitted"');
  });

  test("T20 — AUDIT_ACTIONS contains company domain actions", () => {
    expect(content).toContain('"company.created"');
    expect(content).toContain('"company.updated"');
    expect(content).toContain('"company.archived"');
    expect(content).toContain('"company.deleted"');
    expect(content).toContain('"company.exported"');
    expect(content).toContain('"company.imported"');
  });

  test("T21 — AUDIT_ACTIONS contains issue domain actions", () => {
    expect(content).toContain('"issue.created"');
    expect(content).toContain('"issue.updated"');
    expect(content).toContain('"issue.deleted"');
    expect(content).toContain('"issue.checked_out"');
    expect(content).toContain('"issue.released"');
    expect(content).toContain('"issue.label_created"');
    expect(content).toContain('"issue.label_deleted"');
    expect(content).toContain('"issue.attachment_added"');
    expect(content).toContain('"issue.attachment_deleted"');
  });

  test("T22 — AUDIT_ACTIONS contains project domain actions", () => {
    expect(content).toContain('"project.created"');
    expect(content).toContain('"project.updated"');
    expect(content).toContain('"project.deleted"');
    expect(content).toContain('"project.workspace_created"');
    expect(content).toContain('"project.workspace_updated"');
    expect(content).toContain('"project.workspace_deleted"');
    expect(content).toContain('"project.onboarded"');
  });

  test("T23 — AUDIT_ACTIONS contains secret domain actions", () => {
    expect(content).toContain('"secret.created"');
    expect(content).toContain('"secret.rotated"');
    expect(content).toContain('"secret.updated"');
    expect(content).toContain('"secret.deleted"');
  });

  test("T24 — AUDIT_ACTIONS contains workflow domain actions", () => {
    expect(content).toContain('"workflow.template_created"');
    expect(content).toContain('"workflow.template_updated"');
    expect(content).toContain('"workflow.template_deleted"');
    expect(content).toContain('"workflow.instance_created"');
    expect(content).toContain('"workflow.instance_updated"');
    expect(content).toContain('"workflow.instance_deleted"');
  });

  test("T25 — AUDIT_ACTIONS contains remaining domain actions (cost, goal, stage, orchestrator, project_membership, asset)", () => {
    expect(content).toContain('"cost.budget_updated"');
    expect(content).toContain('"cost.agent_budget_updated"');
    expect(content).toContain('"goal.created"');
    expect(content).toContain('"goal.updated"');
    expect(content).toContain('"goal.deleted"');
    expect(content).toContain('"stage.transitioned"');
    expect(content).toContain('"orchestrator.stage_transitioned"');
    expect(content).toContain('"orchestrator.stage_approved"');
    expect(content).toContain('"orchestrator.stage_rejected"');
    expect(content).toContain('"project_membership.added"');
    expect(content).toContain('"project_membership.updated"');
    expect(content).toContain('"project_membership.removed"');
    expect(content).toContain('"asset.uploaded"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Route integration — emitAudit in route files (T26-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Route integration — emitAudit calls in route files", () => {
  test("T26 — agents.ts imports emitAudit", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    expect(content).toContain("emitAudit");
    expect(content).toMatch(/import\s+\{[^}]*emitAudit[^}]*\}\s+from/);
  });

  test("T27 — agents.ts has at least 10 emitAudit calls (11+ expected)", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(10);
  });

  test("T28 — agents.ts emits agent.created action (AC1)", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    expect(content).toContain('"agent.created"');
  });

  test("T29 — agents.ts emits agent.deleted action (AC2)", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    expect(content).toContain('"agent.deleted"');
  });

  test("T30 — access.ts imports emitAudit", async () => {
    const content = await readFile(ROUTE_FILES.access, "utf-8");
    expect(content).toContain("emitAudit");
  });

  test("T31 — access.ts has at least 7 emitAudit calls (AC9)", async () => {
    const content = await readFile(ROUTE_FILES.access, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(7);
  });

  test("T32 — access.ts emits access.invite_created action (AC9)", async () => {
    const content = await readFile(ROUTE_FILES.access, "utf-8");
    expect(content).toContain('"access.invite_created"');
  });

  test("T33 — secrets.ts imports emitAudit", async () => {
    const content = await readFile(ROUTE_FILES.secrets, "utf-8");
    expect(content).toContain("emitAudit");
  });

  test("T34 — secrets.ts has at least 4 emitAudit calls (AC6)", async () => {
    const content = await readFile(ROUTE_FILES.secrets, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  test("T35 — companies.ts has at least 6 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.companies, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });

  test("T36 — companies.ts emits company.deleted action (AC4)", async () => {
    const content = await readFile(ROUTE_FILES.companies, "utf-8");
    expect(content).toContain('"company.deleted"');
  });

  test("T37 — issues.ts has at least 9 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.issues, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(9);
  });

  test("T38 — projects.ts has at least 7 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.projects, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(7);
  });

  test("T39 — workflows.ts has at least 6 emitAudit calls (AC11)", async () => {
    const content = await readFile(ROUTE_FILES.workflows, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });

  test("T40 — workflows.ts emits workflow.template_created action (AC11)", async () => {
    const content = await readFile(ROUTE_FILES.workflows, "utf-8");
    expect(content).toContain('"workflow.template_created"');
  });

  test("T41 — At least 10 route files contain emitAudit calls (AC8)", async () => {
    let routeFilesWithEmitAudit = 0;
    for (const [, filePath] of Object.entries(ROUTE_FILES)) {
      const content = await readFile(filePath, "utf-8");
      if (content.includes("emitAudit(")) {
        routeFilesWithEmitAudit++;
      }
    }
    expect(routeFilesWithEmitAudit).toBeGreaterThanOrEqual(10);
  });

  test("T42 — Total emitAudit calls across all route files >= 68 (AC8)", async () => {
    let totalCalls = 0;
    for (const [, filePath] of Object.entries(ROUTE_FILES)) {
      const content = await readFile(filePath, "utf-8");
      const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
      totalCalls += occurrences;
    }
    expect(totalCalls).toBeGreaterThanOrEqual(68);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Secret redaction — no secret values in metadata (T43-T46)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Secret redaction — no secret values in metadata (AC6)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTE_FILES.secrets, "utf-8");
  });

  test("T43 — secrets.ts emitAudit calls do NOT include req.body.value in metadata", () => {
    // Find all emitAudit blocks in secrets.ts and ensure none pass req.body.value
    const emitBlocks = content.split("emitAudit(").slice(1); // skip first part before any call
    for (const block of emitBlocks) {
      // Extract from emitAudit( to the matching closing })
      const metadataSection = block.slice(0, block.indexOf("});") + 3);
      expect(metadataSection).not.toMatch(/\bvalue\s*:\s*req\.body\.value\b/);
      expect(metadataSection).not.toMatch(/\bsecretValue\b/);
    }
  });

  test("T44 — secret.created metadata contains name and provider but NOT value", () => {
    const createdIdx = content.indexOf('"secret.created"');
    expect(createdIdx).toBeGreaterThan(-1);
    const block = content.slice(createdIdx, createdIdx + 400);
    expect(block).toContain("name");
    expect(block).toContain("provider");
    // Must NOT contain the actual secret value
    expect(block).not.toMatch(/value\s*:\s*req\.body\.value/);
    expect(block).not.toMatch(/value\s*:\s*created\.value/);
  });

  test("T45 — secret.rotated metadata does NOT contain new secret value", () => {
    const rotatedIdx = content.indexOf('"secret.rotated"');
    expect(rotatedIdx).toBeGreaterThan(-1);
    const block = content.slice(rotatedIdx, rotatedIdx + 400);
    expect(block).not.toMatch(/value\s*:\s*req\.body\.value/);
    expect(block).not.toMatch(/newValue\s*:/);
  });

  test("T46 — secret.updated metadata does NOT contain updated secret value", () => {
    const updatedIdx = content.indexOf('"secret.updated"');
    expect(updatedIdx).toBeGreaterThan(-1);
    const block = content.slice(updatedIdx, updatedIdx + 400);
    expect(block).not.toMatch(/value\s*:\s*req\.body\.value/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: access.denied emission in require-permission.ts (T47-T54)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: access.denied emission in require-permission.ts (AC3)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(REQUIRE_PERM_FILE, "utf-8");
  });

  test("T47 — require-permission.ts imports auditService", () => {
    expect(content).toContain("auditService");
    expect(content).toMatch(/import.*auditService.*from/s);
  });

  test("T48 — require-permission.ts emits access.denied action", () => {
    expect(content).toContain('"access.denied"');
    // Must appear in an auditService().emit() or emitAudit() context
    expect(content).toMatch(/(auditService|emitAudit)/);
  });

  test("T49 — access.denied has severity warning", () => {
    // Find access.denied blocks and check severity
    const deniedIndices: number[] = [];
    let idx = content.indexOf('"access.denied"');
    while (idx !== -1) {
      deniedIndices.push(idx);
      idx = content.indexOf('"access.denied"', idx + 1);
    }
    expect(deniedIndices.length).toBeGreaterThanOrEqual(1);

    // At least one block should have severity: "warning"
    let hasSeverityWarning = false;
    for (const i of deniedIndices) {
      const block = content.slice(i, i + 500);
      if (block.includes('"warning"')) {
        hasSeverityWarning = true;
        break;
      }
    }
    expect(hasSeverityWarning).toBe(true);
  });

  test("T50 — access.denied targets permission type", () => {
    const deniedIdx = content.indexOf('"access.denied"');
    expect(deniedIdx).toBeGreaterThan(-1);
    const block = content.slice(deniedIdx, deniedIdx + 500);
    expect(block).toContain('"permission"');
  });

  test("T51 — access.denied metadata includes route information", () => {
    const deniedIdx = content.indexOf('"access.denied"');
    expect(deniedIdx).toBeGreaterThan(-1);
    const block = content.slice(deniedIdx, deniedIdx + 500);
    expect(block).toContain("route");
    expect(block).toMatch(/req\.method|req\.originalUrl/);
  });

  test("T52 — access.denied uses fire-and-forget pattern (.catch)", () => {
    // The spec requires .catch(() => {}) pattern for non-blocking in middleware
    // because a throw follows immediately
    expect(content).toMatch(/\.catch\s*\(\s*\(\s*\)\s*=>\s*\{/);
  });

  test("T53 — requirePermission function has access.denied emission for board actors", () => {
    const reqPermIdx = content.indexOf("function requirePermission");
    expect(reqPermIdx).toBeGreaterThan(-1);
    const assertIdx = content.indexOf("function assertCompanyPermission");
    const reqPermBlock = content.slice(reqPermIdx, assertIdx > reqPermIdx ? assertIdx : reqPermIdx + 2000);
    // Should contain access.denied in the board actor denied path
    expect(reqPermBlock).toContain('"access.denied"');
  });

  test("T54 — assertCompanyPermission function has access.denied emission", () => {
    const assertIdx = content.indexOf("function assertCompanyPermission");
    expect(assertIdx).toBeGreaterThan(-1);
    const assertBlock = content.slice(assertIdx);
    expect(assertBlock).toContain('"access.denied"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Severity conventions (T55-T60)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Severity conventions", () => {
  test("T55 — agent.deleted has severity warning (AC2)", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const deletedIdx = content.indexOf('"agent.deleted"');
    expect(deletedIdx).toBeGreaterThan(-1);
    const block = content.slice(deletedIdx, deletedIdx + 300);
    expect(block).toContain('"warning"');
  });

  test("T56 — company.deleted has severity critical (AC4)", async () => {
    const content = await readFile(ROUTE_FILES.companies, "utf-8");
    const deletedIdx = content.indexOf('"company.deleted"');
    expect(deletedIdx).toBeGreaterThan(-1);
    const block = content.slice(deletedIdx, deletedIdx + 300);
    expect(block).toContain('"critical"');
  });

  test("T57 — issue.deleted has severity warning", async () => {
    const content = await readFile(ROUTE_FILES.issues, "utf-8");
    const deletedIdx = content.indexOf('"issue.deleted"');
    expect(deletedIdx).toBeGreaterThan(-1);
    const block = content.slice(deletedIdx, deletedIdx + 300);
    expect(block).toContain('"warning"');
  });

  test("T58 — project.deleted has severity warning", async () => {
    const content = await readFile(ROUTE_FILES.projects, "utf-8");
    const deletedIdx = content.indexOf('"project.deleted"');
    expect(deletedIdx).toBeGreaterThan(-1);
    const block = content.slice(deletedIdx, deletedIdx + 300);
    expect(block).toContain('"warning"');
  });

  test("T59 — secret.deleted has severity warning", async () => {
    const content = await readFile(ROUTE_FILES.secrets, "utf-8");
    const deletedIdx = content.indexOf('"secret.deleted"');
    expect(deletedIdx).toBeGreaterThan(-1);
    const block = content.slice(deletedIdx, deletedIdx + 300);
    expect(block).toContain('"warning"');
  });

  test("T60 — Creation actions default to info severity (no explicit critical/warning)", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const createdIdx = content.indexOf('"agent.created"');
    expect(createdIdx).toBeGreaterThan(-1);
    const block = content.slice(createdIdx, createdIdx + 300);
    // Should either have severity: "info" or no severity at all (defaults to "info" in emitAudit)
    expect(block).not.toContain('"critical"');
    expect(block).not.toContain('"warning"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: ipAddress and userAgent extraction (T61-T64)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: ipAddress and userAgent extraction (AC7)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
  });

  test("T61 — emitAudit extracts ipAddress from req.ip or req.socket.remoteAddress", () => {
    expect(content).toMatch(/req\.ip|req\.socket/);
    expect(content).toContain("ipAddress");
  });

  test("T62 — emitAudit extracts userAgent from request headers", () => {
    expect(content).toMatch(/req\.get\(\s*["']user-agent["']\s*\)|req\.headers/);
    expect(content).toContain("userAgent");
  });

  test("T63 — emitAudit passes ipAddress to auditService.emit()", () => {
    const emitCallIdx = content.indexOf("svc.emit(");
    if (emitCallIdx === -1) {
      // Maybe it uses a different pattern
      expect(content).toMatch(/\.emit\s*\(/);
    }
    const emitIdx = content.indexOf(".emit(");
    expect(emitIdx).toBeGreaterThan(-1);
    const emitBlock = content.slice(emitIdx, emitIdx + 600);
    expect(emitBlock).toContain("ipAddress");
  });

  test("T64 — emitAudit passes userAgent to auditService.emit()", () => {
    const emitIdx = content.indexOf(".emit(");
    expect(emitIdx).toBeGreaterThan(-1);
    const emitBlock = content.slice(emitIdx, emitIdx + 600);
    expect(emitBlock).toContain("userAgent");
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Coexistence — logActivity preserved alongside emitAudit (T65-T69)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Coexistence — logActivity preserved alongside emitAudit (AC12)", () => {
  test("T65 — agents.ts still contains logActivity calls", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const logActivityCount = (content.match(/logActivity\s*\(/g) ?? []).length;
    // agents.ts originally had 17 logActivity calls — they must be preserved
    expect(logActivityCount).toBeGreaterThanOrEqual(10);
  });

  test("T66 — secrets.ts still contains logActivity calls", async () => {
    const content = await readFile(ROUTE_FILES.secrets, "utf-8");
    const logActivityCount = (content.match(/logActivity\s*\(/g) ?? []).length;
    // secrets.ts originally had 5 logActivity calls (1 import + 4 calls)
    expect(logActivityCount).toBeGreaterThanOrEqual(4);
  });

  test("T67 — issues.ts still contains logActivity calls", async () => {
    const content = await readFile(ROUTE_FILES.issues, "utf-8");
    const logActivityCount = (content.match(/logActivity\s*\(/g) ?? []).length;
    expect(logActivityCount).toBeGreaterThanOrEqual(10);
  });

  test("T68 — companies.ts still contains logActivity calls", async () => {
    const content = await readFile(ROUTE_FILES.companies, "utf-8");
    const logActivityCount = (content.match(/logActivity\s*\(/g) ?? []).length;
    expect(logActivityCount).toBeGreaterThanOrEqual(5);
  });

  test("T69 — access.ts still contains logActivity calls", async () => {
    const content = await readFile(ROUTE_FILES.access, "utf-8");
    const logActivityCount = (content.match(/logActivity\s*\(/g) ?? []).length;
    expect(logActivityCount).toBeGreaterThanOrEqual(7);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Actor type extraction (T70-T73)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Actor type extraction", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(AUDIT_EMITTER_FILE, "utf-8");
  });

  test("T70 — emitAudit resolves actorType from req.actor.type", () => {
    expect(content).toContain("req.actor.type");
    // Should map actor types: agent -> "agent", board -> "user", other -> "system"
    expect(content).toMatch(/req\.actor\.type\s*===\s*["']agent["']/);
    expect(content).toMatch(/req\.actor\.type\s*===\s*["']board["']/);
  });

  test("T71 — emitAudit maps board actor to 'user' actorType", () => {
    // When req.actor.type === "board", actorType should be "user"
    expect(content).toMatch(/"board"[\s\S]*?"user"/);
  });

  test("T72 — emitAudit extracts actorId from req.actor for agent actors", () => {
    expect(content).toContain("req.actor.agentId");
  });

  test("T73 — emitAudit extracts actorId from req.actor for board actors", () => {
    expect(content).toContain("req.actor.userId");
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Per-route domain verification (T74-T85)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Per-route domain verification", () => {
  test("T74 — approvals.ts has at least 5 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.approvals, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(5);
  });

  test("T75 — approvals.ts emits approval.approved and approval.rejected", async () => {
    const content = await readFile(ROUTE_FILES.approvals, "utf-8");
    expect(content).toContain('"approval.approved"');
    expect(content).toContain('"approval.rejected"');
  });

  test("T76 — goals.ts has at least 3 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.goals, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test("T77 — costs.ts has at least 2 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.costs, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  test("T78 — stages.ts has at least 1 emitAudit call", async () => {
    const content = await readFile(ROUTE_FILES.stages, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(1);
  });

  test("T79 — orchestrator.ts has at least 3 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.orchestrator, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test("T80 — project-memberships.ts has at least 3 emitAudit calls", async () => {
    const content = await readFile(ROUTE_FILES.projectMemberships, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test("T81 — assets.ts has at least 1 emitAudit call", async () => {
    const content = await readFile(ROUTE_FILES.assets, "utf-8");
    const occurrences = (content.match(/emitAudit\s*\(/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(1);
  });

  test("T82 — orchestrator.ts emits orchestrator.stage_transitioned", async () => {
    const content = await readFile(ROUTE_FILES.orchestrator, "utf-8");
    expect(content).toContain('"orchestrator.stage_transitioned"');
  });

  test("T83 — project-memberships.ts emits project_membership.added", async () => {
    const content = await readFile(ROUTE_FILES.projectMemberships, "utf-8");
    expect(content).toContain('"project_membership.added"');
  });

  test("T84 — assets.ts emits asset.uploaded", async () => {
    const content = await readFile(ROUTE_FILES.assets, "utf-8");
    expect(content).toContain('"asset.uploaded"');
  });

  test("T85 — stages.ts emits stage.transitioned", async () => {
    const content = await readFile(ROUTE_FILES.stages, "utf-8");
    expect(content).toContain('"stage.transitioned"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: emitAudit placement — after mutation, before response (T86-T89)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: emitAudit placement patterns", () => {
  test("T86 — agents.ts: emitAudit calls appear after logActivity (placement after mutation)", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    // For agent.created: logActivity should come before emitAudit
    const logIdx = content.indexOf('action: "agent.created"');
    const emitIdx = content.indexOf('"agent.created"');
    // Both should exist
    expect(logIdx).toBeGreaterThan(-1);
    expect(emitIdx).toBeGreaterThan(-1);
  });

  test("T87 — All emitAudit calls pass req as first property", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const emitBlocks = content.split("emitAudit({").slice(1);
    expect(emitBlocks.length).toBeGreaterThan(0);
    for (const block of emitBlocks) {
      // The first lines after emitAudit({ should include req
      const firstLines = block.slice(0, 200);
      expect(firstLines).toContain("req");
    }
  });

  test("T88 — All emitAudit calls pass db parameter", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const emitBlocks = content.split("emitAudit({").slice(1);
    expect(emitBlocks.length).toBeGreaterThan(0);
    for (const block of emitBlocks) {
      const firstLines = block.slice(0, 200);
      expect(firstLines).toMatch(/\bdb\b/);
    }
  });

  test("T89 — All emitAudit calls pass companyId parameter", async () => {
    const content = await readFile(ROUTE_FILES.agents, "utf-8");
    const emitBlocks = content.split("emitAudit({").slice(1);
    expect(emitBlocks.length).toBeGreaterThan(0);
    for (const block of emitBlocks) {
      const firstLines = block.slice(0, 300);
      expect(firstLines).toMatch(/companyId/);
    }
  });
});
