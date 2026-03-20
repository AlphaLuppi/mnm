/**
 * DUAL-S01 — Automation Cursors: Table + Service + Routes
 *
 * File-content-based E2E tests verifying:
 * - Service factory export and public API methods
 * - Position value mapping and hierarchy ceiling logic
 * - Upsert via onConflictDoUpdate
 * - Audit service integration
 * - API routes with permission guards and validation
 * - Shared types, constants, validators, and barrel exports
 * - Schema columns and indexes
 *
 * 50 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SVC_FILE = resolve(ROOT, "server/src/services/automation-cursors.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/automation-cursors.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/automation-cursor.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/automation-cursor.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/automation_cursors.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");

// ============================================================
// Service: automation-cursors.ts (T01–T15)
// ============================================================

test.describe("DUAL-S01 — Automation Cursor Service", () => {
  // T01 — Service factory export
  test("T01 — exports automationCursorService function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+automationCursorService\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T02 — setCursor method
  test("T02 — service returns object with setCursor method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+setCursor\s*\(/);
    expect(src).toContain("setCursor,");
  });

  // T03 — getCursors method
  test("T03 — service returns object with getCursors method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getCursors\s*\(/);
    expect(src).toContain("getCursors,");
  });

  // T04 — getCursorById method
  test("T04 — service returns object with getCursorById method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getCursorById\s*\(/);
    expect(src).toContain("getCursorById,");
  });

  // T05 — deleteCursor method
  test("T05 — service returns object with deleteCursor method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+deleteCursor\s*\(/);
    expect(src).toContain("deleteCursor,");
  });

  // T06 — resolveEffective method
  test("T06 — service returns object with resolveEffective method", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+resolveEffective\s*\(/);
    expect(src).toContain("resolveEffective,");
  });

  // T07 — getPositionValue helper
  test("T07 — service has getPositionValue helper", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/function\s+getPositionValue\s*\(\s*position\s*:/);
    expect(src).toContain("getPositionValue,");
  });

  // T08 — minPosition helper
  test("T08 — service has minPosition helper", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/function\s+minPosition\s*\(\s*a\s*:/);
    expect(src).toContain("minPosition,");
  });

  // T09 — imports automationCursors from @mnm/db
  test("T09 — service imports automationCursors from @mnm/db", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*automationCursors[^}]*\}\s*from\s*["']@mnm\/db["']/);
  });

  // T10 — imports auditService for audit emission
  test("T10 — service imports auditService for audit emission", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*auditService[^}]*\}\s*from/);
    expect(src).toContain("audit.emit(");
  });

  // T11 — setCursor uses upsert (onConflictDoUpdate)
  test("T11 — setCursor uses upsert via onConflictDoUpdate", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("onConflictDoUpdate");
  });

  // T12 — resolveEffective queries all hierarchy levels
  test("T12 — resolveEffective queries company, project, agent, action levels", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // Must query for company-level cursor
    expect(src).toContain('"company"');
    // Must query for project-level cursor
    expect(src).toContain('"project"');
    // Must query for agent-level cursor
    expect(src).toContain('"agent"');
    // Must query for action-level cursor
    expect(src).toContain('"action"');
  });

  // T13 — getPositionValue maps manual=0, assisted=1, auto=2
  test("T13 — getPositionValue maps manual=0, assisted=1, auto=2", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("manual: 0");
    expect(src).toContain("assisted: 1");
    expect(src).toContain("auto: 2");
  });

  // T14 — minPosition returns more restrictive position
  test("T14 — minPosition uses Math.min on position values", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("Math.min(va, vb)");
  });

  // T15 — Service emits audit event on setCursor
  test("T15 — service emits automation_cursor.updated audit on setCursor", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain('"automation_cursor.updated"');
  });
});

// ============================================================
// Routes: automation-cursors.ts (T16–T25)
// ============================================================

test.describe("DUAL-S01 — Automation Cursor Routes", () => {
  // T16 — Route file exports automationCursorRoutes
  test("T16 — exports automationCursorRoutes function", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+automationCursorRoutes\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T17 — GET list route
  test("T17 — GET /companies/:companyId/automation-cursors route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/automation-cursors["']/);
  });

  // T18 — GET by ID route
  test("T18 — GET /companies/:companyId/automation-cursors/:cursorId route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/automation-cursors\/:cursorId["']/);
  });

  // T19 — PUT upsert route
  test("T19 — PUT /companies/:companyId/automation-cursors route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.put\(\s*["']\/companies\/:companyId\/automation-cursors["']/);
  });

  // T20 — DELETE route
  test("T20 — DELETE /companies/:companyId/automation-cursors/:cursorId route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.delete\(\s*["']\/companies\/:companyId\/automation-cursors\/:cursorId["']/);
  });

  // T21 — POST resolve route
  test("T21 — POST /companies/:companyId/automation-cursors/resolve route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\(\s*["']\/companies\/:companyId\/automation-cursors\/resolve["']/);
  });

  // T22 — All routes use requirePermission
  test("T22 — all routes use requirePermission with workflows:enforce", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const matches = src.match(/requirePermission\(db,\s*["']workflows:enforce["']\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });

  // T23 — PUT route uses validate(setCursorSchema)
  test("T23 — PUT route uses validate(setCursorSchema)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("validate(setCursorSchema)");
  });

  // T24 — POST resolve uses validate(resolveCursorSchema)
  test("T24 — POST resolve uses validate(resolveCursorSchema)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("validate(resolveCursorSchema)");
  });

  // T25 — Routes use emitAudit for mutations
  test("T25 — routes use emitAudit for PUT and DELETE mutations", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const emitCalls = src.match(/emitAudit\(/g);
    expect(emitCalls).not.toBeNull();
    expect(emitCalls!.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Types: automation-cursor.ts (T26–T32)
// ============================================================

test.describe("DUAL-S01 — Automation Cursor Types", () => {
  // T26 — AutomationCursor interface
  test("T26 — exports AutomationCursor interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+AutomationCursor\s*\{/);
  });

  // T27 — EffectiveCursor interface
  test("T27 — exports EffectiveCursor interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+EffectiveCursor\s*\{/);
  });

  // T28 — AutomationCursorPosition type
  test("T28 — exports AutomationCursorPosition type", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+type\s+AutomationCursorPosition\s*=/);
  });

  // T29 — AutomationCursorLevel type
  test("T29 — exports AutomationCursorLevel type", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+type\s+AutomationCursorLevel\s*=/);
  });

  // T30 — AUTOMATION_CURSOR_POSITIONS constant
  test("T30 — exports AUTOMATION_CURSOR_POSITIONS constant", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+AUTOMATION_CURSOR_POSITIONS\s*=/);
  });

  // T31 — AUTOMATION_CURSOR_LEVELS constant
  test("T31 — exports AUTOMATION_CURSOR_LEVELS constant", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+AUTOMATION_CURSOR_LEVELS\s*=/);
  });

  // T32 — AUTOMATION_CURSOR_POSITIONS values
  test("T32 — AUTOMATION_CURSOR_POSITIONS = [manual, assisted, auto]", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain('"manual"');
    expect(src).toContain('"assisted"');
    expect(src).toContain('"auto"');
    // Verify it's the POSITIONS constant containing all 3
    const match = src.match(/AUTOMATION_CURSOR_POSITIONS\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('"manual"');
    expect(match![1]).toContain('"assisted"');
    expect(match![1]).toContain('"auto"');
  });
});

// ============================================================
// Validators: automation-cursor.ts (T33–T37)
// ============================================================

test.describe("DUAL-S01 — Automation Cursor Validators", () => {
  // T33 — setCursorSchema export
  test("T33 — exports setCursorSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+setCursorSchema\s*=/);
  });

  // T34 — cursorFiltersSchema export
  test("T34 — exports cursorFiltersSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+cursorFiltersSchema\s*=/);
  });

  // T35 — resolveCursorSchema export
  test("T35 — exports resolveCursorSchema", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+resolveCursorSchema\s*=/);
  });

  // T36 — setCursorSchema validates position enum
  test("T36 — setCursorSchema validates position with AUTOMATION_CURSOR_POSITIONS enum", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toContain("AUTOMATION_CURSOR_POSITIONS");
    expect(src).toContain("z.enum(AUTOMATION_CURSOR_POSITIONS)");
  });

  // T37 — resolveCursorSchema validates level enum
  test("T37 — resolveCursorSchema validates level with AUTOMATION_CURSOR_LEVELS enum", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toContain("AUTOMATION_CURSOR_LEVELS");
    expect(src).toContain("z.enum(AUTOMATION_CURSOR_LEVELS)");
  });
});

// ============================================================
// Barrel exports (T38–T45)
// ============================================================

test.describe("DUAL-S01 — Barrel Exports", () => {
  // T38 — services/index.ts exports automationCursorService
  test("T38 — services/index.ts exports automationCursorService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*automationCursorService[^}]*\}\s*from\s*["']\.\/automation-cursors/);
  });

  // T39 — routes/index.ts exports automationCursorRoutes
  test("T39 — routes/index.ts exports automationCursorRoutes", async () => {
    const src = await readFile(ROUTES_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*automationCursorRoutes[^}]*\}\s*from\s*["']\.\/automation-cursors/);
  });

  // T40 — types/index.ts re-exports AutomationCursor
  test("T40 — types/index.ts re-exports AutomationCursor", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("AutomationCursor");
  });

  // T41 — types/index.ts re-exports AUTOMATION_CURSOR_POSITIONS
  test("T41 — types/index.ts re-exports AUTOMATION_CURSOR_POSITIONS", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("AUTOMATION_CURSOR_POSITIONS");
  });

  // T42 — validators/index.ts re-exports setCursorSchema
  test("T42 — validators/index.ts re-exports setCursorSchema", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("setCursorSchema");
  });

  // T43 — shared/index.ts re-exports AutomationCursor
  test("T43 — shared/index.ts re-exports AutomationCursor type", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("AutomationCursor");
  });

  // T44 — shared/index.ts re-exports setCursorSchema
  test("T44 — shared/index.ts re-exports setCursorSchema", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("setCursorSchema");
  });

  // T45 — app.ts mounts automationCursorRoutes
  test("T45 — app.ts imports and mounts automationCursorRoutes", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*automationCursorRoutes[^}]*\}\s*from/);
    expect(src).toContain("automationCursorRoutes(db)");
  });
});

// ============================================================
// Schema: automation_cursors.ts (T46–T50)
// ============================================================

test.describe("DUAL-S01 — Schema", () => {
  // T46 — Schema has id, companyId, level, position columns
  test("T46 — automation_cursors schema has id, companyId, level, position", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain('id: uuid("id")');
    expect(src).toContain('companyId: uuid("company_id")');
    expect(src).toContain('level: text("level")');
    expect(src).toContain('position: text("position")');
  });

  // T47 — Schema has ceiling field
  test("T47 — automation_cursors schema has ceiling field", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain('ceiling: text("ceiling")');
  });

  // T48 — Schema has setByUserId field
  test("T48 — automation_cursors schema has setByUserId field", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain('setByUserId: text("set_by_user_id")');
  });

  // T49 — Schema has unique index on company+level+target
  test("T49 — automation_cursors schema has unique index on companyId+level+targetId", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("uniqueIndex");
    expect(src).toContain("automation_cursors_company_level_target_unique_idx");
  });

  // T50 — schema/index.ts exports automationCursors
  test("T50 — schema/index.ts exports automationCursors", async () => {
    const src = await readFile(SCHEMA_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*automationCursors[^}]*\}\s*from\s*["']\.\/automation_cursors/);
  });
});
