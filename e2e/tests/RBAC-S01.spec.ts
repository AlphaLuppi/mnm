/**
 * RBAC-S01: Fix hasPermission() — Scope JSONB — E2E Tests
 *
 * These tests verify the deliverables of RBAC-S01:
 *   - AC-1: hasPermission reads scope from DB (selects scope field)
 *   - AC-2: Scope null/empty = wildcard (global access)
 *   - AC-3: Scope with projectIds restricts access
 *   - AC-4: Scope mismatch returns false
 *   - AC-5: Instance admins bypass scope
 *   - AC-6: requirePermission middleware exists
 *   - AC-7: Scope validation with .strict() prevents injection
 *
 * Source files:
 *   - server/src/services/access.ts — hasPermission() fix + canUser() + validateScope()
 *   - server/src/middleware/require-permission.ts — middleware factory
 *   - packages/shared/src/validators/access.ts — scopeSchema + resourceScopeSchema
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ACCESS_SERVICE = resolve(ROOT, "server/src/services/access.ts");
const REQUIRE_PERMISSION = resolve(
  ROOT,
  "server/src/middleware/require-permission.ts",
);
const VALIDATORS_ACCESS = resolve(
  ROOT,
  "packages/shared/src/validators/access.ts",
);
const VALIDATORS_INDEX = resolve(
  ROOT,
  "packages/shared/src/validators/index.ts",
);

// ─── Group 1: Source files exist ─────────────────────────────────────────────

test.describe("Group 1: Source files exist", () => {
  test("server/src/services/access.ts exists", async () => {
    await expect(
      fsAccess(ACCESS_SERVICE).then(() => true),
    ).resolves.toBe(true);
  });

  test("server/src/middleware/require-permission.ts exists", async () => {
    await expect(
      fsAccess(REQUIRE_PERMISSION).then(() => true),
    ).resolves.toBe(true);
  });

  test("packages/shared/src/validators/access.ts contains scopeSchema", async () => {
    const content = await readFile(VALIDATORS_ACCESS, "utf-8");
    expect(content).toContain("scopeSchema");
  });
});

// ─── Group 2: hasPermission scope support ────────────────────────────────────

test.describe("Group 2: hasPermission scope support", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("hasPermission accepts 5th parameter (resourceScope)", () => {
    // The fixed hasPermission should have a 5th parameter for resourceScope
    // Match the function signature with 5 parameters
    expect(content).toMatch(
      /async\s+function\s+hasPermission\s*\([^)]*resourceScope/,
    );
  });

  test("reads scope from DB (selects scope field)", () => {
    // The fixed version should select the scope field from principalPermissionGrants
    expect(content).toContain("principalPermissionGrants.scope");
    // Should be part of a select statement (not just the old .select({ id: ... }))
    expect(content).toMatch(/\.select\(\s*\{[^}]*scope/s);
  });

  test("handles null scope as wildcard", () => {
    // The code should treat null/empty scope as wildcard (global access)
    // Look for the wildcard logic: checking if grantScope is null or empty
    expect(content).toMatch(/!grantScope|grantScope\s*===?\s*null/);
    // Should also handle empty object as wildcard
    expect(content).toMatch(/Object\.keys\s*\(\s*grantScope\s*\)/);
  });

  test("checks projectIds coverage", () => {
    // The scope logic should check if resourceScope.projectIds are covered
    // by the grant's projectIds
    expect(content).toMatch(/resourceScope\.projectIds/);
    // Should use .every() or .includes() to check coverage
    expect(content).toMatch(/\.every\s*\(|\.includes\s*\(/);
  });

  test("returns false on scope mismatch (falls through loop)", () => {
    // After checking all grants, if none covers the scope, return false
    // The function should have a return false after the for loop
    expect(content).toMatch(/return\s+false\s*;\s*\}\s*$/m);
  });
});

// ─── Group 3: canUser scope support ──────────────────────────────────────────

test.describe("Group 3: canUser scope support", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("canUser accepts resourceScope parameter", () => {
    // canUser should accept an optional resourceScope parameter
    expect(content).toMatch(
      /async\s+function\s+canUser\s*\([^)]*resourceScope/,
    );
  });

  test("propagates resourceScope to hasPermission", () => {
    // canUser should pass resourceScope to hasPermission
    // Look for hasPermission call with resourceScope argument
    expect(content).toMatch(
      /hasPermission\s*\([^)]*resourceScope\s*\)/,
    );
  });

  test("instance admin bypasses scope (returns true before hasPermission)", () => {
    // isInstanceAdmin check should come before hasPermission
    // Extract canUser function body
    const canUserMatch = content.match(
      /async\s+function\s+canUser[\s\S]*?(?=\n\s*async\s+function\s|\n\s*function\s|\n\s*return\s+\{)/,
    );
    expect(canUserMatch).toBeTruthy();
    const canUserBody = canUserMatch![0];

    // isInstanceAdmin should be checked and return true before hasPermission
    const adminCheckPos = canUserBody.indexOf("isInstanceAdmin");
    const hasPermPos = canUserBody.indexOf("hasPermission");
    expect(adminCheckPos).toBeGreaterThan(-1);
    expect(hasPermPos).toBeGreaterThan(-1);
    expect(adminCheckPos).toBeLessThan(hasPermPos);
  });
});

// ─── Group 4: Scope validation ───────────────────────────────────────────────

test.describe("Group 4: Scope validation", () => {
  let validatorsContent: string;
  let accessServiceContent: string;

  test.beforeAll(async () => {
    validatorsContent = await readFile(VALIDATORS_ACCESS, "utf-8");
    accessServiceContent = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("scopeSchema uses .strict()", () => {
    // scopeSchema should use .strict() to prevent injection of unknown keys
    expect(validatorsContent).toMatch(/scopeSchema\s*=[\s\S]*?\.strict\(\)/);
  });

  test("scopeSchema validates projectIds as UUID array", () => {
    // projectIds should be validated as an array of UUID strings
    expect(validatorsContent).toMatch(
      /projectIds[\s\S]*?z\.array\s*\(\s*z\.string\(\)\.uuid\(\)\s*\)/,
    );
  });

  test("validateScope function exists in access service", () => {
    // validateScope should be defined in the access service
    expect(accessServiceContent).toMatch(
      /function\s+validateScope\s*\(/,
    );
    // Should use scopeSchema for validation
    expect(accessServiceContent).toMatch(/scopeSchema/);
  });
});

// ─── Group 5: requirePermission middleware ───────────────────────────────────

test.describe("Group 5: requirePermission middleware", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(REQUIRE_PERMISSION, "utf-8");
  });

  test("exports requirePermission function", () => {
    expect(content).toMatch(
      /export\s+function\s+requirePermission/,
    );
  });

  test("accepts permissionKey parameter", () => {
    // requirePermission should accept a permissionKey parameter
    expect(content).toMatch(
      /requirePermission\s*\([^)]*permissionKey\s*:\s*PermissionKey/,
    );
  });

  test("accepts ScopeExtractor parameter", () => {
    // Should define and use a ScopeExtractor type for optional scope extraction
    expect(content).toContain("ScopeExtractor");
    expect(content).toMatch(
      /extractScope|scopeExtractor/i,
    );
  });

  test("handles board actors", () => {
    // Should check for actor.type === "board" and call canUser
    expect(content).toMatch(/actor\.type\s*===?\s*["']board["']/);
    expect(content).toContain("canUser");
  });

  test("handles agent actors", () => {
    // Should check for actor.type === "agent" and call hasPermission
    expect(content).toMatch(/actor\.type\s*===?\s*["']agent["']/);
    expect(content).toContain("agentId");
  });

  test("emits scope_denied event", () => {
    // Should emit/log access.scope_denied event
    expect(content).toContain("access.scope_denied");
  });
});

// ─── Group 6: Zod schemas ────────────────────────────────────────────────────

test.describe("Group 6: Zod schemas", () => {
  test("scopeSchema exported from shared/validators/access.ts", async () => {
    const content = await readFile(VALIDATORS_ACCESS, "utf-8");
    expect(content).toMatch(/export\s+(const|type)\s+scopeSchema/);
  });

  test("resourceScopeSchema exported from shared/validators/access.ts", async () => {
    const content = await readFile(VALIDATORS_ACCESS, "utf-8");
    expect(content).toMatch(
      /export\s+(const|type)\s+resourceScopeSchema/,
    );
  });

  test("PermissionScope type exported from shared/validators/access.ts", async () => {
    const content = await readFile(VALIDATORS_ACCESS, "utf-8");
    expect(content).toMatch(/export\s+type\s+PermissionScope/);
  });

  test("updateMemberPermissionsSchema uses scopeSchema (not generic z.record)", async () => {
    const content = await readFile(VALIDATORS_ACCESS, "utf-8");
    // The updateMemberPermissionsSchema should reference scopeSchema
    // instead of z.record(z.string(), z.unknown())
    const updateSchemaMatch = content.match(
      /updateMemberPermissionsSchema\s*=\s*z\.object\(\s*\{[\s\S]*?\}\s*\)/,
    );
    expect(updateSchemaMatch).toBeTruthy();
    const schemaBody = updateSchemaMatch![0];

    // Should use scopeSchema, not z.record
    expect(schemaBody).toContain("scopeSchema");
    expect(schemaBody).not.toMatch(
      /z\.record\s*\(\s*z\.string\(\)\s*,\s*z\.unknown\(\)\s*\)/,
    );
  });
});

// ─── Group 7: Re-exports from validators index ──────────────────────────────

test.describe("Group 7: Re-exports from validators index", () => {
  let indexContent: string;

  test.beforeAll(async () => {
    indexContent = await readFile(VALIDATORS_INDEX, "utf-8");
  });

  test("validators/index.ts re-exports scopeSchema", () => {
    expect(indexContent).toMatch(/scopeSchema/);
  });

  test("validators/index.ts re-exports resourceScopeSchema", () => {
    expect(indexContent).toMatch(/resourceScopeSchema/);
  });
});
