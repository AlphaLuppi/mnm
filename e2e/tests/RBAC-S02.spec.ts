/**
 * RBAC-S02: 9 Permission Keys + Presets par Role -- E2E Tests
 *
 * These tests verify the deliverables of RBAC-S02:
 *   - AC-01: PERMISSION_KEYS array has 20 entries (15 original + 5 new)
 *   - AC-02: New permission keys: agents:launch, stories:create, stories:edit, dashboard:view, chat:agent
 *   - AC-03: ROLE_PERMISSION_PRESETS exported from rbac-presets.ts
 *   - AC-04: isPermissionInPreset helper exported from rbac-presets.ts
 *   - AC-05: Presets for all 4 business roles (admin, manager, contributor, viewer)
 *   - AC-06: hasPermission fallback on businessRole preset
 *   - AC-07: getEffectivePermissions helper in access service
 *   - AC-08: GET /rbac/presets endpoint returns presets
 *   - AC-09: GET /companies/:companyId/members/:memberId/effective-permissions endpoint
 *   - AC-10: Re-exports from shared/index.ts
 *
 * Source files:
 *   - packages/shared/src/constants.ts -- PERMISSION_KEYS (20 entries)
 *   - packages/shared/src/rbac-presets.ts -- ROLE_PERMISSION_PRESETS, isPermissionInPreset
 *   - packages/shared/src/index.ts -- re-exports
 *   - server/src/services/access.ts -- hasPermission fallback, getEffectivePermissions
 *   - server/src/routes/access.ts -- GET /rbac/presets, GET effective-permissions
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CONSTANTS = resolve(ROOT, "packages/shared/src/constants.ts");
const RBAC_PRESETS = resolve(ROOT, "packages/shared/src/rbac-presets.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const ACCESS_SERVICE = resolve(ROOT, "server/src/services/access.ts");
const ACCESS_ROUTES = resolve(ROOT, "server/src/routes/access.ts");

// --- Group 1: Permission keys (packages/shared/src/constants.ts) -----------

test.describe("Group 1: PERMISSION_KEYS has 20 entries", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS, "utf-8");
  });

  test("PERMISSION_KEYS array exists", () => {
    expect(content).toMatch(/export\s+const\s+PERMISSION_KEYS\s*=\s*\[/);
  });

  test("PERMISSION_KEYS has exactly 20 entries", () => {
    // Extract the PERMISSION_KEYS array content
    const match = content.match(
      /PERMISSION_KEYS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
    );
    expect(match).toBeTruthy();
    const arrayBody = match![1];
    // Count quoted string entries
    const entries = arrayBody.match(/"[^"]+"/g);
    expect(entries).toBeTruthy();
    expect(entries!.length).toBe(20);
  });

  test('contains new key "agents:launch"', () => {
    expect(content).toContain('"agents:launch"');
  });

  test('contains new key "stories:create"', () => {
    expect(content).toContain('"stories:create"');
  });

  test('contains new key "stories:edit"', () => {
    expect(content).toContain('"stories:edit"');
  });

  test('contains new key "dashboard:view"', () => {
    expect(content).toContain('"dashboard:view"');
  });

  test('contains new key "chat:agent"', () => {
    expect(content).toContain('"chat:agent"');
  });

  test("still contains the original 15 keys", () => {
    const originalKeys = [
      "agents:create",
      "users:invite",
      "users:manage_permissions",
      "tasks:assign",
      "tasks:assign_scope",
      "joins:approve",
      "projects:create",
      "projects:manage_members",
      "workflows:create",
      "workflows:enforce",
      "agents:manage_containers",
      "company:manage_settings",
      "company:manage_sso",
      "audit:read",
      "audit:export",
    ];
    for (const key of originalKeys) {
      expect(content).toContain(`"${key}"`);
    }
  });
});

// --- Group 2: RBAC presets (packages/shared/src/rbac-presets.ts) ------------

test.describe("Group 2: RBAC presets file", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(RBAC_PRESETS, "utf-8");
  });

  test("rbac-presets.ts file exists", async () => {
    await expect(
      fsAccess(RBAC_PRESETS).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports ROLE_PERMISSION_PRESETS", () => {
    expect(content).toMatch(/export\s+(const\s+)?ROLE_PERMISSION_PRESETS/);
  });

  test("exports isPermissionInPreset function", () => {
    expect(content).toMatch(/export\s+function\s+isPermissionInPreset/);
  });

  test("has preset for admin role", () => {
    expect(content).toMatch(/admin\s*:/);
  });

  test("has preset for manager role", () => {
    expect(content).toMatch(/manager\s*:/);
  });

  test("has preset for contributor role", () => {
    expect(content).toMatch(/contributor\s*:/);
  });

  test("has preset for viewer role", () => {
    expect(content).toMatch(/viewer\s*:/);
  });

  test("admin has most/all permissions (broad access)", () => {
    // Extract admin preset array
    const adminMatch = content.match(
      /admin\s*:\s*\[([\s\S]*?)\]/,
    );
    expect(adminMatch).toBeTruthy();
    const adminPerms = adminMatch![1].match(/"[^"]+"/g);
    expect(adminPerms).toBeTruthy();
    // Admin should have the most permissions -- at least 15
    expect(adminPerms!.length).toBeGreaterThanOrEqual(15);
  });

  test("viewer has fewest permissions (audit:read and dashboard:view)", () => {
    // Extract viewer preset array
    const viewerMatch = content.match(
      /viewer\s*:\s*\[([\s\S]*?)\]/,
    );
    expect(viewerMatch).toBeTruthy();
    const viewerBody = viewerMatch![1];
    expect(viewerBody).toContain('"audit:read"');
    expect(viewerBody).toContain('"dashboard:view"');
    // Viewer should have very few permissions
    const viewerPerms = viewerBody.match(/"[^"]+"/g);
    expect(viewerPerms).toBeTruthy();
    expect(viewerPerms!.length).toBeLessThanOrEqual(4);
  });

  test("contributor has agents:launch, stories:create, stories:edit", () => {
    // Extract contributor preset array
    const contribMatch = content.match(
      /contributor\s*:\s*\[([\s\S]*?)\]/,
    );
    expect(contribMatch).toBeTruthy();
    const contribBody = contribMatch![1];
    expect(contribBody).toContain('"agents:launch"');
    expect(contribBody).toContain('"stories:create"');
    expect(contribBody).toContain('"stories:edit"');
  });

  test("manager has more permissions than contributor but fewer than admin", () => {
    const adminMatch = content.match(/admin\s*:\s*\[([\s\S]*?)\]/);
    const managerMatch = content.match(/manager\s*:\s*\[([\s\S]*?)\]/);
    const contribMatch = content.match(/contributor\s*:\s*\[([\s\S]*?)\]/);
    expect(adminMatch).toBeTruthy();
    expect(managerMatch).toBeTruthy();
    expect(contribMatch).toBeTruthy();

    const adminCount = adminMatch![1].match(/"[^"]+"/g)?.length ?? 0;
    const managerCount = managerMatch![1].match(/"[^"]+"/g)?.length ?? 0;
    const contribCount = contribMatch![1].match(/"[^"]+"/g)?.length ?? 0;

    expect(managerCount).toBeGreaterThan(contribCount);
    expect(managerCount).toBeLessThanOrEqual(adminCount);
  });

  test("manager does NOT have company:manage_sso", () => {
    const managerMatch = content.match(
      /manager\s*:\s*\[([\s\S]*?)\]/,
    );
    expect(managerMatch).toBeTruthy();
    expect(managerMatch![1]).not.toContain('"company:manage_sso"');
  });

  test("manager does NOT have users:manage_permissions", () => {
    const managerMatch = content.match(
      /manager\s*:\s*\[([\s\S]*?)\]/,
    );
    expect(managerMatch).toBeTruthy();
    expect(managerMatch![1]).not.toContain('"users:manage_permissions"');
  });
});

// --- Group 3: Re-exports (packages/shared/src/index.ts) --------------------

test.describe("Group 3: Re-exports from shared/index.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SHARED_INDEX, "utf-8");
  });

  test("re-exports ROLE_PERMISSION_PRESETS", () => {
    expect(content).toContain("ROLE_PERMISSION_PRESETS");
  });

  test("re-exports isPermissionInPreset", () => {
    expect(content).toContain("isPermissionInPreset");
  });
});

// --- Group 4: hasPermission fallback (server/src/services/access.ts) -------

test.describe("Group 4: hasPermission fallback on businessRole", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("imports isPermissionInPreset from @mnm/shared", () => {
    expect(content).toContain("isPermissionInPreset");
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("imports BusinessRole type", () => {
    expect(content).toContain("BusinessRole");
  });

  test("hasPermission queries companyMemberships for businessRole", () => {
    // Extract hasPermission function body
    const fnMatch = content.match(
      /async\s+function\s+hasPermission\s*\([\s\S]*?(?=\n\s{2}async\s+function\s)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    // Should reference businessRole from membership
    expect(fnBody).toContain("businessRole");
  });

  test("hasPermission uses isPermissionInPreset as fallback", () => {
    // Extract hasPermission function body
    const fnMatch = content.match(
      /async\s+function\s+hasPermission\s*\([\s\S]*?(?=\n\s{2}async\s+function\s)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("isPermissionInPreset");
  });
});

// --- Group 5: getEffectivePermissions (server/src/services/access.ts) ------

test.describe("Group 5: getEffectivePermissions helper", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("getEffectivePermissions function exists", () => {
    expect(content).toMatch(
      /async\s+function\s+getEffectivePermissions\s*\(/,
    );
  });

  test("getEffectivePermissions uses getPresetPermissions", () => {
    // Extract getEffectivePermissions function body
    const fnMatch = content.match(
      /async\s+function\s+getEffectivePermissions[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toMatch(/getPresetPermissions|isPermissionInPreset/);
  });

  test("getEffectivePermissions returns preset, grants, and effective arrays", () => {
    const fnMatch = content.match(
      /async\s+function\s+getEffectivePermissions[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("preset");
    expect(fnBody).toContain("grants");
    expect(fnBody).toContain("effective");
  });

  test("getEffectivePermissions is exported in the accessService return object", () => {
    // Look for the final return block in accessService that lists all exports
    // Use greedy match to capture the last return { ... } in the file
    const returnMatches = [...content.matchAll(/return\s*\{[^}]+\}/g)];
    expect(returnMatches.length).toBeGreaterThan(0);
    // The last return { ... } in the file is the accessService export object
    const lastReturn = returnMatches[returnMatches.length - 1][0];
    expect(lastReturn).toContain("getEffectivePermissions");
  });
});

// --- Group 6: API endpoints (server/src/routes/access.ts) ------------------

test.describe("Group 6: API endpoints", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("GET /rbac/presets endpoint exists", () => {
    expect(content).toMatch(/router\.get\s*\(\s*["'][^"']*rbac\/presets["']/);
  });

  test("GET /rbac/presets returns the presets matrix", () => {
    // Find the presets route section
    const presetsIdx = content.indexOf("rbac/presets");
    expect(presetsIdx).toBeGreaterThan(-1);
    // Look nearby for getPresetsMatrix() call
    const nearbyContent = content.slice(presetsIdx, presetsIdx + 500);
    expect(nearbyContent).toContain("getPresetsMatrix");
  });

  test("GET effective-permissions endpoint exists", () => {
    expect(content).toMatch(
      /router\.get\s*\(\s*["'][^"']*effective-permissions/,
    );
  });

  test("effective-permissions uses assertCompanyPermission with users:manage_permissions", () => {
    const epIdx = content.indexOf("effective-permissions");
    expect(epIdx).toBeGreaterThan(-1);
    // Use a larger window to capture the full endpoint handler
    const nearbyContent = content.slice(epIdx, epIdx + 1500);
    expect(nearbyContent).toContain("assertCompanyPermission");
    expect(nearbyContent).toContain("users:manage_permissions");
  });

  test("imports getPresetsMatrix from @mnm/shared", () => {
    expect(content).toContain("getPresetsMatrix");
  });
});
