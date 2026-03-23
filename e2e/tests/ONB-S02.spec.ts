/**
 * ONB-S02 — Cascade Hiérarchique
 *
 * File-content-based E2E tests verifying:
 * - Shared role hierarchy (BUSINESS_ROLE_LEVELS, canInviteRole, getInvitableRoles, getRoleLevel)
 * - Shared barrel exports (role-hierarchy in index.ts)
 * - Backend cascade service (validateCascadeInvite, computeInheritedScope, getCascadeChain)
 * - Backend access route integration (cascade check, audit, invitedBy tracking)
 * - Backend cascade info route (in onboarding routes)
 * - Hierarchy validation logic (admin/manager invite rules, scope intersection)
 * - Migration (invited_by column on company_memberships)
 * - Schema (invitedBy column in Drizzle schema)
 *
 * 35 test cases — all file-content based
 */

// SKIPPED: role-hierarchy.ts was removed — roles are now dynamic in DB (roles table + hierarchyLevel column).
// Cascade hierarchy is now implicit via role hierarchy levels, not a hardcoded file.
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test.skip(true, "ONB-S02 is obsolete — hardcoded role hierarchy replaced by dynamic roles in DB");

const ROOT = resolve(import.meta.dirname, "../..");

// Target files — Shared
const ROLE_HIERARCHY_FILE = resolve(ROOT, "packages/shared/src/role-hierarchy.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");

// Target files — Backend
const CASCADE_SERVICE = resolve(ROOT, "server/src/services/cascade.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ACCESS_ROUTE = resolve(ROOT, "server/src/routes/access.ts");
const ONBOARDING_ROUTE = resolve(ROOT, "server/src/routes/onboarding.ts");

// Target files — Schema / Migration
const MEMBERSHIP_SCHEMA = resolve(ROOT, "packages/db/src/schema/company_memberships.ts");
const MIGRATION_FILE = resolve(ROOT, "packages/db/src/migrations/0044_cascade_hierarchy.sql");

// ============================================================
// Shared — Role Hierarchy (T01-T08)
// ============================================================

test.describe("ONB-S02 — Shared Role Hierarchy", () => {
  // T01 — BUSINESS_ROLE_LEVELS exported
  test("T01 — BUSINESS_ROLE_LEVELS exported", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toContain("BUSINESS_ROLE_LEVELS");
    expect(src).toMatch(/export\s+(const|function)\s+.*BUSINESS_ROLE_LEVELS/s);
  });

  // T02 — Admin level is 0
  test("T02 — Admin level is 0", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/admin.*0/);
  });

  // T03 — Manager level is 1
  test("T03 — Manager level is 1", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/manager.*1/);
  });

  // T04 — Contributor level is 2
  test("T04 — Contributor level is 2", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/contributor.*2/);
  });

  // T05 — Viewer level is 3
  test("T05 — Viewer level is 3", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/viewer.*3/);
  });

  // T06 — canInviteRole function exported
  test("T06 — canInviteRole function exported", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+canInviteRole/);
  });

  // T07 — getInvitableRoles function exported
  test("T07 — getInvitableRoles function exported", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+getInvitableRoles/);
  });

  // T08 — getRoleLevel function exported
  test("T08 — getRoleLevel function exported", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+getRoleLevel/);
  });
});

// ============================================================
// Shared — Barrel Export (T09)
// ============================================================

test.describe("ONB-S02 — Shared Barrel Export", () => {
  // T09 — Role hierarchy exported from shared index
  test("T09 — Role hierarchy exported from shared index", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("role-hierarchy");
    expect(src).toContain("canInviteRole");
    expect(src).toContain("getInvitableRoles");
    expect(src).toContain("BUSINESS_ROLE_LEVELS");
  });
});

// ============================================================
// Backend — Cascade Service (T10-T18)
// ============================================================

