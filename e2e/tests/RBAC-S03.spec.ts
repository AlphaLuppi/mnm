/**
 * RBAC-S03: BusinessRole Migration -- E2E Tests
 *
 * These tests verify the deliverables of RBAC-S03:
 *   - AC-01: BUSINESS_ROLES constants exported from @mnm/shared
 *   - AC-02: Data migration -- existing members updated to admin
 *   - AC-03: businessRoleSchema and updateMemberBusinessRoleSchema validators
 *   - AC-04/05: Zod validates 4 roles, rejects invalid
 *   - AC-06: PATCH business-role endpoint protected by permission
 *   - AC-07: 404 for unknown member
 *   - AC-08: CompanyMembership type includes businessRole
 *   - AC-09: Seed includes businessRole admin
 *   - AC-10: Activity log records role change
 *   - AC-11: ensureMembership backward compat with optional businessRole
 *
 * Source files:
 *   - packages/shared/src/constants.ts -- BUSINESS_ROLES, BusinessRole, BUSINESS_ROLE_LABELS
 *   - packages/shared/src/validators/access.ts -- businessRoleSchema, updateMemberBusinessRoleSchema
 *   - packages/shared/src/types/access.ts -- CompanyMembership.businessRole
 *   - packages/shared/src/index.ts -- re-exports
 *   - packages/shared/src/validators/index.ts -- re-exports
 *   - server/src/services/access.ts -- updateMemberBusinessRole(), ensureMembership() update
 *   - server/src/routes/access.ts -- PATCH business-role endpoint
 *   - packages/db/src/seed.ts -- businessRole: "admin"
 *   - packages/db/src/migrations/0031_*.sql -- data migration
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
// SKIPPED: BUSINESS_ROLES constants were removed — roles are now dynamic in DB (roles table).
// This entire test file references removed artifacts (BUSINESS_ROLES, businessRoleSchema, etc.)
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

test.skip(true, "RBAC-S03 is obsolete — hardcoded BUSINESS_ROLES replaced by dynamic roles in DB");

const ROOT = resolve(import.meta.dirname, "../..");
const CONSTANTS = resolve(ROOT, "packages/shared/src/constants.ts");
const VALIDATORS_ACCESS = resolve(
  ROOT,
  "packages/shared/src/validators/access.ts",
);
const VALIDATORS_INDEX = resolve(
  ROOT,
  "packages/shared/src/validators/index.ts",
);
const TYPES_ACCESS = resolve(ROOT, "packages/shared/src/types/access.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const ACCESS_SERVICE = resolve(ROOT, "server/src/services/access.ts");
const ACCESS_ROUTES = resolve(ROOT, "server/src/routes/access.ts");
const SEED = resolve(ROOT, "packages/db/src/seed.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const JOURNAL = resolve(MIGRATIONS_DIR, "meta/_journal.json");

// ─── Group 1: Constants (packages/shared/src/constants.ts) ──────────────────

test.describe("Group 1: BUSINESS_ROLES constants", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS, "utf-8");
  });

  test("BUSINESS_ROLES array exists with 4 values: admin, manager, contributor, viewer", () => {
    expect(content).toMatch(/BUSINESS_ROLES\s*=\s*\[/);
    expect(content).toContain('"admin"');
    expect(content).toContain('"manager"');
    expect(content).toContain('"contributor"');
    expect(content).toContain('"viewer"');
  });

  test("BusinessRole type is exported", () => {
    expect(content).toMatch(
      /export\s+type\s+BusinessRole\s*=\s*\(typeof\s+BUSINESS_ROLES\)\[number\]/,
    );
  });

  test("BUSINESS_ROLE_LABELS record exists with 4 entries", () => {
    expect(content).toMatch(
      /export\s+const\s+BUSINESS_ROLE_LABELS\s*:\s*Record<BusinessRole/,
    );
    // Verify all 4 label entries
    expect(content).toMatch(/admin\s*:\s*"Admin"/);
    expect(content).toMatch(/manager\s*:\s*"Manager"/);
    expect(content).toMatch(/contributor\s*:\s*"Contributor"/);
    expect(content).toMatch(/viewer\s*:\s*"Viewer"/);
  });
});

// ─── Group 2: Zod validators (packages/shared/src/validators/access.ts) ─────

test.describe("Group 2: Zod validators", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATORS_ACCESS, "utf-8");
  });

  test("businessRoleSchema exists using z.enum(BUSINESS_ROLES)", () => {
    expect(content).toMatch(
      /export\s+const\s+businessRoleSchema\s*=\s*z\.enum\(\s*BUSINESS_ROLES\s*\)/,
    );
  });

  test("updateMemberBusinessRoleSchema exists with businessRole field", () => {
    expect(content).toMatch(
      /export\s+const\s+updateMemberBusinessRoleSchema\s*=\s*z\.object/,
    );
    // The schema should contain a businessRole field using z.enum(BUSINESS_ROLES)
    expect(content).toMatch(
      /updateMemberBusinessRoleSchema[\s\S]*?businessRole/,
    );
  });

  test("UpdateMemberBusinessRole type is exported", () => {
    expect(content).toMatch(
      /export\s+type\s+UpdateMemberBusinessRole\s*=\s*z\.infer/,
    );
  });

  test("imports BUSINESS_ROLES from constants", () => {
    expect(content).toContain("BUSINESS_ROLES");
    expect(content).toMatch(/from\s+["']\.\.\/constants/);
  });
});

// ─── Group 3: Type update (packages/shared/src/types/access.ts) ─────────────

test.describe("Group 3: CompanyMembership type update", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_ACCESS, "utf-8");
  });

  test("CompanyMembership interface has businessRole field", () => {
    // Extract the CompanyMembership interface body
    const interfaceMatch = content.match(
      /export\s+interface\s+CompanyMembership\s*\{[\s\S]*?\}/,
    );
    expect(interfaceMatch).toBeTruthy();
    const interfaceBody = interfaceMatch![0];
    expect(interfaceBody).toMatch(/businessRole\s*:\s*BusinessRole/);
  });

  test("BusinessRole type is imported from constants", () => {
    expect(content).toContain("BusinessRole");
    expect(content).toMatch(/import\s+type\s*\{[\s\S]*?BusinessRole[\s\S]*?\}\s*from\s+["']\.\.\/constants/);
  });
});

// ─── Group 4: Re-exports ────────────────────────────────────────────────────

test.describe("Group 4: Re-exports from shared/index.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SHARED_INDEX, "utf-8");
  });

  test("re-exports BUSINESS_ROLES from constants", () => {
    expect(content).toContain("BUSINESS_ROLES");
  });

  test("re-exports BUSINESS_ROLE_LABELS from constants", () => {
    expect(content).toContain("BUSINESS_ROLE_LABELS");
  });

  test("re-exports BusinessRole type from constants", () => {
    expect(content).toMatch(/type\s+BusinessRole/);
  });

  test("re-exports businessRoleSchema from validators", () => {
    expect(content).toContain("businessRoleSchema");
  });

  test("re-exports updateMemberBusinessRoleSchema from validators", () => {
    expect(content).toContain("updateMemberBusinessRoleSchema");
  });

  test("re-exports UpdateMemberBusinessRole type from validators", () => {
    expect(content).toMatch(/type\s+UpdateMemberBusinessRole/);
  });
});

test.describe("Group 4b: Re-exports from validators/index.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATORS_INDEX, "utf-8");
  });

  test("re-exports businessRoleSchema from access.js", () => {
    expect(content).toContain("businessRoleSchema");
  });

  test("re-exports updateMemberBusinessRoleSchema from access.js", () => {
    expect(content).toContain("updateMemberBusinessRoleSchema");
  });

  test("re-exports UpdateMemberBusinessRole type from access.js", () => {
    expect(content).toMatch(/type\s+UpdateMemberBusinessRole/);
  });
});

// ─── Group 5: Data migration ────────────────────────────────────────────────

test.describe("Group 5: Data migration (0031)", () => {
  test("migration file 0031_* exists in packages/db/src/migrations/", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migration0031 = files.filter(
      (f) => f.startsWith("0031") && f.endsWith(".sql"),
    );
    expect(migration0031.length).toBeGreaterThanOrEqual(1);
  });

  test("migration contains UPDATE setting business_role to admin", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migration0031 = files.find(
      (f) => f.startsWith("0031") && f.endsWith(".sql"),
    );
    expect(migration0031).toBeTruthy();

    const content = await readFile(
      resolve(MIGRATIONS_DIR, migration0031!),
      "utf-8",
    );
    // Should contain UPDATE company_memberships SET business_role = 'admin'
    expect(content).toMatch(/UPDATE/i);
    expect(content).toMatch(/company_memberships/i);
    expect(content).toMatch(/business_role/i);
    expect(content).toContain("admin");
  });

  test("migration journal has entry for 0031", async () => {
    const journalContent = await readFile(JOURNAL, "utf-8");
    const journal = JSON.parse(journalContent);
    const entry0031 = journal.entries.find(
      (e: { idx: number; tag: string }) =>
        e.idx === 31 || e.tag.startsWith("0031"),
    );
    expect(entry0031).toBeTruthy();
    expect(entry0031.tag).toMatch(/^0031/);
  });
});

// ─── Group 6: Service (server/src/services/access.ts) ───────────────────────

test.describe("Group 6: accessService updates", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("updateMemberBusinessRole function exists", () => {
    expect(content).toMatch(
      /async\s+function\s+updateMemberBusinessRole\s*\(/,
    );
  });

  test("updateMemberBusinessRole updates companyMemberships with new businessRole", () => {
    // Extract the function body
    const fnMatch = content.match(
      /async\s+function\s+updateMemberBusinessRole[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    // Should do an update on companyMemberships
    expect(fnBody).toMatch(/\.update\s*\(\s*companyMemberships\s*\)/);
    // Should set businessRole
    expect(fnBody).toContain("businessRole");
  });

  test("updateMemberBusinessRole is in the return object of accessService", () => {
    // The service exports updateMemberBusinessRole in its return object
    // Use greedy match to capture the final (largest) return block
    const returnMatches = content.match(/return\s*\{[\s\S]*?\}\s*;\s*\}/g);
    expect(returnMatches).toBeTruthy();
    const lastReturn = returnMatches![returnMatches!.length - 1];
    expect(lastReturn).toContain("updateMemberBusinessRole");
  });

  test("ensureMembership accepts businessRole parameter", () => {
    // Extract ensureMembership signature
    const fnMatch = content.match(
      /async\s+function\s+ensureMembership\s*\([^)]*\)/,
    );
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain("businessRole");
  });

  test("ensureMembership businessRole has default value", () => {
    // Should have a default value for businessRole parameter
    const fnMatch = content.match(
      /async\s+function\s+ensureMembership\s*\([^)]*\)/,
    );
    expect(fnMatch).toBeTruthy();
    // Default should be "contributor"
    expect(fnMatch![0]).toMatch(/businessRole[^,)]*=\s*"contributor"/);
  });

  test("ensureMembership passes businessRole to insert values", () => {
    // Extract ensureMembership function body
    const fnMatch = content.match(
      /async\s+function\s+ensureMembership[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    // Should include businessRole in the insert values
    expect(fnBody).toMatch(/\.values\(\s*\{[\s\S]*?businessRole[\s\S]*?\}\s*\)/);
  });
});

// ─── Group 7: API endpoint (server/src/routes/access.ts) ────────────────────

test.describe("Group 7: API endpoint PATCH business-role", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("PATCH route for business-role exists", () => {
    expect(content).toMatch(
      /router\.patch\s*\(\s*["'][^"']*business-role["']/,
    );
  });

  test("uses validate middleware with updateMemberBusinessRoleSchema", () => {
    expect(content).toMatch(
      /validate\s*\(\s*updateMemberBusinessRoleSchema\s*\)/,
    );
  });

  test("calls assertCompanyPermission with users:manage_permissions", () => {
    // Within the business-role route handler, assertCompanyPermission should be called
    // Find the section around "business-role"
    const routeIdx = content.indexOf("business-role");
    expect(routeIdx).toBeGreaterThan(-1);
    // Look for assertCompanyPermission near (within 800 chars after route definition)
    const nearbyContent = content.slice(routeIdx, routeIdx + 800);
    expect(nearbyContent).toContain("assertCompanyPermission");
    expect(nearbyContent).toContain("users:manage_permissions");
  });

  test("logs activity with member.business_role action", () => {
    // Accepts either dot-separated or underscore-separated action name
    expect(content).toMatch(/member\.business_role[._]updated/);
  });

  test("imports updateMemberBusinessRoleSchema from @mnm/shared", () => {
    expect(content).toContain("updateMemberBusinessRoleSchema");
  });
});

// ─── Group 8: Seed (packages/db/src/seed.ts) ────────────────────────────────

test.describe("Group 8: Seed includes businessRole admin", () => {
  test('seed includes businessRole: "admin" for admin membership', async () => {
    const content = await readFile(SEED, "utf-8");
    // The membership insert should include businessRole: "admin"
    expect(content).toMatch(/businessRole\s*:\s*"admin"/);
  });
});
