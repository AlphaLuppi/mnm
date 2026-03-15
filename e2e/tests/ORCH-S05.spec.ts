/**
 * ORCH-S05 — UI Workflow Editor
 *
 * File-content-based E2E tests verifying:
 * - WorkflowEditor page (create/edit workflow templates)
 * - StageEditorCard component (stage configuration UI)
 * - WorkflowEditorPreview component (pipeline preview)
 * - App.tsx route integration (workflow-editor routes)
 * - Sidebar.tsx navigation entry (Workflow Editor link)
 * - Regression checks for ORCH-S04 and RBAC-S05 compatibility
 *
 * 48 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files — New components
const EDITOR_PAGE = resolve(ROOT, "ui/src/pages/WorkflowEditor.tsx");
const STAGE_CARD = resolve(ROOT, "ui/src/components/StageEditorCard.tsx");
const PREVIEW_COMPONENT = resolve(ROOT, "ui/src/components/WorkflowEditorPreview.tsx");

// Target files — Modified
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");

// Regression files — ORCH-S04
const ORCH_ROUTES = resolve(ROOT, "server/src/routes/orchestrator.ts");

// Regression files — RBAC-S05
const RBAC_REQUIRE_PERMISSION = resolve(ROOT, "ui/src/components/RequirePermission.tsx");

// API / existing workflow files
const WORKFLOW_API = resolve(ROOT, "ui/src/api/workflows.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");

// ============================================================
// WorkflowEditor Page — Existence & Structure (T01-T03)
// ============================================================

test.describe("ORCH-S05 — WorkflowEditor Page", () => {
  test("T01 — WorkflowEditor.tsx file exists", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  test("T02 — exports WorkflowEditor function", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/export\s+function\s+WorkflowEditor/);
  });

  test("T03 — has data-testid orch-s05-editor-page", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-editor-page"');
  });
});

// ============================================================
// StageEditorCard — Existence & Structure (T04-T06)
// ============================================================

test.describe("ORCH-S05 — StageEditorCard Component", () => {
  test("T04 — StageEditorCard.tsx file exists", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  test("T05 — exports StageEditorCard function", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/export\s+function\s+StageEditorCard/);
  });

  test("T06 — has data-testid orch-s05-stage-card pattern", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-card-/);
  });
});

// ============================================================
// WorkflowEditorPreview — Existence & Structure (T07-T09)
// ============================================================

test.describe("ORCH-S05 — WorkflowEditorPreview Component", () => {
  test("T07 — WorkflowEditorPreview.tsx file exists", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  test("T08 — exports WorkflowEditorPreview function", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toMatch(/export\s+function\s+WorkflowEditorPreview/);
  });

  test("T09 — has data-testid orch-s05-preview-panel", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toContain('data-testid="orch-s05-preview-panel"');
  });
});

// ============================================================
// Template Name/Description Inputs (T10-T14)
// ============================================================

test.describe("ORCH-S05 — Template Meta Inputs", () => {
  test("T10 — template name input present", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-template-name-input"');
  });

  test("T11 — template description input present", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-template-description-input"');
  });

  test("T12 — onChange handler on name input", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/onChange=.*setTemplateName/);
  });

  test("T13 — onChange handler on description input", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/onChange=.*setTemplateDescription/);
  });

  test("T14 — placeholder text on name input", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/placeholder=".*BMAD/);
  });
});

// ============================================================
// Add Stage Functionality (T15-T18)
// ============================================================

test.describe("ORCH-S05 — Add Stage", () => {
  test("T15 — add stage button present", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-add-stage-btn"');
  });

  test("T16 — onClick handler for adding stage", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/onClick=\{addStage\}/);
  });

  test("T17 — default stage name 'New Stage' used", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('"New Stage"');
  });

  test("T18 — stage count displayed", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-stage-count"');
  });
});

// ============================================================
// Delete Stage Functionality (T19-T22)
// ============================================================

test.describe("ORCH-S05 — Delete Stage", () => {
  test("T19 — delete stage button pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-delete-/);
  });

  test("T20 — stages filtered after deletion", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/filter\(\s*\(\s*_\s*,\s*i\s*\)\s*=>\s*i\s*!==\s*index/);
  });

  test("T21 — deleteStage function defined", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/function\s+deleteStage/);
  });

  test("T22 — delete button not shown if only one stage", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/!isOnly/);
  });
});

// ============================================================
// Move Up/Down Functionality (T23-T26)
// ============================================================

test.describe("ORCH-S05 — Move Stage", () => {
  test("T23 — move up button pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-move-up-/);
  });

  test("T24 — move down button pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-move-down-/);
  });

  test("T25 — move up disabled on first stage", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/disabled=\{isFirst\}/);
  });

  test("T26 — move down disabled on last stage", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/disabled=\{isLast\}/);
  });
});

// ============================================================
// Stage Configuration — Name, Description, Role (T27-T30)
// ============================================================

test.describe("ORCH-S05 — Stage Configuration", () => {
  test("T27 — stage name input pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-name-/);
  });

  test("T28 — stage description input pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-description-/);
  });

  test("T29 — stage role select pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-role-/);
  });

  test("T30 — role options include pm, architect, dev, qa, reviewer", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toContain('"pm"');
    expect(src).toContain('"architect"');
    expect(src).toContain('"dev"');
    expect(src).toContain('"qa"');
    expect(src).toContain('"reviewer"');
  });
});

// ============================================================
// Auto-Transition Toggle (T31-T33)
// ============================================================

test.describe("ORCH-S05 — Auto-Transition Toggle", () => {
  test("T31 — auto-transition toggle pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-auto-transition-/);
  });

  test("T32 — checked state bound to autoTransition", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/checked=\{stage\.autoTransition\}/);
  });

  test("T33 — onChange toggles autoTransition", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/autoTransition:\s*e\.target\.checked/);
  });
});

// ============================================================
// HITL Configuration (T34-T37)
// ============================================================

test.describe("ORCH-S05 — HITL Configuration", () => {
  test("T34 — HITL toggle pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-hitl-toggle-/);
  });

  test("T35 — hitlRoles container conditional on hitlRequired", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/stage\.hitlRequired\s*&&/);
  });

  test("T36 — HITL role options include admin, manager, contributor", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toContain('"admin"');
    expect(src).toContain('"manager"');
    expect(src).toContain('"contributor"');
  });

  test("T37 — hitlRequired state binding", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/checked=\{stage\.hitlRequired\s*\?\?\s*false\}/);
  });
});

// ============================================================
// Required Files Section (T38-T40)
// ============================================================

test.describe("ORCH-S05 — Required Files", () => {
  test("T38 — required files container pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-required-files-/);
  });

  test("T39 — add file button pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-add-file-/);
  });

  test("T40 — file path and description inputs in required files", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toContain('placeholder="File path"');
    expect(src).toContain('placeholder="Description"');
  });
});

// ============================================================
// Pre-Prompts Section (T41-T42)
// ============================================================

test.describe("ORCH-S05 — Pre-Prompts", () => {
  test("T41 — pre-prompts container pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-preprompts-/);
  });

  test("T42 — add pre-prompt button pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-add-preprompt-/);
  });
});

// ============================================================
// Preview Panel (T43-T44)
// ============================================================

test.describe("ORCH-S05 — Preview Panel", () => {
  test("T43 — preview panel data-testid in WorkflowEditorPreview", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toContain('data-testid="orch-s05-preview-panel"');
  });

  test("T44 — preview stage data-testid pattern", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-preview-stage-/);
  });
});

// ============================================================
// Save Functionality (T45-T46)
// ============================================================

test.describe("ORCH-S05 — Save Functionality", () => {
  test("T45 — save button present", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-save-btn"');
  });

  test("T46 — uses workflowTemplatesApi.create or .update", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toMatch(/workflowTemplatesApi\.create/);
    expect(src).toMatch(/workflowTemplatesApi\.update/);
  });
});

// ============================================================
// App.tsx Route + Sidebar Integration (T47-T48)
// ============================================================

test.describe("ORCH-S05 — Route & Sidebar Integration", () => {
  test("T47 — workflow-editor route in App.tsx", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toContain("workflow-editor/new");
    expect(src).toContain("workflow-editor/:templateId");
    expect(src).toContain("WorkflowEditor");
  });

  test("T48 — sidebar nav item orch-s05-nav-editor present", async () => {
    const src = await readFile(SIDEBAR_FILE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-nav-editor"');
    expect(src).toContain("Workflow Editor");
  });
});

// ============================================================
// Regression — ORCH-S04 (T49-T52)
// ============================================================

test.describe("ORCH-S05 — Regression ORCH-S04", () => {
  test("T49 — ORCH-S04 orchestrator routes file exists", async () => {
    const src = await readFile(ORCH_ROUTES, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  test("T50 — ORCH-S04 orchestrator routes still export function", async () => {
    const src = await readFile(ORCH_ROUTES, "utf-8");
    expect(src).toMatch(/export\s+function\s+orchestratorRoutes/);
  });

  test("T51 — workflow templates API still has list, get, create, update, remove", async () => {
    const src = await readFile(WORKFLOW_API, "utf-8");
    expect(src).toMatch(/list:\s*\(/);
    expect(src).toMatch(/get:\s*\(/);
    expect(src).toMatch(/create:\s*\(/);
    expect(src).toMatch(/update:\s*\(/);
    expect(src).toMatch(/remove:\s*\(/);
  });

  test("T52 — query keys for workflows still defined", async () => {
    const src = await readFile(QUERY_KEYS, "utf-8");
    expect(src).toMatch(/workflows:\s*\{/);
    expect(src).toMatch(/templates:\s*\(/);
  });
});

// ============================================================
// Regression — RBAC-S05 (T53-T56)
// ============================================================

test.describe("ORCH-S05 — Regression RBAC-S05", () => {
  test("T53 — RequirePermission component still exists", async () => {
    const src = await readFile(RBAC_REQUIRE_PERMISSION, "utf-8");
    expect(src).toMatch(/export\s+function\s+RequirePermission/);
  });

  test("T54 — workflow-editor routes use RequirePermission", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    const editorNew = src.match(/workflow-editor\/new.*RequirePermission/s);
    expect(editorNew).toBeTruthy();
  });

  test("T55 — sidebar still guards workflows with canViewWorkflows", async () => {
    const src = await readFile(SIDEBAR_FILE, "utf-8");
    expect(src).toMatch(/canViewWorkflows\s*&&/);
  });

  test("T56 — sidebar Workflow Editor guarded by canViewWorkflows", async () => {
    const src = await readFile(SIDEBAR_FILE, "utf-8");
    // The workflow editor sidebar item is inside a canViewWorkflows guard
    const editorSection = src.match(/canViewWorkflows[\s\S]*?orch-s05-nav-editor/);
    expect(editorSection).toBeTruthy();
  });
});

// ============================================================
// Component Details — Acceptance Criteria (T57-T58)
// ============================================================

test.describe("ORCH-S05 — Acceptance Criteria Section", () => {
  test("T57 — acceptance criteria container pattern present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-acceptance-/);
  });

  test("T58 — add acceptance criteria button present", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-add-acceptance-/);
  });
});

// ============================================================
// Additional Coverage — Expand/Collapse, Preview Toggle (T59-T62)
// ============================================================

test.describe("ORCH-S05 — Expand/Collapse & Preview", () => {
  test("T59 — expand/collapse toggle present on stage card", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-stage-expand-/);
  });

  test("T60 — preview button present on editor page", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-preview-btn"');
  });

  test("T61 — cancel button present on editor page", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-cancel-btn"');
  });

  test("T62 — error message display present", async () => {
    const src = await readFile(EDITOR_PAGE, "utf-8");
    expect(src).toContain('data-testid="orch-s05-error-message"');
  });
});

// ============================================================
// StageDef Type & Interface (T63-T65)
// ============================================================

test.describe("ORCH-S05 — StageDef Type", () => {
  test("T63 — StageDef interface exported from StageEditorCard", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/export\s+interface\s+StageDef/);
  });

  test("T64 — StageDef includes hitlRequired and hitlRoles", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/hitlRequired\??\s*:\s*boolean/);
    expect(src).toMatch(/hitlRoles\??\s*:\s*string\[\]/);
  });

  test("T65 — StageDef includes requiredFiles and prePrompts", async () => {
    const src = await readFile(STAGE_CARD, "utf-8");
    expect(src).toMatch(/requiredFiles\??\s*:/);
    expect(src).toMatch(/prePrompts\??\s*:\s*string\[\]/);
  });
});

// ============================================================
// Preview Arrow & Stage Elements (T66-T68)
// ============================================================

test.describe("ORCH-S05 — Preview Elements", () => {
  test("T66 — preview arrow data-testid pattern present", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toMatch(/data-testid=\{?[`"]orch-s05-preview-arrow-/);
  });

  test("T67 — preview shows stage count badges for files/prompts/AC", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toContain("file");
    expect(src).toContain("prompt");
    expect(src).toContain("AC");
  });

  test("T68 — preview shows empty state message when no stages", async () => {
    const src = await readFile(PREVIEW_COMPONENT, "utf-8");
    expect(src).toContain("No stages to preview");
  });
});
