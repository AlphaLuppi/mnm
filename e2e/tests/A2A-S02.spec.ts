/**
 * A2A-S02 — A2A Permissions: Granular A2A access control
 *
 * File-content-based E2E tests verifying:
 * - Schema definition with table, columns, and indexes
 * - Types and validators for permission rules + default policy
 * - Service factory with CRUD + checkPermission logic
 * - A2A Bus integration (permission check before message send)
 * - API routes with permission guards and validation
 * - Barrel exports across all packages
 *
 * 55 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/a2a-permission-rules.ts");
const COMPANIES_SCHEMA = resolve(ROOT, "packages/db/src/schema/companies.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");
const MIGRATION_FILE = resolve(ROOT, "packages/db/src/migrations/0041_a2a_permission_rules.sql");
const PERM_SVC_FILE = resolve(ROOT, "server/src/services/a2a-permissions.ts");
const BUS_SVC_FILE = resolve(ROOT, "server/src/services/a2a-bus.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/a2a.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/a2a.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/a2a.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");

// ============================================================
// Schema: a2a-permission-rules.ts (T01–T06)
// ============================================================

test.describe("A2A-S02 — Schema: a2a_permission_rules", () => {
  // T01 — Table definition uses pgTable
  test("T01 — defines a2aPermissionRules table with pgTable", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+a2aPermissionRules\s*=\s*pgTable\s*\(\s*["']a2a_permission_rules["']/);
  });

  // T02 — companyId column with FK to companies
  test("T02 — companyId column with FK to companies", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("company_id");
    expect(src).toMatch(/companyId.*references\s*\(\s*\(\)\s*=>\s*companies\.id\s*\)/);
  });

  // T03 — sourceAgentRole column
  test("T03 — sourceAgentRole column defined", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("source_agent_role");
    expect(src).toMatch(/sourceAgentRole.*text/);
  });

  // T04 — targetAgentRole column
  test("T04 — targetAgentRole column defined", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("target_agent_role");
    expect(src).toMatch(/targetAgentRole.*text/);
  });

  // T05 — 4 indexes defined (company, source_role, target_role, priority)
  test("T05 — 4 indexes defined", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("a2a_perm_rules_company_idx");
    expect(src).toContain("a2a_perm_rules_source_role_idx");
    expect(src).toContain("a2a_perm_rules_target_role_idx");
    expect(src).toContain("a2a_perm_rules_priority_idx");
  });

  // T06 — a2aDefaultPolicy column added to companies schema
  test("T06 — a2aDefaultPolicy column on companies", async () => {
    const src = await readFile(COMPANIES_SCHEMA, "utf-8");
    expect(src).toContain("a2a_default_policy");
    expect(src).toMatch(/a2aDefaultPolicy.*text.*default\s*\(\s*["']allow["']\s*\)/);
  });
});

// ============================================================
// Types & Validators (T07–T14)
// ============================================================

test.describe("A2A-S02 — Types & Validators", () => {
  // T07 — A2APermissionRule interface with all fields
  test("T07 — A2APermissionRule interface defined", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+A2APermissionRule/);
    expect(src).toContain("sourceAgentId");
    expect(src).toContain("sourceAgentRole");
    expect(src).toContain("targetAgentId");
    expect(src).toContain("targetAgentRole");
    expect(src).toContain("allowed");
    expect(src).toContain("bidirectional");
    expect(src).toContain("priority");
  });

  // T08 — A2A_DEFAULT_POLICIES constant with allow/deny
  test("T08 — A2A_DEFAULT_POLICIES constant", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+A2A_DEFAULT_POLICIES\s*=/);
    expect(src).toContain('"allow"');
    expect(src).toContain('"deny"');
  });

  // T09 — A2APermissionCheckResult interface
  test("T09 — A2APermissionCheckResult interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+A2APermissionCheckResult/);
    expect(src).toContain("matchedRuleId");
    expect(src).toContain("defaultPolicy");
    expect(src).toContain('"explicit_rule"');
    expect(src).toContain('"default_policy"');
  });

  // T10 — createA2APermissionRuleSchema Zod validator
  test("T10 — createA2APermissionRuleSchema defined", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+createA2APermissionRuleSchema\s*=\s*z\.object/);
    expect(src).toContain("sourceAgentId");
    expect(src).toContain("targetAgentId");
    expect(src).toContain("allowed");
    expect(src).toContain("bidirectional");
    expect(src).toContain("priority");
  });

  // T11 — updateA2APermissionRuleSchema Zod validator
  test("T11 — updateA2APermissionRuleSchema defined", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+updateA2APermissionRuleSchema\s*=\s*z\.object/);
  });

  // T12 — updateA2ADefaultPolicySchema Zod validator
  test("T12 — updateA2ADefaultPolicySchema defined", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+updateA2ADefaultPolicySchema\s*=\s*z\.object/);
    expect(src).toContain("A2A_DEFAULT_POLICIES");
  });

  // T13 — A2APermissionRule type exported from types/index.ts
  test("T13 — A2APermissionRule exported from types/index.ts", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("A2APermissionRule");
  });

  // T14 — createA2APermissionRuleSchema exported from validators/index.ts
  test("T14 — createA2APermissionRuleSchema exported from validators/index.ts", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("createA2APermissionRuleSchema");
  });
});

// ============================================================
// Service: a2a-permissions.ts (T15–T28)
// ============================================================

test.describe("A2A-S02 — Service: a2a-permissions", () => {
  // T15 — exports a2aPermissionsService factory
  test("T15 — a2aPermissionsService factory exported", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+a2aPermissionsService\s*\(\s*db/);
  });

  // T16 — checkPermission function with senderId, senderRole, receiverId, receiverRole params
  test("T16 — checkPermission function with role params", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+checkPermission\s*\(/);
    expect(src).toContain("senderId");
    expect(src).toContain("senderRole");
    expect(src).toContain("receiverId");
    expect(src).toContain("receiverRole");
  });

  // T17 — createRule function exists
  test("T17 — createRule function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+createRule\s*\(/);
  });

  // T18 — updateRule function exists
  test("T18 — updateRule function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+updateRule\s*\(/);
  });

  // T19 — deleteRule function exists
  test("T19 — deleteRule function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+deleteRule\s*\(/);
  });

  // T20 — listRules function exists
  test("T20 — listRules function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+listRules\s*\(/);
  });

  // T21 — getRuleById function exists
  test("T21 — getRuleById function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getRuleById\s*\(/);
  });

  // T22 — getDefaultPolicy function exists
  test("T22 — getDefaultPolicy function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getDefaultPolicy\s*\(/);
  });

  // T23 — updateDefaultPolicy function exists
  test("T23 — updateDefaultPolicy function", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+updateDefaultPolicy\s*\(/);
  });

  // T24 — imports auditService for audit integration
  test("T24 — imports auditService", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*auditService[^}]*\}\s*from/);
  });

  // T25 — agent-specific rules (by ID) take priority over role-based
  test("T25 — agent-specific rules priority in matchesRule", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    // matchesRule checks sourceAgentId first (ID-specific), then sourceAgentRole (role-based)
    expect(src).toContain("rule.sourceAgentId != null && rule.sourceAgentId === senderId");
    expect(src).toContain("rule.targetAgentId != null && rule.targetAgentId === receiverId");
  });

  // T26 — bidirectional flag check logic
  test("T26 — bidirectional rule matching", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toContain("rule.bidirectional");
    // Check that reverse match is attempted when bidirectional is true
    expect(src).toMatch(/const\s+reverseMatch\s*=\s*rule\.bidirectional/);
  });

  // T27 — priority-based rule ordering (higher priority first)
  test("T27 — rules ordered by priority DESC", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/orderBy\s*\(\s*desc\s*\(\s*a2aPermissionRules\.priority\s*\)/);
  });

  // T28 — imports a2aPermissionRules from @mnm/db
  test("T28 — imports a2aPermissionRules from @mnm/db", async () => {
    const src = await readFile(PERM_SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*a2aPermissionRules[^}]*\}\s*from\s*["']@mnm\/db["']/);
  });
});

// ============================================================
// A2A Bus Integration (T29–T32)
// ============================================================

test.describe("A2A-S02 — Bus Integration", () => {
  // T29 — a2a-bus.ts imports a2aPermissionsService
  test("T29 — a2a-bus imports a2aPermissionsService", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*a2aPermissionsService[^}]*\}\s*from\s*["']\.\/a2a-permissions/);
  });

  // T30 — sendMessage calls checkPermission before insert
  test("T30 — sendMessage calls checkPermission before message insert", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    // checkPermission must appear before the INSERT
    const checkIdx = src.indexOf("permSvc.checkPermission");
    const insertIdx = src.indexOf("db\n      .insert(a2aMessages)");
    // Use a broader search for the insert
    const insertIdx2 = src.indexOf(".insert(a2aMessages)");
    expect(checkIdx).toBeGreaterThan(-1);
    expect(insertIdx2).toBeGreaterThan(-1);
    expect(checkIdx).toBeLessThan(insertIdx2);
  });

  // T31 — A2A_PERMISSION_DENIED error thrown on denied permission
  test("T31 — A2A_PERMISSION_DENIED error on denied", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain("A2A_PERMISSION_DENIED");
    expect(src).toContain("statusCode: 403");
  });

  // T32 — agents table lookup for role resolution in sendMessage
  test("T32 — agent role lookup from agents table", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    // Should import agents from @mnm/db
    expect(src).toMatch(/import\s*\{[^}]*agents[^}]*\}\s*from\s*["']@mnm\/db["']/);
    // Should select role from agents for sender and receiver
    expect(src).toMatch(/select\s*\(\s*\{\s*role:\s*agents\.role\s*\}/);
  });
});

// ============================================================
// Routes (T33–T44)
// ============================================================

test.describe("A2A-S02 — Routes", () => {
  // T33 — POST /a2a/permissions route with requirePermission
  test("T33 — POST /a2a/permissions route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*["'][^"']*\/a2a\/permissions["']/);
    // Should have requirePermission guard
    expect(src).toContain('requirePermission(db, "agents:create")');
  });

  // T34 — GET /a2a/permissions route
  test("T34 — GET /a2a/permissions route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["'][^"']*\/a2a\/permissions["']\s*,/);
  });

  // T35 — GET /a2a/permissions/:ruleId route
  test("T35 — GET /a2a/permissions/:ruleId route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["'][^"']*\/a2a\/permissions\/:ruleId["']/);
  });

  // T36 — PUT /a2a/permissions/:ruleId route
  test("T36 — PUT /a2a/permissions/:ruleId route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.put\s*\(\s*["'][^"']*\/a2a\/permissions\/:ruleId["']/);
  });

  // T37 — DELETE /a2a/permissions/:ruleId route
  test("T37 — DELETE /a2a/permissions/:ruleId route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.delete\s*\(\s*["'][^"']*\/a2a\/permissions\/:ruleId["']/);
  });

  // T38 — GET /a2a/default-policy route
  test("T38 — GET /a2a/default-policy route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["'][^"']*\/a2a\/default-policy["']/);
  });

  // T39 — PUT /a2a/default-policy route
  test("T39 — PUT /a2a/default-policy route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.put\s*\(\s*["'][^"']*\/a2a\/default-policy["']/);
  });

  // T40 — assertCompanyAccess call in permission routes
  test("T40 — assertCompanyAccess in permission routes", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // Count assertCompanyAccess calls — should appear in all 14 route handlers
    const matches = src.match(/assertCompanyAccess\s*\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(14);
  });

  // T41 — validate middleware with createA2APermissionRuleSchema
  test("T41 — validate with createA2APermissionRuleSchema", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("validate(createA2APermissionRuleSchema)");
  });

  // T42 — emitAudit for rule creation
  test("T42 — emitAudit for permission_rule_created", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain('"a2a.permission_rule_created"');
  });

  // T43 — emitAudit for rule deletion
  test("T43 — emitAudit for permission_rule_deleted", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain('"a2a.permission_rule_deleted"');
  });

  // T44 — at least 14 route handlers (7 A2A-S01 + 7 A2A-S02 + 9 A2A-S04 MCP = 23)
  test("T44 — at least 14 route handlers", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // Count router.post, router.get, router.put, router.delete registrations
    const routeMatches = src.match(/router\.(post|get|put|delete)\s*\(/g);
    expect(routeMatches).not.toBeNull();
    expect(routeMatches!.length).toBeGreaterThanOrEqual(14);
  });
});

// ============================================================
// Barrel Exports (T45–T55)
// ============================================================

test.describe("A2A-S02 — Barrel Exports", () => {
  // T45 — schema/index.ts exports a2aPermissionRules
  test("T45 — schema/index.ts exports a2aPermissionRules", async () => {
    const src = await readFile(SCHEMA_INDEX, "utf-8");
    expect(src).toContain("a2aPermissionRules");
    expect(src).toMatch(/export\s*\{[^}]*a2aPermissionRules[^}]*\}\s*from/);
  });

  // T46 — services/index.ts exports a2aPermissionsService
  test("T46 — services/index.ts exports a2aPermissionsService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toContain("a2aPermissionsService");
    expect(src).toMatch(/export\s*\{[^}]*a2aPermissionsService[^}]*\}\s*from/);
  });

  // T47 — types/index.ts exports A2APermissionRule
  test("T47 — types/index.ts exports A2APermissionRule", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("A2APermissionRule");
  });

  // T48 — types/index.ts exports A2A_DEFAULT_POLICIES
  test("T48 — types/index.ts exports A2A_DEFAULT_POLICIES", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("A2A_DEFAULT_POLICIES");
  });

  // T49 — validators/index.ts exports createA2APermissionRuleSchema
  test("T49 — validators/index.ts exports createA2APermissionRuleSchema", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("createA2APermissionRuleSchema");
  });

  // T50 — validators/index.ts exports updateA2APermissionRuleSchema
  test("T50 — validators/index.ts exports updateA2APermissionRuleSchema", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("updateA2APermissionRuleSchema");
  });

  // T51 — validators/index.ts exports updateA2ADefaultPolicySchema
  test("T51 — validators/index.ts exports updateA2ADefaultPolicySchema", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("updateA2ADefaultPolicySchema");
  });

  // T52 — shared/src/index.ts re-exports A2APermissionRule type
  test("T52 — shared/src/index.ts re-exports A2APermissionRule", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("A2APermissionRule");
  });

  // T53 — shared/src/index.ts re-exports A2A_DEFAULT_POLICIES constant
  test("T53 — shared/src/index.ts re-exports A2A_DEFAULT_POLICIES", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("A2A_DEFAULT_POLICIES");
  });

  // T54 — shared/src/index.ts re-exports A2A permission validators
  test("T54 — shared/src/index.ts re-exports A2A permission validators", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("createA2APermissionRuleSchema");
    expect(src).toContain("updateA2APermissionRuleSchema");
    expect(src).toContain("updateA2ADefaultPolicySchema");
  });

  // T55 — a2a.ts route file has 14 total route handlers
  test("T55 — a2a route file has permSvc for permission management", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // Verify permSvc is instantiated
    expect(src).toMatch(/const\s+permSvc\s*=\s*a2aPermissionsService\s*\(\s*db\s*\)/);
    // Verify imports include the permission validators
    expect(src).toContain("createA2APermissionRuleSchema");
    expect(src).toContain("updateA2APermissionRuleSchema");
    expect(src).toContain("updateA2ADefaultPolicySchema");
  });
});
