/**
 * PROJ-S01: Table project_memberships -- Service CRUD + Routes API -- E2E Tests
 *
 * These tests verify the deliverables of PROJ-S01:
 *   - Groupe 1: File existence (service, routes, validators)
 *   - Groupe 2: Service functions (addMember, removeMember, listMembers, etc.)
 *   - Groupe 3: Routes (GET, POST, DELETE, PATCH with proper middleware)
 *   - Groupe 4: Validators (Zod schemas with .strict())
 *   - Groupe 5: Permission enforcement (requirePermission on mutations)
 *   - Groupe 6: Activity log events (member_added, member_removed, role_changed)
 *   - Groupe 7: Error responses (conflict, notFound, forbidden, validation)
 *   - Groupe 8: Integration patterns (Drizzle, JOINs, validate middleware)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SERVICE_FILE = resolve(ROOT, "server/src/services/project-memberships.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/project-memberships.ts");
const VALIDATOR_FILE = resolve(ROOT, "packages/shared/src/validators/project-membership.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const VALIDATOR_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/project_memberships.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01-T06)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 — Service file exists: server/src/services/project-memberships.ts", async () => {
    await expect(
      fsAccess(SERVICE_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("T01b — Service file exports projectMembershipService", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+projectMembershipService\s*\(/);
  });

  test("T02 — Routes file exists: server/src/routes/project-memberships.ts", async () => {
    await expect(
      fsAccess(ROUTES_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("T02b — Routes file exports projectMembershipRoutes", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+projectMembershipRoutes\s*\(/);
  });

  test("T03 — Validator file exists: packages/shared/src/validators/project-membership.ts", async () => {
    await expect(
      fsAccess(VALIDATOR_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("T03b — Validator file exports addProjectMemberSchema and updateProjectMemberRoleSchema", async () => {
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    expect(content).toContain("addProjectMemberSchema");
    expect(content).toContain("updateProjectMemberRoleSchema");
  });

  test("T04 — Service barrel export: server/src/services/index.ts contains projectMembershipService", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toContain("projectMembershipService");
    expect(content).toMatch(/from\s+["']\.\/project-memberships/);
  });

  test("T05 — Validator barrel export: packages/shared/src/validators/index.ts contains project-membership exports", async () => {
    const content = await readFile(VALIDATOR_INDEX, "utf-8");
    expect(content).toContain("addProjectMemberSchema");
    expect(content).toContain("updateProjectMemberRoleSchema");
    expect(content).toMatch(/from\s+["']\.\/project-membership/);
  });

  test("T06 — Route registration: app.ts or routes/index.ts includes projectMembershipRoutes", async () => {
    // Check app.ts first, then routes/index.ts
    let found = false;

    try {
      const appContent = await readFile(APP_FILE, "utf-8");
      if (appContent.includes("projectMembershipRoutes")) {
        found = true;
      }
    } catch {
      // app.ts may not have it, check routes/index.ts
    }

    if (!found) {
      try {
        const routesIndexContent = await readFile(ROUTES_INDEX, "utf-8");
        if (routesIndexContent.includes("projectMembershipRoutes")) {
          found = true;
        }
      } catch {
        // routes/index.ts may not exist
      }
    }

    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Service functions (T07-T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Service functions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T07 — addMember function: inserts into project_memberships", () => {
    expect(content).toContain("addMember");
    // Should use db.insert for project_memberships
    expect(content).toMatch(/db\s*\n?\s*\.insert\(\s*projectMemberships\s*\)/);
  });

  test("T08 — removeMember function: deletes from project_memberships", () => {
    expect(content).toContain("removeMember");
    // Should use db.delete for project_memberships
    expect(content).toMatch(/db\s*\n?\s*\.delete\(\s*projectMemberships\s*\)/);
  });

  test("T09 — listMembers function: JOIN with authUsers", () => {
    expect(content).toContain("listMembers");
    // Should import and join with authUsers for user info
    expect(content).toContain("authUsers");
    expect(content).toMatch(/\.(leftJoin|innerJoin)\(\s*authUsers/);
  });

  test("T10 — listUserProjects function: JOIN with projects", () => {
    expect(content).toContain("listUserProjects");
    // Should join with projects to get project name
    expect(content).toMatch(/\.(leftJoin|innerJoin)\(\s*projects/);
  });

  test("T11 — isMember function: returns boolean", () => {
    expect(content).toContain("isMember");
    // Should have a boolean-returning check (Boolean(), !!result, result.length > 0, etc.)
    expect(content).toMatch(/(Boolean\(|!!|\.length\s*>|\.length\s*!==?\s*0)/);
  });

  test("T12 — updateMemberRole function: updates the role", () => {
    expect(content).toContain("updateMemberRole");
    // Should use db.update for project_memberships
    expect(content).toMatch(/db\s*\n?\s*\.update\(\s*projectMemberships\s*\)/);
  });

  test("T13 — Conflict handling: uses conflict() for duplicate key", () => {
    expect(content).toContain("conflict");
    expect(content).toContain("User is already a member of this project");
  });

  test("T14 — NotFound handling: uses notFound() for missing records", () => {
    expect(content).toContain("notFound");
    // Should handle both project not found and membership not found
    expect(content).toMatch(/notFound\(\s*["']/);
  });

  test("T15 — Project existence check: addMember verifies project exists before insert", () => {
    // The addMember function should query the projects table to verify the project exists
    expect(content).toMatch(/projects/);
    expect(content).toContain("Project not found");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Routes (T16-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Routes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T16 — GET list members route: /companies/:companyId/projects/:projectId/members", () => {
    expect(content).toMatch(
      /router\.get\(\s*["'].*companies\/:companyId\/projects\/:projectId\/members["']/,
    );
  });

  test("T17 — POST add member route: with requirePermission projects:manage_members", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*companies\/:companyId\/projects\/:projectId\/members["']/,
    );
    // POST route should have requirePermission with projects:manage_members
    expect(content).toMatch(/requirePermission\(\s*db\s*,\s*["']projects:manage_members["']\s*\)/);
  });

  test("T18 — DELETE remove member route: with requirePermission projects:manage_members", () => {
    expect(content).toMatch(
      /router\.delete\(\s*\n?\s*["'].*companies\/:companyId\/projects\/:projectId\/members\/:userId["']/,
    );
  });

  test("T19 — PATCH update role route: with requirePermission projects:manage_members", () => {
    expect(content).toMatch(
      /router\.patch\(\s*\n?\s*["'].*companies\/:companyId\/projects\/:projectId\/members\/:userId["']/,
    );
  });

  test("T20 — GET user projects route: /companies/:companyId/users/:userId/projects", () => {
    expect(content).toMatch(
      /router\.get\(\s*["'].*companies\/:companyId\/users\/:userId\/projects["']/,
    );
  });

  test("T21 — Company access check: all routes call assertCompanyAccess()", () => {
    expect(content).toContain("assertCompanyAccess");
    // Should be called at least 5 times (one per route)
    const occurrences = (content.match(/assertCompanyAccess\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(5);
  });

  test("T22 — Activity logging: mutations (POST, DELETE, PATCH) call logActivity()", () => {
    expect(content).toContain("logActivity");
    // Should be called at least 3 times (POST, DELETE, PATCH)
    const occurrences = (content.match(/logActivity\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Validators (T23-T26)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Validators", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T23 — addProjectMemberSchema: validates userId (string) and role (enum)", () => {
    expect(content).toContain("addProjectMemberSchema");
    // Should have userId as required string
    expect(content).toMatch(/userId\s*:\s*z\.string\(\)/);
    // Should have role as enum
    expect(content).toMatch(/role\s*:\s*z\.enum\(/);
  });

  test("T24 — updateProjectMemberRoleSchema: validates role (enum)", () => {
    expect(content).toContain("updateProjectMemberRoleSchema");
    expect(content).toMatch(/role\s*:\s*z\.enum\(/);
  });

  test("T25 — Roles enum: PROJECT_MEMBERSHIP_ROLES contains owner, manager, contributor, viewer", () => {
    expect(content).toContain("PROJECT_MEMBERSHIP_ROLES");
    expect(content).toContain('"owner"');
    expect(content).toContain('"manager"');
    expect(content).toContain('"contributor"');
    expect(content).toContain('"viewer"');
  });

  test("T26 — Strict mode: both schemas use .strict()", () => {
    // Count .strict() occurrences -- should be at least 2
    const strictOccurrences = (content.match(/\.strict\(\)/g) || []).length;
    expect(strictOccurrences).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Permission enforcement (T27-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Permission enforcement", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T27 — POST route uses requirePermission with projects:manage_members", () => {
    // Find the POST section and check it has requirePermission
    const postIdx = content.indexOf("router.post(");
    expect(postIdx).toBeGreaterThan(-1);
    const postSection = content.slice(postIdx, postIdx + 400);
    expect(postSection).toContain("requirePermission");
    expect(postSection).toContain('"projects:manage_members"');
  });

  test("T28 — DELETE route uses requirePermission with projects:manage_members", () => {
    const deleteIdx = content.indexOf("router.delete(");
    expect(deleteIdx).toBeGreaterThan(-1);
    const deleteSection = content.slice(deleteIdx, deleteIdx + 400);
    expect(deleteSection).toContain("requirePermission");
    expect(deleteSection).toContain('"projects:manage_members"');
  });

  test("T29 — PATCH route uses requirePermission with projects:manage_members", () => {
    const patchIdx = content.indexOf("router.patch(");
    expect(patchIdx).toBeGreaterThan(-1);
    const patchSection = content.slice(patchIdx, patchIdx + 400);
    expect(patchSection).toContain("requirePermission");
    expect(patchSection).toContain('"projects:manage_members"');
  });

  test("T30 — GET routes do NOT require projects:manage_members (read is open at company level)", () => {
    // Find each GET route and verify it does NOT have requirePermission in its middleware chain
    const getRoutes = [...content.matchAll(/router\.get\(\s*\n?\s*["'][^"']+["']\s*,/g)];
    expect(getRoutes.length).toBeGreaterThanOrEqual(2); // list members + user projects

    for (const match of getRoutes) {
      const getIdx = match.index!;
      // Look at the next ~300 chars after the route definition to check the middleware chain
      // (before the async (req, res) handler)
      const afterGet = content.slice(getIdx, getIdx + 300);
      const handlerIdx = afterGet.indexOf("async (req");
      if (handlerIdx > -1) {
        const middlewareSection = afterGet.slice(0, handlerIdx);
        expect(middlewareSection).not.toContain("requirePermission");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Activity log events (T31-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Activity log events", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T31 — POST route emits project.member_added event", () => {
    expect(content).toContain('"project.member_added"');
  });

  test("T32 — DELETE route emits project.member_removed event", () => {
    expect(content).toContain('"project.member_removed"');
  });

  test("T33 — PATCH route emits project.member_role_changed event", () => {
    expect(content).toContain('"project.member_role_changed"');
  });

  test("T34 — Events contain relevant details (userId, projectId)", () => {
    // Each logActivity call should include details with userId
    const logCalls = content.split("logActivity");
    // At least 3 logActivity calls (POST, DELETE, PATCH) plus the initial text
    expect(logCalls.length).toBeGreaterThanOrEqual(4);

    // Check the POST logActivity section includes userId in details
    const memberAddedIdx = content.indexOf('"project.member_added"');
    expect(memberAddedIdx).toBeGreaterThan(-1);
    const memberAddedSection = content.slice(memberAddedIdx, memberAddedIdx + 300);
    expect(memberAddedSection).toContain("userId");

    // Check the DELETE logActivity section includes userId in details
    const memberRemovedIdx = content.indexOf('"project.member_removed"');
    expect(memberRemovedIdx).toBeGreaterThan(-1);
    const memberRemovedSection = content.slice(memberRemovedIdx, memberRemovedIdx + 300);
    expect(memberRemovedSection).toContain("userId");

    // Check the PATCH logActivity section includes newRole
    const roleChangedIdx = content.indexOf('"project.member_role_changed"');
    expect(roleChangedIdx).toBeGreaterThan(-1);
    const roleChangedSection = content.slice(roleChangedIdx, roleChangedIdx + 300);
    expect(roleChangedSection).toContain("newRole");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Error responses (T35-T38)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Error responses", () => {
  let serviceContent: string;
  let routesContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
    routesContent = await readFile(ROUTES_FILE, "utf-8");
  });

  test('T35 — Conflict error: service uses conflict("User is already a member of this project")', () => {
    expect(serviceContent).toMatch(
      /conflict\(\s*["']User is already a member of this project["']\s*\)/,
    );
  });

  test('T36 — NotFound project: service uses notFound("Project not found")', () => {
    expect(serviceContent).toMatch(
      /notFound\(\s*["']Project not found["']\s*\)/,
    );
  });

  test('T37 — NotFound membership: service uses notFound("Membership not found")', () => {
    expect(serviceContent).toMatch(
      /notFound\(\s*["']Membership not found["']\s*\)/,
    );
  });

  test("T38 — Forbidden response: routes import requirePermission for 403 handling", () => {
    expect(routesContent).toMatch(
      /import\s+\{[^}]*requirePermission[^}]*\}\s+from\s+["']/,
    );
    // The requirePermission middleware generates "Missing permission: projects:manage_members"
    expect(routesContent).toContain('"projects:manage_members"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Integration patterns (T39-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Integration patterns", () => {
  let serviceContent: string;
  let routesContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
    routesContent = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T39 — Service uses Drizzle: db.select(), db.insert(), db.delete(), db.update()", () => {
    expect(serviceContent).toMatch(/db\s*\n?\s*\.select\(/);
    expect(serviceContent).toMatch(/db\s*\n?\s*\.insert\(/);
    expect(serviceContent).toMatch(/db\s*\n?\s*\.delete\(/);
    expect(serviceContent).toMatch(/db\s*\n?\s*\.update\(/);
  });

  test("T40 — listMembers does a LEFT JOIN with authUsers for user info enrichment", () => {
    // Should have a leftJoin with authUsers to get userName, userEmail, userImage
    expect(serviceContent).toMatch(/\.leftJoin\(\s*authUsers/);
    // Should select user fields
    expect(serviceContent).toMatch(/authUsers\.(name|email|image)/);
  });

  test("T41 — listUserProjects does an INNER JOIN with projects for project name", () => {
    // Should have an innerJoin with projects table
    expect(serviceContent).toMatch(/\.innerJoin\(\s*projects/);
    // Should select project name
    expect(serviceContent).toMatch(/projects\.(name|id)/);
  });

  test("T42 — Routes POST and PATCH use validate() middleware", () => {
    // POST route should use validate(addProjectMemberSchema)
    const postIdx = routesContent.indexOf("router.post(");
    expect(postIdx).toBeGreaterThan(-1);
    const postSection = routesContent.slice(postIdx, postIdx + 500);
    expect(postSection).toContain("validate(");
    expect(postSection).toContain("addProjectMemberSchema");

    // PATCH route should use validate(updateProjectMemberRoleSchema)
    const patchIdx = routesContent.indexOf("router.patch(");
    expect(patchIdx).toBeGreaterThan(-1);
    const patchSection = routesContent.slice(patchIdx, patchIdx + 500);
    expect(patchSection).toContain("validate(");
    expect(patchSection).toContain("updateProjectMemberRoleSchema");
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Schema verification (pre-existing from TECH-06)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Schema verification (TECH-06 prerequisite)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_FILE, "utf-8");
  });

  test("Schema file exists: packages/db/src/schema/project_memberships.ts", async () => {
    await expect(
      fsAccess(SCHEMA_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("Schema has projectId column", () => {
    expect(content).toContain('"project_id"');
  });

  test("Schema has userId column", () => {
    expect(content).toContain('"user_id"');
  });

  test("Schema has role column with default contributor", () => {
    expect(content).toContain('"role"');
    expect(content).toMatch(/default\(\s*["']contributor["']\s*\)/);
  });

  test("Schema has companyId column", () => {
    expect(content).toContain('"company_id"');
  });

  test("Schema has unique index on (companyId, projectId, userId)", () => {
    expect(content).toContain("project_memberships_company_project_user_unique_idx");
  });

  test("Schema has grantedBy column", () => {
    expect(content).toContain('"granted_by"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Service imports and patterns
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Service imports and patterns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("Service imports eq and and from drizzle-orm", () => {
    expect(content).toMatch(/import\s+\{[^}]*(eq|and)[^}]*\}\s+from\s+["']drizzle-orm["']/);
  });

  test("Service imports projectMemberships from @mnm/db", () => {
    expect(content).toContain("projectMemberships");
    expect(content).toMatch(/from\s+["']@mnm\/db["']/);
  });

  test("Service imports conflict and notFound from errors", () => {
    expect(content).toMatch(/import\s+\{[^}]*conflict[^}]*\}\s+from\s+["']/);
    expect(content).toMatch(/import\s+\{[^}]*notFound[^}]*\}\s+from\s+["']/);
  });

  test("Service function accepts db parameter of type Db", () => {
    expect(content).toMatch(/projectMembershipService\(\s*db\s*:\s*Db\s*\)/);
  });

  test("Service handles PostgreSQL unique constraint violation code 23505", () => {
    // Should catch the unique constraint error and throw conflict
    expect(content).toMatch(/(23505|duplicate|unique.*constraint|conflict)/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Routes imports and patterns
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Routes imports and patterns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("Routes imports Router from express", () => {
    expect(content).toMatch(/import\s+\{[^}]*Router[^}]*\}\s+from\s+["']express["']/);
  });

  test("Routes imports requirePermission", () => {
    expect(content).toContain("requirePermission");
  });

  test("Routes imports validate middleware", () => {
    expect(content).toContain("validate");
  });

  test("Routes imports assertCompanyAccess from authz", () => {
    expect(content).toContain("assertCompanyAccess");
    expect(content).toMatch(/from\s+["']\.\/authz/);
  });

  test("Routes imports getActorInfo from authz", () => {
    expect(content).toContain("getActorInfo");
  });

  test("Routes imports logActivity from services", () => {
    expect(content).toContain("logActivity");
  });

  test("Routes imports Zod schemas from @mnm/shared", () => {
    expect(content).toContain("addProjectMemberSchema");
    expect(content).toContain("updateProjectMemberRoleSchema");
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("Routes function accepts db parameter", () => {
    expect(content).toMatch(/projectMembershipRoutes\(\s*db\s*:\s*Db\s*\)/);
  });

  test("POST route returns 201 Created", () => {
    expect(content).toMatch(/res\.status\(\s*201\s*\)/);
  });

  test("Routes creates projectMembershipService instance with db", () => {
    expect(content).toContain("projectMembershipService(db)");
  });
});