test.describe("ONB-S02 — Backend Cascade Service", () => {
  // T10 — Cascade service file exists with marker
  test("T10 — Cascade service file exists with marker", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toContain("onb-s02-cascade-service");
  });

  // T11 — validateCascadeInvite function exists
  test("T11 — validateCascadeInvite function exists", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/async\s+function\s+validateCascadeInvite/);
  });

  // T12 — computeInheritedScope function exists
  test("T12 — computeInheritedScope function exists", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/function\s+computeInheritedScope/);
  });

  // T13 — getCascadeChain function exists
  test("T13 — getCascadeChain function exists", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getCascadeChain/);
  });

  // T14 — Uses canInviteRole from role-hierarchy
  test("T14 — Uses canInviteRole from role-hierarchy", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toContain("canInviteRole");
  });

  // T15 — Uses accessService for permissions
  test("T15 — Uses accessService for permissions", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/accessService|getMembership|getEffectivePermissions/);
  });

  // T16 — Scope containment marker
  test("T16 — Scope containment marker", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toContain("onb-s02-scope-containment");
  });

  // T17 — Returns CascadeValidationResult
  test("T17 — Returns CascadeValidationResult", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/valid.*reason|CascadeValidationResult/);
  });

  // T18 — Cascade service barrel export
  test("T18 — Cascade service barrel export", async () => {
    const src = await readFile(SERVICE_INDEX, "utf-8");
    expect(src).toContain("onb-s02-barrel-svc");
    expect(src).toContain("cascadeService");
  });
});

// ============================================================
// Backend — Access Route Integration (T19-T24)
// ============================================================

test.describe("ONB-S02 — Backend Access Route Integration", () => {
  // T19 — Access route imports cascade service
  test("T19 — Access route imports cascade service", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toMatch(/cascade|cascadeService|validateCascadeInvite/);
  });

  // T20 — Cascade validation check marker
  test("T20 — Cascade validation check marker", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toContain("onb-s02-access-cascade-check");
  });

  // T21 — Cascade audit emit marker
  test("T21 — Cascade audit emit marker", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toContain("onb-s02-cascade-audit");
  });

  // T22 — invitedBy tracking marker
  test("T22 — invitedBy tracking marker", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toContain("onb-s02-invited-by");
  });

  // T23 — 403 on hierarchy violation
  test("T23 — 403 on hierarchy violation", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toMatch(/403|HIERARCHY_VIOLATION|cannot invite/i);
  });

  // T24 — Scope subset enforcement
  test("T24 — Scope subset enforcement", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toMatch(/scope.*subset|containment|inherited/i);
  });
});

// ============================================================
// Backend — Cascade Info Route (T25-T28)
// ============================================================

test.describe("ONB-S02 — Backend Cascade Info Route", () => {
  // T25 — Cascade info route exists
  test("T25 — Cascade info route exists", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    expect(src).toContain("cascade-info");
  });

  // T26 — Route marker
  test("T26 — Route marker", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    expect(src).toContain("onb-s02-cascade-info-route");
  });

  // T27 — Returns invitableRoles (via getCascadeInfo which includes invitableRoles)
  test("T27 — Returns invitableRoles", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    // The route calls getCascadeInfo which returns invitableRoles
    expect(src).toMatch(/getCascadeInfo|invitableRoles|getInvitableRoles/);
  });

  // T28 — Returns cascadeChain (via getCascadeInfo which includes cascadeChain)
  test("T28 — Returns cascadeChain", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    // The route calls getCascadeInfo which returns cascadeChain
    expect(src).toMatch(/getCascadeInfo|cascadeChain|getCascadeChain/);
  });
});

// ============================================================
// Hierarchy Validation Logic (T29-T35)
// ============================================================

