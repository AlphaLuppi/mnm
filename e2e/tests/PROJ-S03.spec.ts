/**
 * PROJ-S03: Filtrage Agents/Issues/Workflows par Scope Projet -- E2E Tests
 *
 * These tests verify the deliverables of PROJ-S03:
 *   - Groupe 1: Service scope-filter.ts (T01-T09)
 *   - Groupe 2: access.ts hasGlobalScope (T10-T13)
 *   - Groupe 3: Issues routes scope filtering (T14-T21)
 *   - Groupe 4: Issues service scope filter (T22-T25)
 *   - Groupe 5: Workflows routes scope filtering (T26-T31)
 *   - Groupe 6: Workflows service scope filter (T32-T34)
 *   - Groupe 7: Projects routes scope filtering (T35-T39)
 *   - Groupe 8: Projects service listByIds (T40-T43)
 *   - Groupe 9: Drift routes scope filtering (T44-T48)
 *   - Groupe 10: Audit events (T49-T53)
 *   - Groupe 11: Frontend hook (T54-T61)
 *   - Groupe 12: Import patterns (T62-T67)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCOPE_FILTER_FILE = resolve(ROOT, "server/src/services/scope-filter.ts");
const ACCESS_FILE = resolve(ROOT, "server/src/services/access.ts");
const ISSUES_ROUTE = resolve(ROOT, "server/src/routes/issues.ts");
const ISSUES_SERVICE = resolve(ROOT, "server/src/services/issues.ts");
const WORKFLOWS_ROUTE = resolve(ROOT, "server/src/routes/workflows.ts");
const WORKFLOWS_SERVICE = resolve(ROOT, "server/src/services/workflows.ts");
const PROJECTS_ROUTE = resolve(ROOT, "server/src/routes/projects.ts");
const PROJECTS_SERVICE = resolve(ROOT, "server/src/services/projects.ts");
const DRIFT_ROUTE = resolve(ROOT, "server/src/routes/drift.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const HOOK_FILE = resolve(ROOT, "ui/src/hooks/useProjectScope.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Service scope-filter.ts (T01-T09)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Service scope-filter.ts", () => {
  test("T01 -- scope-filter file exists", async () => {
    await expect(fsAccess(SCOPE_FILTER_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 -- getScopeProjectIds function exported", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/export\s+async\s+function\s+getScopeProjectIds\s*\(/);
  });

  test("T03 -- Agent bypass returns null", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/req\.actor\.type\s*===\s*["']agent["']/);
    expect(content).toMatch(/return\s+null/);
  });

  test("T04 -- Instance admin bypass (local_implicit and isInstanceAdmin)", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/req\.actor\.source\s*===\s*["']local_implicit["']/);
    expect(content).toMatch(/req\.actor\.isInstanceAdmin/);
  });

  test("T05 -- hasGlobalScope call", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/hasGlobalScope\s*\(\s*companyId\s*,\s*userId\s*\)/);
  });

  test("T06 -- getUserProjectIds call for scoped users", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/getUserProjectIds\s*\(\s*companyId\s*,\s*userId\s*\)/);
  });

  test("T07 -- Returns null for global access", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    // Multiple return null statements for different bypass conditions
    const nullReturns = content.match(/return\s+null/g);
    expect(nullReturns).not.toBeNull();
    expect(nullReturns!.length).toBeGreaterThanOrEqual(3);
  });

  test("T08 -- Returns string[] for scoped users (projectIds)", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/return\s+projectIds/);
  });

  test("T09 -- Exports in services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toMatch(/export\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["']\.\/scope-filter/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: access.ts hasGlobalScope (T10-T13)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: access.ts hasGlobalScope", () => {
  test("T10 -- hasGlobalScope function exists", async () => {
    const content = await readFile(ACCESS_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+hasGlobalScope\s*\(/);
  });

  test("T11 -- Queries principalPermissionGrants with user filter", async () => {
    const content = await readFile(ACCESS_FILE, "utf-8");
    // Should query grants for the user
    expect(content).toMatch(/principalPermissionGrants/);
    expect(content).toMatch(/principalType/);
    expect(content).toMatch(/principalId/);
  });

  test("T12 -- Checks scope null with .some()", async () => {
    const content = await readFile(ACCESS_FILE, "utf-8");
    expect(content).toMatch(/\.some\s*\(\s*\(?g\)?\s*=>\s*g\.scope\s*===\s*null\s*\)/);
  });

  test("T13 -- Returns boolean (Promise<boolean>)", async () => {
    const content = await readFile(ACCESS_FILE, "utf-8");
    expect(content).toMatch(/hasGlobalScope\s*\([^)]*\)\s*:\s*Promise\s*<\s*boolean\s*>/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Issues routes scope filtering (T14-T21)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Issues routes scope filtering", () => {
  test("T14 -- Import getScopeProjectIds in issues.ts", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T15 -- GET list calls getScopeProjectIds", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    // Should call getScopeProjectIds in the list route
    expect(content).toMatch(/getScopeProjectIds\s*\(\s*db\s*,\s*companyId\s*,\s*req\s*\)/);
  });

  test("T16 -- Passes allowedProjectIds to service", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/allowedProjectIds\s*:\s*scopeProjectIds/);
  });

  test("T17 -- GET single calls getScopeProjectIds", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    // The single entity route uses issue.companyId
    expect(content).toMatch(/getScopeProjectIds\s*\(\s*db\s*,\s*issue\.companyId\s*,\s*req\s*\)/);
  });

  test("T18 -- Single issue scope check against scopeProjectIds", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/scopeProjectIds\s*!==\s*null\s*&&\s*issue\.projectId\s*!==\s*null/);
    expect(content).toMatch(/scopeProjectIds\.includes\s*\(\s*issue\.projectId\s*\)/);
  });

  test("T19 -- Throws forbidden on scope denied", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/throw\s+forbidden\s*\(\s*["']Access denied.*scope/i);
    expect(content).toMatch(/SCOPE_DENIED/);
  });

  test("T20 -- emitAudit on scope denied with targetType issue", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/emitAudit\s*\(\s*\{[^}]*action\s*:\s*["']access\.scope_denied["']/);
    expect(content).toMatch(/targetType\s*:\s*["']issue["']/);
  });

  test("T21 -- Null projectId passes scope check (conditional guard)", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    // The condition checks issue.projectId !== null, so null projectId skips the check
    expect(content).toMatch(/issue\.projectId\s*!==\s*null/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Issues service scope filter (T22-T25)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Issues service scope filter", () => {
  test("T22 -- IssueFilters has allowedProjectIds", async () => {
    const content = await readFile(ISSUES_SERVICE, "utf-8");
    expect(content).toMatch(/allowedProjectIds\s*\?\s*:\s*string\s*\[\s*\]\s*\|\s*null/);
  });

  test("T23 -- Empty array = IS NULL only", async () => {
    const content = await readFile(ISSUES_SERVICE, "utf-8");
    // When allowedProjectIds is empty, push projectId IS NULL
    expect(content).toMatch(/allowedProjectIds\.length\s*===\s*0/);
    expect(content).toMatch(/issues\.projectId\}\s*IS\s+NULL/);
  });

  test("T24 -- Non-empty array = IN OR NULL", async () => {
    const content = await readFile(ISSUES_SERVICE, "utf-8");
    expect(content).toMatch(/issues\.projectId\}\s*IS\s+NULL\s+OR\s+\$\{issues\.projectId\}\s*IN/);
  });

  test("T25 -- Explicit projectId intersection", async () => {
    const content = await readFile(ISSUES_SERVICE, "utf-8");
    // The explicit projectId filter is applied separately (after allowedProjectIds)
    expect(content).toMatch(/filters\?\.projectId/);
    // Both allowedProjectIds and projectId conditions are pushed to the same conditions array
    expect(content).toMatch(/allowedProjectIds/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Workflows routes scope filtering (T26-T31)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Workflows routes scope filtering", () => {
  test("T26 -- Import getScopeProjectIds in workflows.ts", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T27 -- GET list calls getScopeProjectIds", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/getScopeProjectIds\s*\(\s*db\s*,\s*companyId\s*,\s*req\s*\)/);
  });

  test("T28 -- Passes allowedProjectIds to service", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/allowedProjectIds\s*[=:]\s*scopeProjectIds/);
  });

  test("T29 -- GET single scope check", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/getScopeProjectIds\s*\(\s*db\s*,\s*instance\.companyId\s*,\s*req\s*\)/);
    expect(content).toMatch(/scopeProjectIds\s*!==\s*null\s*&&\s*instance\.projectId\s*!==\s*null/);
  });

  test("T30 -- Throws forbidden on scope denied for workflows", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/throw\s+forbidden\s*\(\s*["']Access denied.*scope/i);
    expect(content).toMatch(/SCOPE_DENIED/);
  });

  test("T31 -- emitAudit on workflow scope denied with targetType workflow", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/emitAudit\s*\(\s*\{[^}]*action\s*:\s*["']access\.scope_denied["']/);
    expect(content).toMatch(/targetType\s*:\s*["']workflow["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Workflows service scope filter (T32-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Workflows service scope filter", () => {
  test("T32 -- listInstances has allowedProjectIds parameter", async () => {
    const content = await readFile(WORKFLOWS_SERVICE, "utf-8");
    expect(content).toMatch(/allowedProjectIds\s*\?\s*:\s*string\s*\[\s*\]\s*\|\s*null/);
  });

  test("T33 -- Empty array = IS NULL only", async () => {
    const content = await readFile(WORKFLOWS_SERVICE, "utf-8");
    expect(content).toMatch(/allowedProjectIds\.length\s*===\s*0/);
    expect(content).toMatch(/workflowInstances\.projectId\}\s*IS\s+NULL/);
  });

  test("T34 -- Non-empty array = IN OR NULL", async () => {
    const content = await readFile(WORKFLOWS_SERVICE, "utf-8");
    expect(content).toMatch(/workflowInstances\.projectId\}\s*IS\s+NULL\s+OR\s+\$\{workflowInstances\.projectId\}\s*IN/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Projects routes scope filtering (T35-T39)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Projects routes scope filtering", () => {
  test("T35 -- Import getScopeProjectIds in projects.ts", async () => {
    const content = await readFile(PROJECTS_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T36 -- GET list calls getScopeProjectIds", async () => {
    const content = await readFile(PROJECTS_ROUTE, "utf-8");
    expect(content).toMatch(/getScopeProjectIds\s*\(\s*db\s*,\s*companyId\s*,\s*req\s*\)/);
  });

  test("T37 -- Scoped user calls listByIds", async () => {
    const content = await readFile(PROJECTS_ROUTE, "utf-8");
    expect(content).toMatch(/svc\.listByIds\s*\(\s*companyId\s*,\s*scopeProjectIds\s*\)/);
  });

  test("T38 -- Empty scope returns empty array", async () => {
    const content = await readFile(PROJECTS_ROUTE, "utf-8");
    expect(content).toMatch(/scopeProjectIds\.length\s*===\s*0/);
    expect(content).toMatch(/res\.json\s*\(\s*\[\s*\]\s*\)/);
  });

  test("T39 -- Global user calls list (existing)", async () => {
    const content = await readFile(PROJECTS_ROUTE, "utf-8");
    expect(content).toMatch(/svc\.list\s*\(\s*companyId\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Projects service listByIds (T40-T43)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Projects service listByIds", () => {
  test("T40 -- listByIds function exists", async () => {
    const content = await readFile(PROJECTS_SERVICE, "utf-8");
    expect(content).toMatch(/listByIds\s*:\s*async/);
  });

  test("T41 -- Uses inArray for project IDs", async () => {
    const content = await readFile(PROJECTS_SERVICE, "utf-8");
    expect(content).toMatch(/inArray\s*\(\s*projects\.id/);
  });

  test("T42 -- Filters by companyId", async () => {
    const content = await readFile(PROJECTS_SERVICE, "utf-8");
    expect(content).toMatch(/eq\s*\(\s*projects\.companyId\s*,\s*companyId\s*\)/);
  });

  test("T43 -- Empty array returns empty", async () => {
    const content = await readFile(PROJECTS_SERVICE, "utf-8");
    // Checks dedupedIds.length === 0 or ids.length === 0
    expect(content).toMatch(/(dedupedIds|ids)\.length\s*===\s*0.*return\s*\[\s*\]/s);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Drift routes scope filtering (T44-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Drift routes scope filtering", () => {
  test("T44 -- Import getScopeProjectIds in drift.ts", async () => {
    const content = await readFile(DRIFT_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T45 -- GET drift alerts calls getScopeProjectIds", async () => {
    const content = await readFile(DRIFT_ROUTE, "utf-8");
    expect(content).toMatch(/getScopeProjectIds\s*\(\s*db\s*,\s*companyId\s*,\s*req\s*\)/);
  });

  test("T46 -- Drift alerts filtered by scopeProjectIds", async () => {
    const content = await readFile(DRIFT_ROUTE, "utf-8");
    // Post-filter alerts by scope using Set
    expect(content).toMatch(/scopeProjectIds\s*!==\s*null/);
    expect(content).toMatch(/scopeSet\.has\s*\(\s*alert\.projectId\s*\)/);
  });

  test("T47 -- Drift reports are per-project (no company-level list needs scope filter)", async () => {
    const content = await readFile(DRIFT_ROUTE, "utf-8");
    // Drift results/items are accessed via /projects/:id/drift/* which are already project-scoped
    expect(content).toMatch(/\/projects\/:id\/drift\/results/);
    expect(content).toMatch(/\/projects\/:id\/drift\/items/);
  });

  test("T48 -- Drift alerts post-filter returns filtered data and total", async () => {
    const content = await readFile(DRIFT_ROUTE, "utf-8");
    expect(content).toMatch(/res\.json\s*\(\s*\{\s*data\s*:\s*filtered\s*,\s*total\s*:\s*filtered\.length\s*\}\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Audit events (T49-T53)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Audit events", () => {
  test("T49 -- Issues scope denied has emitAudit with access.scope_denied", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/emitAudit\s*\(\s*\{[^}]*action\s*:\s*["']access\.scope_denied["']/);
  });

  test("T50 -- Workflows scope denied has emitAudit with access.scope_denied", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/emitAudit\s*\(\s*\{[^}]*action\s*:\s*["']access\.scope_denied["']/);
  });

  test("T51 -- Audit metadata has requestedProjectId", async () => {
    const issuesContent = await readFile(ISSUES_ROUTE, "utf-8");
    const workflowsContent = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(issuesContent).toMatch(/requestedProjectId\s*:/);
    expect(workflowsContent).toMatch(/requestedProjectId\s*:/);
  });

  test("T52 -- Audit metadata has allowedProjectIds", async () => {
    const issuesContent = await readFile(ISSUES_ROUTE, "utf-8");
    const workflowsContent = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(issuesContent).toMatch(/allowedProjectIds\s*:\s*scopeProjectIds/);
    expect(workflowsContent).toMatch(/allowedProjectIds\s*:\s*scopeProjectIds/);
  });

  test("T53 -- Audit severity warning on scope denied", async () => {
    const issuesContent = await readFile(ISSUES_ROUTE, "utf-8");
    const workflowsContent = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(issuesContent).toMatch(/severity\s*:\s*["']warning["']/);
    expect(workflowsContent).toMatch(/severity\s*:\s*["']warning["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Frontend hook (T54-T61)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Frontend hook", () => {
  test("T54 -- Hook file exists", async () => {
    await expect(fsAccess(HOOK_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T55 -- Exports useProjectScope", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useProjectScope\s*\(/);
  });

  test("T56 -- Uses useQuery from @tanstack/react-query", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*useQuery[^}]*\}\s*from\s*["']@tanstack\/react-query["']/);
  });

  test("T57 -- Query key contains project-scope", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/queryKey\s*:\s*\[["']project-scope["']/);
  });

  test("T58 -- Calls /users/:userId/project-ids endpoint", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/\/companies\/.*\/users\/.*\/project-ids/);
  });

  test("T59 -- Returns projectIds, isLoading, isScoped", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/projectIds\s*:/);
    expect(content).toMatch(/isLoading/);
    expect(content).toMatch(/isScoped\s*:/);
  });

  test("T60 -- StaleTime 30s", async () => {
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/staleTime\s*:\s*30[_,]?000/);
  });

  test("T61 -- Hook file is importable (useProjectScope exported)", async () => {
    // Note: No hooks/index.ts barrel file exists in the project.
    // The hook is directly importable from useProjectScope.ts.
    const content = await readFile(HOOK_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+useProjectScope/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Import patterns (T62-T67)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Import patterns", () => {
  test("T62 -- issues.ts imports scope-filter", async () => {
    const content = await readFile(ISSUES_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T63 -- workflows.ts imports scope-filter", async () => {
    const content = await readFile(WORKFLOWS_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T64 -- projects.ts imports scope-filter", async () => {
    const content = await readFile(PROJECTS_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T65 -- drift.ts imports scope-filter", async () => {
    const content = await readFile(DRIFT_ROUTE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*getScopeProjectIds[^}]*\}\s*from\s*["'][^"']*scope-filter/);
  });

  test("T66 -- scope-filter.ts imports project-memberships", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*projectMembershipService[^}]*\}\s*from\s*["'][^"']*project-memberships/);
  });

  test("T67 -- scope-filter.ts imports access", async () => {
    const content = await readFile(SCOPE_FILTER_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*accessService[^}]*\}\s*from\s*["'][^"']*access/);
  });
});
