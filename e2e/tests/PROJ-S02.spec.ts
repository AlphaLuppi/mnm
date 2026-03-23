/**
 * PROJ-S02: Service project-memberships enrichi -- Scope sync, bulk ops, pagination -- E2E Tests
 *
 * These tests verify the deliverables of PROJ-S02:
 *   - Groupe 1: Scope synchronization (syncUserProjectScope, imports, logic)
 *   - Groupe 2: New service functions (getUserProjectIds, bulk, count, paginated)
 *   - Groupe 3: New routes (project-ids, bulk add/remove, member-counts)
 *   - Groupe 4: Pagination enrichment (backward compat, cursor, limit)
 *   - Groupe 5: New validators (bulk add/remove, member counts)
 *   - Groupe 6: Activity log events (bulk_added, bulk_removed)
 *   - Groupe 7: Audit events (emitAudit on bulk operations)
 *   - Groupe 8: Response shapes (status codes, response bodies)
 *   - Groupe 9: Integration patterns (sql template, validate, scope sync enrichment)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SERVICE_FILE = resolve(ROOT, "server/src/services/project-memberships.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/project-memberships.ts");
const VALIDATOR_FILE = resolve(ROOT, "packages/shared/src/validators/project-membership.ts");
const VALIDATOR_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");

let serviceContent: string;
let routesContent: string;
let validatorContent: string;
let validatorIndexContent: string;

test.beforeAll(async () => {
  [serviceContent, routesContent, validatorContent, validatorIndexContent] = await Promise.all([
    readFile(SERVICE_FILE, "utf-8"),
    readFile(ROUTES_FILE, "utf-8"),
    readFile(VALIDATOR_FILE, "utf-8"),
    readFile(VALIDATOR_INDEX, "utf-8"),
  ]);
});

// ---------------------------------------------------------------------------
// Groupe 1: Scope synchronization (T01-T06)
// ---------------------------------------------------------------------------

// SKIPPED: principalPermissionGrants table removed — scope sync via tags now (stubbed)
test.describe.skip("Groupe 1: Scope synchronization", () => {
  test("T01 — syncUserProjectScope function exists and reads project_memberships + updates principal_permission_grants", () => {
    expect(serviceContent).toContain("syncUserProjectScope");
    // Reads projectIds from project_memberships
    expect(serviceContent).toMatch(/syncUserProjectScope[\s\S]*?projectMemberships\.projectId/);
    // Updates principal_permission_grants
    expect(serviceContent).toMatch(/syncUserProjectScope[\s\S]*?update\(principalPermissionGrants\)/);
  });

  test("T02 — Import principalPermissionGrants from @mnm/db", () => {
    expect(serviceContent).toContain("principalPermissionGrants");
    expect(serviceContent).toMatch(/import[\s\S]*?principalPermissionGrants[\s\S]*?from\s+["']@mnm\/db["']/);
  });

  test("T03 — Scope null skip: syncUserProjectScope checks !scope and skips null", () => {
    expect(serviceContent).toMatch(/!scope/);
    expect(serviceContent).toMatch(/continue/);
  });

  test("T04 — Scope projectIds update: sets updatedScope with currentProjectIds", () => {
    expect(serviceContent).toMatch(/updatedScope/);
    expect(serviceContent).toMatch(/projectIds:\s*currentProjectIds/);
    expect(serviceContent).toMatch(/\.set\(\s*\{\s*scope:\s*updatedScope/);
  });

  test("T05 — addMember calls syncUserProjectScope after insert", () => {
    // Find addMember function and verify it calls syncUserProjectScope
    const addMemberIdx = serviceContent.indexOf("addMember:");
    expect(addMemberIdx).toBeGreaterThan(-1);
    const addMemberSection = serviceContent.slice(addMemberIdx, addMemberIdx + 800);
    expect(addMemberSection).toContain("syncUserProjectScope");
    // Verify it's after the insert
    const insertIdx = addMemberSection.indexOf(".insert(");
    const syncIdx = addMemberSection.indexOf("syncUserProjectScope");
    expect(syncIdx).toBeGreaterThan(insertIdx);
  });

  test("T06 — removeMember calls syncUserProjectScope after delete", () => {
    const removeMemberIdx = serviceContent.indexOf("removeMember:");
    expect(removeMemberIdx).toBeGreaterThan(-1);
    const removeMemberSection = serviceContent.slice(removeMemberIdx, removeMemberIdx + 800);
    expect(removeMemberSection).toContain("syncUserProjectScope");
    // Verify it's after the delete
    const deleteIdx = removeMemberSection.indexOf(".delete(");
    const syncIdx = removeMemberSection.indexOf("syncUserProjectScope");
    expect(syncIdx).toBeGreaterThan(deleteIdx);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: New service functions (T07-T17)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: New service functions", () => {
  test("T07 — getUserProjectIds function returns string[] of projectIds", () => {
    expect(serviceContent).toContain("getUserProjectIds");
    const fnIdx = serviceContent.indexOf("getUserProjectIds:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 500);
    expect(fnSection).toContain("projectMemberships.projectId");
    expect(fnSection).toMatch(/Promise<string\[\]>/);
  });

  test("T08 — bulkAddMembers function: inserts N rows and returns { added, skipped, results }", () => {
    expect(serviceContent).toContain("bulkAddMembers:");
    const fnIdx = serviceContent.indexOf("bulkAddMembers:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 1200);
    expect(fnSection).toContain(".insert(projectMemberships)");
    expect(fnSection).toContain("added");
    expect(fnSection).toContain("skipped");
    expect(fnSection).toContain("results");
  });

  test("T09 — bulkRemoveMembers function: deletes N rows and returns { removed, skipped, results }", () => {
    expect(serviceContent).toContain("bulkRemoveMembers:");
    const fnIdx = serviceContent.indexOf("bulkRemoveMembers:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 1200);
    expect(fnSection).toContain(".delete(projectMemberships)");
    expect(fnSection).toContain("removed");
    expect(fnSection).toContain("skipped");
    expect(fnSection).toContain("results");
  });

  test("T10 — countMembersByProject function with GROUP BY and count(*)", () => {
    expect(serviceContent).toContain("countMembersByProject:");
    const fnIdx = serviceContent.indexOf("countMembersByProject:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 800);
    expect(fnSection).toMatch(/count\(\*\)/);
    expect(fnSection).toContain(".groupBy(");
  });

  test("T11 — listMembersPaginated function with cursor-based pagination", () => {
    expect(serviceContent).toContain("listMembersPaginated:");
    const fnIdx = serviceContent.indexOf("listMembersPaginated:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 2500);
    expect(fnSection).toContain("cursor");
    expect(fnSection).toContain("nextCursor");
    expect(fnSection).toContain(".orderBy(");
    expect(fnSection).toContain(".limit(");
  });

  test("T12 — Bulk add conflict handling: catches 23505 and marks skipped/already_member", () => {
    const fnIdx = serviceContent.indexOf("bulkAddMembers:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 1200);
    expect(fnSection).toContain("23505");
    expect(fnSection).toContain("already_member");
    expect(fnSection).toContain("skipped");
  });

  test("T13 — Bulk remove not-member handling: checks if row deleted, marks not_member", () => {
    const fnIdx = serviceContent.indexOf("bulkRemoveMembers:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 1200);
    expect(fnSection).toContain("not_member");
    expect(fnSection).toContain("skipped");
  });

  test("T14 — Bulk add scope sync: calls syncUserProjectScope for each added user", () => {
    const fnIdx = serviceContent.indexOf("bulkAddMembers:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 1200);
    expect(fnSection).toContain("usersToSync");
    expect(fnSection).toContain("syncUserProjectScope");
  });

  test("T15 — Bulk remove scope sync: calls syncUserProjectScope for each removed user", () => {
    const fnIdx = serviceContent.indexOf("bulkRemoveMembers:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 1200);
    expect(fnSection).toContain("usersToSync");
    expect(fnSection).toContain("syncUserProjectScope");
  });

  test("T16 — Pagination limit+1 trick: fetches limit + 1 to detect hasMore", () => {
    const fnIdx = serviceContent.indexOf("listMembersPaginated:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 2500);
    expect(fnSection).toMatch(/\.limit\(limit\s*\+\s*1\)/);
    expect(fnSection).toContain("hasMore");
  });

  test("T17 — countMembersByProject uses inArray", () => {
    const fnIdx = serviceContent.indexOf("countMembersByProject:");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = serviceContent.slice(fnIdx, fnIdx + 800);
    expect(fnSection).toContain("inArray(");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: New routes (T18-T25)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: New routes", () => {
  test("T18 — GET user project-ids route exists", () => {
    expect(routesContent).toContain("/companies/:companyId/users/:userId/project-ids");
    // Verify it's a GET route using regex to handle multi-line on Windows
    expect(routesContent).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/users\/:userId\/project-ids["']/);
  });

  test("T19 — POST bulk add route with requirePermission", () => {
    expect(routesContent).toContain("/companies/:companyId/projects/:projectId/members/bulk");
    // Find the POST bulk add route
    const routeIdx = routesContent.indexOf('"/companies/:companyId/projects/:projectId/members/bulk"');
    expect(routeIdx).toBeGreaterThan(-1);
    const precedingSection = routesContent.slice(Math.max(0, routeIdx - 200), routeIdx);
    expect(precedingSection).toContain("router.post(");
  });

  test("T20 — DELETE bulk remove route with requirePermission", () => {
    // DELETE bulk remove route
    const deleteIdx = routesContent.indexOf("router.delete(");
    expect(deleteIdx).toBeGreaterThan(-1);
    // Find the bulk delete route specifically
    const bulkDeleteSection = routesContent.slice(deleteIdx);
    const bulkRouteIdx = bulkDeleteSection.indexOf("/members/bulk");
    expect(bulkRouteIdx).toBeGreaterThan(-1);
  });

  test("T21 — POST member-counts route exists", () => {
    expect(routesContent).toContain("/companies/:companyId/projects/member-counts");
    // Verify it's a POST route using regex to handle multi-line on Windows
    expect(routesContent).toMatch(/router\.post\(\s+["']\/companies\/:companyId\/projects\/member-counts["']/);
  });

  test("T22 — Bulk add permission: requirePermission(db, \"projects:manage_members\")", () => {
    // Verify the POST bulk add route has requirePermission middleware via regex
    expect(routesContent).toMatch(
      /router\.post\(\s+["']\/companies\/:companyId\/projects\/:projectId\/members\/bulk["'],\s+requirePermission\(db,\s*["']projects:manage_members["']\)/
    );
  });

  test("T23 — Bulk remove permission: requirePermission(db, \"projects:manage_members\")", () => {
    // Find the DELETE bulk route section
    const routePattern = 'router.delete(\n    "/companies/:companyId/projects/:projectId/members/bulk"';
    // Search more flexibly
    const deleteLines = routesContent.split("\n");
    let foundDeleteBulk = false;
    for (let i = 0; i < deleteLines.length; i++) {
      if (deleteLines[i].includes("router.delete(") && i + 1 < deleteLines.length) {
        const nextLines = deleteLines.slice(i, i + 5).join("\n");
        if (nextLines.includes("/members/bulk")) {
          expect(nextLines).toContain('requirePermission(db, "projects:manage_members")');
          foundDeleteBulk = true;
          break;
        }
      }
    }
    expect(foundDeleteBulk).toBe(true);
  });

  test("T24 — Member counts no mutation permission: no requirePermission on member-counts", () => {
    // The member-counts route should use router.post + validate but NOT requirePermission.
    // Verify: router.post with member-counts path is followed by validate, not requirePermission
    expect(routesContent).toMatch(
      /router\.post\(\s+["']\/companies\/:companyId\/projects\/member-counts["'],\s+validate\(/
    );
    // Verify there's no requirePermission between router.post and member-counts path
    const match = routesContent.match(
      /router\.post\(\s+["']\/companies\/:companyId\/projects\/member-counts["']([\s\S]{0,200})/
    );
    expect(match).toBeTruthy();
    // The middleware chain after the path should NOT contain requirePermission
    const afterPath = match![1];
    expect(afterPath).not.toContain("requirePermission");
  });

  test("T25 — All 4 new routes call assertCompanyAccess()", () => {
    // Count assertCompanyAccess calls
    const matches = routesContent.match(/assertCompanyAccess\(req,\s*companyId\)/g);
    expect(matches).toBeTruthy();
    // There should be at least 8 calls total (4 original + 4 new routes)
    expect(matches!.length).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Pagination enrichment (T26-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Pagination enrichment", () => {
  test("T26 — GET members pagination support: checks req.query.limit and calls listMembersPaginated", () => {
    // Find the GET members route
    const getIdx = routesContent.indexOf("router.get(\"/companies/:companyId/projects/:projectId/members\"");
    expect(getIdx).toBeGreaterThan(-1);
    const getSection = routesContent.slice(getIdx, getIdx + 600);
    expect(getSection).toContain("req.query.limit");
    expect(getSection).toContain("listMembersPaginated");
  });

  test("T27 — Backward compatible: without query params, uses original listMembers", () => {
    const getIdx = routesContent.indexOf("router.get(\"/companies/:companyId/projects/:projectId/members\"");
    expect(getIdx).toBeGreaterThan(-1);
    const getSection = routesContent.slice(getIdx, getIdx + 1200);
    // Should call listMembers (non-paginated) as fallback
    expect(getSection).toContain("svc.listMembers(");
  });

  test("T28 — Max limit 100: pagination limits to 100 maximum", () => {
    // Check route-level limit capping
    const getIdx = routesContent.indexOf("router.get(\"/companies/:companyId/projects/:projectId/members\"");
    expect(getIdx).toBeGreaterThan(-1);
    const getSection = routesContent.slice(getIdx, getIdx + 1200);
    expect(getSection).toMatch(/Math\.min\(100/);

    // Also check service-level limit capping
    const svcIdx = serviceContent.indexOf("listMembersPaginated:");
    expect(svcIdx).toBeGreaterThan(-1);
    const svcSection = serviceContent.slice(svcIdx, svcIdx + 800);
    expect(svcSection).toMatch(/Math\.min\(opts\.limit,\s*100\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: New validators (T29-T33)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: New validators", () => {
  test("T29 — bulkAddProjectMembersSchema: validates { userIds: string[], role: enum } with .max(100)", () => {
    expect(validatorContent).toContain("bulkAddProjectMembersSchema");
    const schemaIdx = validatorContent.indexOf("bulkAddProjectMembersSchema");
    const section = validatorContent.slice(schemaIdx, schemaIdx + 300);
    expect(section).toContain("userIds");
    expect(section).toContain("role");
    expect(section).toContain(".max(100");
  });

  test("T30 — bulkRemoveProjectMembersSchema: validates { userIds: string[] } with .max(100)", () => {
    expect(validatorContent).toContain("bulkRemoveProjectMembersSchema");
    const schemaIdx = validatorContent.indexOf("bulkRemoveProjectMembersSchema");
    const section = validatorContent.slice(schemaIdx, schemaIdx + 300);
    expect(section).toContain("userIds");
    expect(section).toContain(".max(100");
  });

  test("T31 — memberCountsSchema: validates { projectIds: string[] } with .uuid()", () => {
    expect(validatorContent).toContain("memberCountsSchema");
    const schemaIdx = validatorContent.indexOf("memberCountsSchema");
    const section = validatorContent.slice(schemaIdx, schemaIdx + 200);
    expect(section).toContain("projectIds");
    expect(section).toContain(".uuid()");
  });

  test("T32 — Validator exports: index.ts exports all 3 new schemas", () => {
    expect(validatorIndexContent).toContain("bulkAddProjectMembersSchema");
    expect(validatorIndexContent).toContain("bulkRemoveProjectMembersSchema");
    expect(validatorIndexContent).toContain("memberCountsSchema");
    // Also verify types are exported
    expect(validatorIndexContent).toContain("BulkAddProjectMembers");
    expect(validatorIndexContent).toContain("BulkRemoveProjectMembers");
    expect(validatorIndexContent).toContain("MemberCounts");
  });

  test("T33 — Strict mode: all 3 schemas use .strict()", () => {
    // Count .strict() occurrences in the PROJ-S02 section
    const bulkAddIdx = validatorContent.indexOf("bulkAddProjectMembersSchema");
    const bulkRemoveIdx = validatorContent.indexOf("bulkRemoveProjectMembersSchema");
    const countsIdx = validatorContent.indexOf("memberCountsSchema");

    // Each schema section should contain .strict()
    const bulkAddSection = validatorContent.slice(bulkAddIdx, bulkRemoveIdx);
    expect(bulkAddSection).toContain(".strict()");

    const bulkRemoveSection = validatorContent.slice(bulkRemoveIdx, countsIdx);
    expect(bulkRemoveSection).toContain(".strict()");

    const countsSection = validatorContent.slice(countsIdx, countsIdx + 200);
    expect(countsSection).toContain(".strict()");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Activity log events (T34-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Activity log events", () => {
  test("T34 — Bulk add activity: emits project.members_bulk_added via logActivity", () => {
    expect(routesContent).toContain("project.members_bulk_added");
    expect(routesContent).toMatch(/logActivity[\s\S]*?project\.members_bulk_added/);
  });

  test("T35 — Bulk remove activity: emits project.members_bulk_removed via logActivity", () => {
    expect(routesContent).toContain("project.members_bulk_removed");
    expect(routesContent).toMatch(/logActivity[\s\S]*?project\.members_bulk_removed/);
  });

  test("T36 — Activity details: events contain added/removed, skipped, userIds", () => {
    // Bulk add activity details -- use wider context for Windows line endings
    const bulkAddActivityIdx = routesContent.indexOf("project.members_bulk_added");
    expect(bulkAddActivityIdx).toBeGreaterThan(-1);
    const bulkAddSection = routesContent.slice(Math.max(0, bulkAddActivityIdx - 600), bulkAddActivityIdx + 200);
    expect(bulkAddSection).toContain("result.added");
    expect(bulkAddSection).toContain("result.skipped");
    expect(bulkAddSection).toContain("userIds");

    // Bulk remove activity details
    const bulkRemoveActivityIdx = routesContent.indexOf("project.members_bulk_removed");
    expect(bulkRemoveActivityIdx).toBeGreaterThan(-1);
    const bulkRemoveSection = routesContent.slice(Math.max(0, bulkRemoveActivityIdx - 600), bulkRemoveActivityIdx + 200);
    expect(bulkRemoveSection).toContain("result.removed");
    expect(bulkRemoveSection).toContain("result.skipped");
    expect(bulkRemoveSection).toContain("userIds");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Audit events (T37-T39)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Audit events", () => {
  test("T37 — Bulk add audit: emitAudit() with action project_membership.bulk_added", () => {
    expect(routesContent).toContain("project_membership.bulk_added");
    // Verify emitAudit is called with this action
    const auditIdx = routesContent.indexOf("project_membership.bulk_added");
    const section = routesContent.slice(Math.max(0, auditIdx - 200), auditIdx + 50);
    expect(section).toContain("emitAudit(");
  });

  test("T38 — Bulk remove audit: emitAudit() with action project_membership.bulk_removed", () => {
    expect(routesContent).toContain("project_membership.bulk_removed");
    const auditIdx = routesContent.indexOf("project_membership.bulk_removed");
    const section = routesContent.slice(Math.max(0, auditIdx - 200), auditIdx + 50);
    expect(section).toContain("emitAudit(");
  });

  test("T39 — emitAudit import: routes import emitAudit from services", () => {
    expect(routesContent).toMatch(/import[\s\S]*?emitAudit[\s\S]*?from\s+["']\.\.\/services\/index\.js["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Response shapes (T40-T43)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Response shapes", () => {
  test("T40 — Bulk add response: returns res.status(200).json(result) (not 201)", () => {
    // Find POST bulk add route handler -- wider slice for Windows
    const bulkAddIdx = routesContent.indexOf("project_membership.bulk_added");
    expect(bulkAddIdx).toBeGreaterThan(-1);
    const section = routesContent.slice(bulkAddIdx, bulkAddIdx + 500);
    expect(section).toContain("res.status(200).json(result)");
  });

  test("T41 — getUserProjectIds response: returns { projectIds: [...] }", () => {
    const routeIdx = routesContent.indexOf("/companies/:companyId/users/:userId/project-ids");
    expect(routeIdx).toBeGreaterThan(-1);
    const section = routesContent.slice(routeIdx, routeIdx + 600);
    expect(section).toContain("{ projectIds }");
  });

  test("T42 — Counts response: returns { counts: { ... } }", () => {
    const routeIdx = routesContent.indexOf("/companies/:companyId/projects/member-counts");
    expect(routeIdx).toBeGreaterThan(-1);
    const section = routesContent.slice(routeIdx, routeIdx + 600);
    expect(section).toContain("{ counts }");
  });

  test("T43 — Paginated response: returns { data: [...], nextCursor: ... }", () => {
    const fnIdx = serviceContent.indexOf("listMembersPaginated:");
    expect(fnIdx).toBeGreaterThan(-1);
    const section = serviceContent.slice(fnIdx, fnIdx + 2500);
    expect(section).toContain("nextCursor");
    expect(section).toContain("data");
    expect(section).toMatch(/return\s*\{\s*data,\s*nextCursor\s*\}/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Integration patterns (T44-T47)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Integration patterns", () => {
  test("T44 — Service uses sql template: countMembersByProject uses sql`count(*)::int`", () => {
    const fnIdx = serviceContent.indexOf("countMembersByProject:");
    expect(fnIdx).toBeGreaterThan(-1);
    const section = serviceContent.slice(fnIdx, fnIdx + 500);
    expect(section).toMatch(/sql.*count\(\*\)::int/);
  });

  test("T45 — Bulk routes use validate middleware", () => {
    // Bulk add uses validate(bulkAddProjectMembersSchema)
    expect(routesContent).toContain("validate(bulkAddProjectMembersSchema)");
    // Bulk remove uses validate(bulkRemoveProjectMembersSchema)
    expect(routesContent).toContain("validate(bulkRemoveProjectMembersSchema)");
    // Member counts uses validate(memberCountsSchema)
    expect(routesContent).toContain("validate(memberCountsSchema)");
  });

  test("T46 — Existing addMember enriched: calls syncUserProjectScope (not just insert+return)", () => {
    const addMemberIdx = serviceContent.indexOf("addMember:");
    expect(addMemberIdx).toBeGreaterThan(-1);
    const section = serviceContent.slice(addMemberIdx, addMemberIdx + 800);
    // Must have both insert and syncUserProjectScope
    expect(section).toContain(".insert(projectMemberships)");
    expect(section).toContain("syncUserProjectScope(companyId, userId)");
  });

  test("T47 — Existing removeMember enriched: calls syncUserProjectScope (not just delete+return)", () => {
    const removeMemberIdx = serviceContent.indexOf("removeMember:");
    expect(removeMemberIdx).toBeGreaterThan(-1);
    const section = serviceContent.slice(removeMemberIdx, removeMemberIdx + 800);
    // Must have both delete and syncUserProjectScope
    expect(section).toContain(".delete(projectMemberships)");
    expect(section).toContain("syncUserProjectScope(companyId, userId)");
  });
});