test.describe("ONB-S02 — Hierarchy Validation Logic", () => {
  // T29 — Admin can invite any role (level 0)
  test("T29 — Admin can invite any role (level 0)", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    // Admin is level 0, and the canInviteRole function checks inviterLevel <= targetLevel
    // So admin (0) can invite admin (0), manager (1), contributor (2), viewer (3)
    expect(src).toMatch(/admin.*0/);
    expect(src).toMatch(/inviterLevel\s*<=\s*targetLevel/);
  });

  // T30 — Manager can invite manager/contributor/viewer
  test("T30 — Manager can invite manager/contributor/viewer", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    // Manager is level 1, and MAX_INVITER_LEVEL is 1 — so manager can invite
    expect(src).toContain("manager");
    expect(src).toMatch(/getInvitableRoles/);
    // The function filters all roles where canInviteRole returns true
    expect(src).toMatch(/filter.*canInviteRole/);
  });

  // T31 — Contributor cannot invite (level 2)
  test("T31 — Contributor cannot invite (level 2)", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    // Contributor is level 2, and MAX_INVITER_LEVEL is 1
    expect(src).toMatch(/contributor.*2/);
    // The check: inviterLevel > MAX_INVITER_LEVEL returns false
    expect(src).toMatch(/inviterLevel\s*>\s*MAX_INVITER_LEVEL/);
  });

  // T32 — Viewer cannot invite (level 3)
  test("T32 — Viewer cannot invite (level 3)", async () => {
    const src = await readFile(ROLE_HIERARCHY_FILE, "utf-8");
    expect(src).toMatch(/viewer.*3/);
    // Same MAX_INVITER_LEVEL check applies
    expect(src).toMatch(/MAX_INVITER_LEVEL/);
  });

  // T33 — Scope intersection logic
  test("T33 — Scope intersection logic", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/filter|includes|intersection|every/);
    // Intersection: filter requestedProjectIds by inviterSet
    expect(src).toMatch(/inviterSet/);
  });

  // T34 — Empty scope means global
  test("T34 — Empty scope means global", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    // null scope = global access
    expect(src).toMatch(/!inviterScope|scope === null|null.*global/);
  });

  // T35 — Audit emitted on cascade
  test("T35 — Audit emitted on cascade", async () => {
    const src = await readFile(ACCESS_ROUTE, "utf-8");
    expect(src).toMatch(/cascade\.invite|emitAudit.*cascade/);
  });
});

// ============================================================
// Schema & Migration (T36-T38)
// ============================================================

test.describe("ONB-S02 — Schema & Migration", () => {
  // T36 — invitedBy column in company_memberships schema
  test("T36 — invitedBy column in company_memberships schema", async () => {
    const src = await readFile(MEMBERSHIP_SCHEMA, "utf-8");
    expect(src).toMatch(/invitedBy|invited_by/);
  });

  // T37 — Migration file exists with invited_by
  test("T37 — Migration file exists with invited_by column", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toContain("invited_by");
    expect(src).toContain("company_memberships");
  });

  // T38 — Migration adds index on invited_by
  test("T38 — Migration adds index on invited_by", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toMatch(/CREATE\s+INDEX/i);
    expect(src).toContain("invited_by");
  });
});

// ============================================================
// Cascade Service Internal Logic (T39-T42)
// ============================================================

test.describe("ONB-S02 — Cascade Service Internal Logic", () => {
  // T39 — getCascadeInfo function exists
  test("T39 — getCascadeInfo function exists", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getCascadeInfo/);
  });

  // T40 — getEffectiveScope function exists
  test("T40 — getEffectiveScope function exists", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getEffectiveScope/);
  });

  // T41 — SCOPE_VIOLATION sentinel used
  test("T41 — SCOPE_VIOLATION sentinel used for invalid scope", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toContain("SCOPE_VIOLATION");
  });

  // T42 — Cascade service uses companyMemberships table
  test("T42 — Cascade service uses companyMemberships table", async () => {
    const src = await readFile(CASCADE_SERVICE, "utf-8");
    expect(src).toContain("companyMemberships");
    expect(src).toMatch(/from\s+["']@mnm\/db["']/);
  });
});

// ============================================================
// Onboarding Route Enhancement (T43-T45)
// ============================================================

test.describe("ONB-S02 — Onboarding Route Enhancement", () => {
  // T43 — Onboarding route imports cascadeService
  test("T43 — Onboarding route imports cascadeService", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    expect(src).toMatch(/cascadeService|cascade/);
    expect(src).toMatch(/import.*cascade/);
  });

  // T44 — Cascade info endpoint returns invitableRoles and cascadeChain
  test("T44 — Cascade info endpoint returns user info", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    expect(src).toContain("getCascadeInfo");
  });

  // T45 — Cascade info route uses assertCompanyAccess
  test("T45 — Cascade info route uses assertCompanyAccess", async () => {
    const src = await readFile(ONBOARDING_ROUTE, "utf-8");
    // Count assertCompanyAccess calls — should have at least 5 (4 original + 1 new)
    const matches = src.match(/assertCompanyAccess/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });
});
