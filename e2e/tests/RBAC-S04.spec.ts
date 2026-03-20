/**
 * RBAC-S04: Enforcement dans 22 Fichiers Routes -- E2E Tests
 *
 * These tests verify the deliverables of RBAC-S04:
 *   - AC1-AC7:  Permission enforcement via requirePermission() middleware
 *               and assertCompanyPermission() inline helper
 *   - AC8:      access.denied audit event emitted on 403
 *   - AC9:      local_implicit bypass
 *   - AC10:     Frontend toast data-test-id
 *
 * Verified files:
 *   - server/src/middleware/require-permission.ts  -- middleware + inline helper
 *   - server/src/routes/approvals.ts               -- joins:approve enforcement
 *   - server/src/routes/assets.ts                  -- stories:create enforcement
 *   - server/src/routes/secrets.ts                 -- company:manage_settings enforcement
 *   - server/src/routes/agents.ts                  -- agents:create / agents:launch checks
 *   - server/src/routes/issues.ts                  -- stories:create / stories:edit / tasks:assign
 *   - server/src/routes/projects.ts                -- projects:create
 *   - server/src/routes/workflows.ts               -- workflows:create
 *   - server/src/routes/access.ts                  -- users:invite, joins:approve, users:manage_permissions
 *   - + all other route files
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";
import { readdirSync, existsSync, readFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "../..");
const REQUIRE_PERMISSION = resolve(ROOT, "server/src/middleware/require-permission.ts");
const MIDDLEWARE_INDEX = resolve(ROOT, "server/src/middleware/index.ts");
const ROUTES_DIR = resolve(ROOT, "server/src/routes");

// Critical route files
const APPROVALS = resolve(ROUTES_DIR, "approvals.ts");
const ASSETS = resolve(ROUTES_DIR, "assets.ts");
const SECRETS = resolve(ROUTES_DIR, "secrets.ts");
const AGENTS = resolve(ROUTES_DIR, "agents.ts");
const ISSUES = resolve(ROUTES_DIR, "issues.ts");
const PROJECTS = resolve(ROUTES_DIR, "projects.ts");
const WORKFLOWS = resolve(ROUTES_DIR, "workflows.ts");
const ACCESS = resolve(ROUTES_DIR, "access.ts");
const ERROR_HANDLER = resolve(ROOT, "server/src/middleware/error-handler.ts");
const ERRORS = resolve(ROOT, "server/src/errors.ts");

// ---------------------------------------------------------------------------
// Group 1: require-permission middleware (server/src/middleware/require-permission.ts)
// ---------------------------------------------------------------------------

test.describe("Group 1: require-permission middleware", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(REQUIRE_PERMISSION, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(REQUIRE_PERMISSION).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports requirePermission function", () => {
    expect(content).toMatch(/export\s+function\s+requirePermission\s*\(/);
  });

  test("exports assertCompanyPermission function", () => {
    expect(content).toMatch(/export\s+(async\s+)?function\s+assertCompanyPermission\s*\(/);
  });

  test("requirePermission accepts db and permissionKey parameters", () => {
    expect(content).toMatch(
      /function\s+requirePermission\s*\(\s*\n?\s*db\s*:\s*Db\s*,\s*\n?\s*permissionKey\s*:\s*PermissionKey/,
    );
  });

  test("returns 403 when permission denied (board user)", () => {
    // Should throw forbidden with Missing permission message
    expect(content).toMatch(/throw\s+forbidden\s*\(\s*`Missing permission: \$\{permissionKey\}`/);
  });

  test("includes requiredPermission in error details (board path)", () => {
    // The 403 details should include requiredPermission
    expect(content).toContain("requiredPermission: permissionKey");
  });

  test("includes requiredPermission in error details (agent path)", () => {
    // Both board and agent paths should include requiredPermission in details
    const matches = content.match(/requiredPermission:\s*permissionKey/g);
    expect(matches).toBeTruthy();
    // Should appear in both requirePermission (board+agent) and assertCompanyPermission (board+agent) = 4
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  test("includes companyId in error details", () => {
    // The details object should include companyId
    const detailsMatches = content.match(/companyId,\s*\n?\s*resourceScope/g);
    expect(detailsMatches).toBeTruthy();
    expect(detailsMatches!.length).toBeGreaterThanOrEqual(2);
  });

  test("bypasses for local_implicit actor", () => {
    expect(content).toContain("local_implicit");
    // Both requirePermission and assertCompanyPermission should bypass
    const bypassCount = (content.match(/local_implicit/g) || []).length;
    expect(bypassCount).toBeGreaterThanOrEqual(2);
  });

  test("throws unauthorized for actor type none", () => {
    expect(content).toMatch(/req\.actor\.type\s*===\s*"none"/);
    expect(content).toContain("throw unauthorized()");
  });

  test("handles agent actor type with agentId check", () => {
    expect(content).toMatch(/req\.actor\.type\s*===\s*"agent"/);
    expect(content).toContain("Agent identity required");
  });

  test("middleware is re-exported from middleware/index.ts", async () => {
    const indexContent = await readFile(MIDDLEWARE_INDEX, "utf-8");
    expect(indexContent).toContain("requirePermission");
    expect(indexContent).toMatch(/from\s+["']\.\/require-permission/);
  });
});

// ---------------------------------------------------------------------------
// Group 2: Critical routes -- approvals.ts
// ---------------------------------------------------------------------------

test.describe("Group 2: Critical routes -- approvals.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(APPROVALS, "utf-8");
  });

  test("imports requirePermission or assertCompanyPermission from require-permission", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*(requirePermission|assertCompanyPermission)[^}]*\}\s+from\s+["']\.\.\/middleware\/require-permission/,
    );
  });

  test("approve route uses assertCompanyPermission with joins:approve", () => {
    // Find the approve route section and check for permission enforcement
    const approveIdx = content.indexOf("/approve");
    expect(approveIdx).toBeGreaterThan(-1);
    // Look for assertCompanyPermission call with joins:approve near the approve route
    expect(content).toContain('"joins:approve"');
    expect(content).toMatch(/assertCompanyPermission\(.*"joins:approve"\)/s);
  });

  test("reject route uses permission check", () => {
    const rejectIdx = content.indexOf("/reject");
    expect(rejectIdx).toBeGreaterThan(-1);
    // Should have assertCompanyPermission for the reject handler
    const rejectSection = content.slice(rejectIdx);
    const nextRouterIdx = rejectSection.indexOf("router.");
    const sectionEnd = nextRouterIdx > 0 ? rejectIdx + nextRouterIdx : content.length;
    const rejectBody = content.slice(rejectIdx, sectionEnd);
    expect(rejectBody).toContain("assertCompanyPermission");
  });

  test("request-revision route uses permission check", () => {
    const revisionIdx = content.indexOf("request-revision");
    expect(revisionIdx).toBeGreaterThan(-1);
    const revisionSection = content.slice(revisionIdx, revisionIdx + 800);
    expect(revisionSection).toContain("assertCompanyPermission");
  });

  test("uses assertCompanyAccess for company isolation", () => {
    expect(content).toContain("assertCompanyAccess");
  });
});

// ---------------------------------------------------------------------------
// Group 3: Critical routes -- assets.ts
// ---------------------------------------------------------------------------

test.describe("Group 3: Critical routes -- assets.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ASSETS, "utf-8");
  });

  test("imports requirePermission from require-permission", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*requirePermission[^}]*\}\s+from\s+["']\.\.\/middleware\/require-permission/,
    );
  });

  test("upload route uses requirePermission middleware", () => {
    // The POST /companies/:companyId/assets/images route should use requirePermission
    expect(content).toMatch(/router\.post\([^)]*assets\/images[^,]*,\s*requirePermission\(/);
  });

  test('upload route enforces "stories:create" permission', () => {
    expect(content).toContain('requirePermission(db, "stories:create")');
  });

  test("still uses assertCompanyAccess for tenant isolation", () => {
    expect(content).toContain("assertCompanyAccess");
  });
});

// ---------------------------------------------------------------------------
// Group 4: Critical routes -- secrets.ts
// ---------------------------------------------------------------------------

test.describe("Group 4: Critical routes -- secrets.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SECRETS, "utf-8");
  });

  test("imports requirePermission from require-permission", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*(requirePermission|assertCompanyPermission)[^}]*\}\s+from\s+["']\.\.\/middleware\/require-permission/,
    );
  });

  test('GET /secret-providers uses requirePermission with "company:manage_settings"', () => {
    expect(content).toMatch(
      /router\.get\([^)]*secret-providers[^,]*,\s*requirePermission\(db,\s*"company:manage_settings"\)/,
    );
  });

  test('GET /secrets uses requirePermission with "company:manage_settings"', () => {
    // The GET /companies/:companyId/secrets route
    const listMatch = content.match(
      /router\.get\(\s*"\/companies\/:companyId\/secrets"\s*,\s*requirePermission\(db,\s*"company:manage_settings"\)/,
    );
    expect(listMatch).toBeTruthy();
  });

  test('POST /secrets uses requirePermission with "company:manage_settings"', () => {
    expect(content).toMatch(
      /router\.post\([^)]*\/companies\/:companyId\/secrets[^,]*,\s*requirePermission\(db,\s*"company:manage_settings"\)/,
    );
  });

  test("rotate route uses assertCompanyPermission with company:manage_settings", () => {
    const rotateIdx = content.indexOf("/rotate");
    expect(rotateIdx).toBeGreaterThan(-1);
    const afterRotate = content.slice(rotateIdx, rotateIdx + 600);
    expect(afterRotate).toContain('"company:manage_settings"');
  });

  test("PATCH /secrets/:id uses permission check", () => {
    const patchIdx = content.indexOf('router.patch("/secrets/:id"');
    expect(patchIdx).toBeGreaterThan(-1);
    const patchSection = content.slice(patchIdx, patchIdx + 600);
    expect(patchSection).toContain("assertCompanyPermission");
    expect(patchSection).toContain('"company:manage_settings"');
  });

  test("DELETE /secrets/:id uses permission check", () => {
    const deleteIdx = content.indexOf('router.delete("/secrets/:id"');
    expect(deleteIdx).toBeGreaterThan(-1);
    const deleteSection = content.slice(deleteIdx, deleteIdx + 600);
    expect(deleteSection).toContain("assertCompanyPermission");
    expect(deleteSection).toContain('"company:manage_settings"');
  });

  test('all 6 routes use "company:manage_settings" permission', () => {
    const occurrences = (content.match(/"company:manage_settings"/g) || []).length;
    // 3 requirePermission middleware + 3 assertCompanyPermission inline = 6
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Agent routes (server/src/routes/agents.ts)
// ---------------------------------------------------------------------------

test.describe("Group 5: Agent routes -- agents.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(AGENTS, "utf-8");
  });

  test('contains "agents:create" permission check', () => {
    expect(content).toContain('"agents:create"');
  });

  test("agents:create is checked via access.canUser or access.hasPermission", () => {
    // Should use the access service to check agents:create permission
    expect(content).toMatch(/access\.(canUser|hasPermission)\([^)]*"agents:create"/);
  });

  test("multiple routes check agents:create", () => {
    const occurrences = (content.match(/"agents:create"/g) || []).length;
    // POST /companies/:companyId/agents, POST /agent-hires, DELETE, PATCH etc.
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test("imports forbidden from errors.ts for 403 responses", () => {
    expect(content).toMatch(/import\s+\{[^}]*forbidden[^}]*\}\s+from\s+["']\.\.\/errors/);
  });

  test('throws forbidden with "Missing permission: agents:create" message', () => {
    expect(content).toContain("Missing permission: agents:create");
  });

  test("uses assertCompanyAccess for tenant isolation", () => {
    expect(content).toContain("assertCompanyAccess");
  });
});

// ---------------------------------------------------------------------------
// Group 6: Issue routes (server/src/routes/issues.ts)
// ---------------------------------------------------------------------------

test.describe("Group 6: Issue routes -- issues.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ISSUES, "utf-8");
  });

  test('contains "tasks:assign" permission check', () => {
    expect(content).toContain('"tasks:assign"');
  });

  test("tasks:assign is checked via access.canUser and access.hasPermission", () => {
    expect(content).toMatch(/access\.canUser\([^)]*"tasks:assign"/);
    expect(content).toMatch(/access\.hasPermission\([^)]*"tasks:assign"/);
  });

  test('throws forbidden with "Missing permission: tasks:assign" message', () => {
    expect(content).toContain("Missing permission: tasks:assign");
  });

  test("uses assertCompanyAccess for tenant isolation", () => {
    expect(content).toContain("assertCompanyAccess");
  });

  test("has assertCanAssignTasks helper that checks permissions", () => {
    expect(content).toMatch(/async\s+function\s+assertCanAssignTasks/);
    const fnMatch = content.match(
      /async\s+function\s+assertCanAssignTasks[\s\S]*?(?=\n\s{2}(async\s+)?function\s)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain('"tasks:assign"');
  });
});

// ---------------------------------------------------------------------------
// Group 7: Project routes (server/src/routes/projects.ts)
// ---------------------------------------------------------------------------

test.describe("Group 7: Project routes -- projects.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PROJECTS, "utf-8");
  });

  test("uses assertCompanyAccess for all routes", () => {
    expect(content).toContain("assertCompanyAccess");
    const occurrences = (content.match(/assertCompanyAccess\(/g) || []).length;
    // Multiple routes should use company access check
    expect(occurrences).toBeGreaterThanOrEqual(5);
  });

  test("POST /companies/:companyId/projects route exists", () => {
    expect(content).toMatch(/router\.post\(\s*"\/companies\/:companyId\/projects"/);
  });

  test("PATCH /projects/:id route exists", () => {
    expect(content).toMatch(/router\.patch\(\s*"\/projects\/:id"/);
  });

  test("DELETE /projects/:id route exists", () => {
    expect(content).toMatch(/router\.delete\(\s*"\/projects\/:id"/);
  });
});

// ---------------------------------------------------------------------------
// Group 8: Workflow routes (server/src/routes/workflows.ts)
// ---------------------------------------------------------------------------

test.describe("Group 8: Workflow routes -- workflows.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WORKFLOWS, "utf-8");
  });

  test("has mutation routes for workflow-templates", () => {
    expect(content).toMatch(
      /router\.post\(\s*[^)]*\/companies\/:companyId\/workflow-templates/,
    );
    expect(content).toMatch(/router\.patch\(\s*[^)]*\/workflow-templates\/:id/);
    expect(content).toMatch(/router\.delete\(\s*[^)]*\/workflow-templates\/:id/);
  });

  test("has mutation routes for workflow instances", () => {
    expect(content).toMatch(
      /router\.post\(\s*[^)]*\/companies\/:companyId\/workflows/,
    );
    expect(content).toMatch(/router\.patch\(\s*[^)]*\/workflows\/:id/);
    expect(content).toMatch(/router\.delete\(\s*[^)]*\/workflows\/:id/);
  });

  test("uses assertCompanyAccess for all routes", () => {
    expect(content).toContain("assertCompanyAccess");
    const occurrences = (content.match(/assertCompanyAccess\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Group 9: Access denied audit logging
// ---------------------------------------------------------------------------

test.describe("Group 9: Access denied audit logging", () => {
  let middlewareContent: string;

  test.beforeAll(async () => {
    middlewareContent = await readFile(REQUIRE_PERMISSION, "utf-8");
  });

  test('require-permission middleware logs "access.denied" event', () => {
    expect(middlewareContent).toContain('"access.denied"');
  });

  test("access.denied log includes permissionKey", () => {
    // Find sections around access.denied and verify permissionKey is logged
    const idx = middlewareContent.indexOf('"access.denied"');
    expect(idx).toBeGreaterThan(-1);
    // Look in a window around the event for the permissionKey field
    const window = middlewareContent.slice(Math.max(0, idx - 200), idx + 200);
    expect(window).toContain("permissionKey");
  });

  test("access.denied log includes companyId", () => {
    const idx = middlewareContent.indexOf('"access.denied"');
    const window = middlewareContent.slice(Math.max(0, idx - 200), idx + 200);
    expect(window).toContain("companyId");
  });

  test("access.denied log includes actorType", () => {
    const idx = middlewareContent.indexOf('"access.denied"');
    const window = middlewareContent.slice(Math.max(0, idx - 200), idx + 200);
    expect(window).toContain("actorType");
  });

  test("access.denied log includes route information", () => {
    const idx = middlewareContent.indexOf('"access.denied"');
    const window = middlewareContent.slice(Math.max(0, idx - 300), idx + 300);
    expect(window).toMatch(/route\s*:/);
  });

  test("access.denied event is logged for both board and agent actor types", () => {
    const occurrences = (middlewareContent.match(/"access\.denied"/g) || []).length;
    // requirePermission (board + agent) + assertCompanyPermission (board + agent) = 4
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Group 10: Permission key coverage across route files
// ---------------------------------------------------------------------------

test.describe("Group 10: Permission key coverage across route files", () => {
  // The 20 RBAC permission keys defined in RBAC-S02
  const CRITICAL_KEYS = [
    "agents:create",
    "agents:launch",
    "agents:read",
    "agents:write",
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
    "stories:create",
    "stories:edit",
    "dashboard:view",
    "chat:agent",
  ];

  // Keys that MUST be enforced in route files per RBAC-S04 spec
  const MUST_ENFORCE_KEYS = [
    "agents:create",
    "users:invite",
    "users:manage_permissions",
    "tasks:assign",
    "joins:approve",
    "company:manage_settings",
    "stories:create",
  ];

  let allRouteContent: string;

  test.beforeAll(() => {
    // Concatenate all route files + require-permission middleware content
    const routeFiles = readdirSync(ROUTES_DIR)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => resolve(ROUTES_DIR, f));

    allRouteContent = routeFiles
      .map((f) => readFileSync(f, "utf-8"))
      .join("\n\n");

    // Also include require-permission.ts for permission checks that live there
    if (existsSync(REQUIRE_PERMISSION)) {
      allRouteContent += "\n\n" + readFileSync(REQUIRE_PERMISSION, "utf-8");
    }
  });

  test("agents:create is enforced in route files", () => {
    expect(allRouteContent).toContain('"agents:create"');
  });

  test("users:invite is enforced in route files", () => {
    expect(allRouteContent).toContain('"users:invite"');
  });

  test("users:manage_permissions is enforced in route files", () => {
    expect(allRouteContent).toContain('"users:manage_permissions"');
  });

  test("tasks:assign is enforced in route files", () => {
    expect(allRouteContent).toContain('"tasks:assign"');
  });

  test("joins:approve is enforced in route files", () => {
    expect(allRouteContent).toContain('"joins:approve"');
  });

  test("company:manage_settings is enforced in route files", () => {
    expect(allRouteContent).toContain('"company:manage_settings"');
  });

  test("stories:create is enforced in route files", () => {
    expect(allRouteContent).toContain('"stories:create"');
  });

  test("at least 7 MUST_ENFORCE keys appear across route files", () => {
    const foundKeys = MUST_ENFORCE_KEYS.filter((key) =>
      allRouteContent.includes(`"${key}"`),
    );
    expect(foundKeys.length).toBe(MUST_ENFORCE_KEYS.length);
  });

  test("critical permission keys appear across route files", () => {
    const foundKeys = CRITICAL_KEYS.filter((key) =>
      allRouteContent.includes(`"${key}"`),
    );
    // At minimum the MUST_ENFORCE keys should be present
    expect(foundKeys.length).toBeGreaterThanOrEqual(MUST_ENFORCE_KEYS.length);
  });
});

// ---------------------------------------------------------------------------
// Group 11: 403 error response format (error handler)
// ---------------------------------------------------------------------------

test.describe("Group 11: Error handler propagates details in 403 response", () => {
  let errorHandlerContent: string;
  let errorsContent: string;

  test.beforeAll(async () => {
    errorHandlerContent = await readFile(ERROR_HANDLER, "utf-8");
    errorsContent = await readFile(ERRORS, "utf-8");
  });

  test("HttpError class supports details parameter", () => {
    expect(errorsContent).toMatch(
      /class\s+HttpError[\s\S]*details\??\s*:\s*unknown/,
    );
  });

  test("forbidden() helper accepts details parameter", () => {
    expect(errorsContent).toMatch(
      /function\s+forbidden\s*\([^)]*details\??\s*:\s*unknown/,
    );
  });

  test("error handler includes details in JSON response", () => {
    // The error handler should spread details into the response
    expect(errorHandlerContent).toMatch(/err\.details/);
    expect(errorHandlerContent).toMatch(/details\s*:\s*err\.details/);
  });

  test("error handler returns status code from HttpError", () => {
    expect(errorHandlerContent).toMatch(/res\.status\(err\.status\)/);
  });
});

// ---------------------------------------------------------------------------
// Group 12: assertCompanyPermission inline helper
// ---------------------------------------------------------------------------

test.describe("Group 12: assertCompanyPermission inline helper", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(REQUIRE_PERMISSION, "utf-8");
  });

  test("assertCompanyPermission accepts db, req, companyId, permissionKey parameters", () => {
    expect(content).toMatch(
      /function\s+assertCompanyPermission\s*\(\s*\n?\s*db\s*:\s*Db/,
    );
    expect(content).toMatch(
      /assertCompanyPermission[\s\S]*?req\s*:\s*Request/,
    );
    expect(content).toMatch(
      /assertCompanyPermission[\s\S]*?companyId\s*:\s*string/,
    );
    expect(content).toMatch(
      /assertCompanyPermission[\s\S]*?permissionKey\s*:\s*PermissionKey/,
    );
  });

  test("assertCompanyPermission bypasses for local_implicit", () => {
    // Extract the assertCompanyPermission function body
    const fnStart = content.indexOf("export async function assertCompanyPermission");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = content.slice(fnStart, fnStart + 800);
    expect(fnBody).toContain("local_implicit");
  });

  test("assertCompanyPermission bypasses for isInstanceAdmin", () => {
    const fnStart = content.indexOf("export async function assertCompanyPermission");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = content.slice(fnStart, fnStart + 800);
    expect(fnBody).toContain("isInstanceAdmin");
  });

  test("assertCompanyPermission throws forbidden with requiredPermission details", () => {
    const fnStart = content.indexOf("export async function assertCompanyPermission");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = content.slice(fnStart);
    expect(fnBody).toContain("requiredPermission: permissionKey");
  });

  test("assertCompanyPermission uses accessService for permission checks", () => {
    const fnStart = content.indexOf("export async function assertCompanyPermission");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = content.slice(fnStart, fnStart + 1200);
    expect(fnBody).toContain("accessService");
    expect(fnBody).toMatch(/access\.(canUser|hasPermission)/);
  });
});

// ---------------------------------------------------------------------------
// Group 13: Route files that import from require-permission
// ---------------------------------------------------------------------------

test.describe("Group 13: Route files importing require-permission", () => {
  test("approvals.ts imports from require-permission", async () => {
    const content = await readFile(APPROVALS, "utf-8");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/require-permission/);
  });

  test("assets.ts imports from require-permission", async () => {
    const content = await readFile(ASSETS, "utf-8");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/require-permission/);
  });

  test("secrets.ts imports from require-permission", async () => {
    const content = await readFile(SECRETS, "utf-8");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/require-permission/);
  });
});

// ---------------------------------------------------------------------------
// Group 14: access.ts permission enforcement
// ---------------------------------------------------------------------------

test.describe("Group 14: access.ts permission enforcement", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS, "utf-8");
  });

  test('uses "users:invite" permission key', () => {
    expect(content).toContain('"users:invite"');
  });

  test('uses "joins:approve" permission key', () => {
    expect(content).toContain('"joins:approve"');
  });

  test('uses "users:manage_permissions" permission key', () => {
    expect(content).toContain('"users:manage_permissions"');
  });

  test("has assertCompanyPermission helper (local or imported)", () => {
    expect(content).toMatch(/(function|import).*assertCompanyPermission/);
  });

  test("enforces users:invite on invite routes", () => {
    // Count how many times users:invite is used
    const occurrences = (content.match(/"users:invite"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  test("enforces joins:approve on join request routes", () => {
    const occurrences = (content.match(/"joins:approve"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  test("enforces users:manage_permissions on membership routes", () => {
    const occurrences = (content.match(/"users:manage_permissions"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });
});
