/**
 * MU-S02: Page Membres avec Tableau et Filtres -- E2E Tests
 *
 * These tests verify the deliverables of MU-S02:
 *   - AC-01: Members page displays member table with enriched data
 *   - AC-02: Backend listMembers() enriched with LEFT JOIN on authUsers
 *   - AC-03: Role filter works (admin, manager, contributor, viewer)
 *   - AC-04: Status filter works (active, pending, suspended)
 *   - AC-05: Search by name or email
 *   - AC-06: PATCH status endpoint to suspend/reactivate members
 *   - AC-07: API client functions (listMembers, updateMemberBusinessRole, updateMemberStatus)
 *   - AC-08: Route /members in App.tsx
 *   - AC-09: Sidebar "Members" nav item
 *   - AC-10: Invite dialog with email input
 *
 * Source files:
 *   - server/src/services/access.ts -- enriched listMembers() with LEFT JOIN authUsers
 *   - server/src/routes/access.ts -- PATCH /companies/:companyId/members/:memberId/status
 *   - ui/src/api/access.ts -- listMembers, updateMemberBusinessRole, updateMemberStatus
 *   - ui/src/lib/queryKeys.ts -- access.members query key
 *   - ui/src/App.tsx -- Route path="members"
 *   - ui/src/components/Sidebar.tsx -- Members nav item with Users icon
 *   - ui/src/pages/Members.tsx -- Members page component
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ACCESS_SERVICE = resolve(ROOT, "server/src/services/access.ts");
const ACCESS_ROUTES = resolve(ROOT, "server/src/routes/access.ts");
const API_ACCESS = resolve(ROOT, "ui/src/api/access.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const APP_TSX = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const MEMBERS_PAGE = resolve(ROOT, "ui/src/pages/Members.tsx");

// ─── Group 1: Backend — enriched listMembers (server/src/services/access.ts) ─

test.describe("Group 1: enriched listMembers service", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_SERVICE, "utf-8");
  });

  test("listMembers uses LEFT JOIN on authUsers", () => {
    // Extract the listMembers function body
    const fnMatch = content.match(
      /async\s+function\s+listMembers[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toMatch(/leftJoin/);
    expect(fnBody).toMatch(/authUsers/);
  });

  test("listMembers selects enriched fields (userName, userEmail, userImage)", () => {
    const fnMatch = content.match(
      /async\s+function\s+listMembers[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("userName");
    expect(fnBody).toContain("userEmail");
    expect(fnBody).toContain("userImage");
  });

  test("listMembers joins on principalType user and principalId matching authUsers.id", () => {
    const fnMatch = content.match(
      /async\s+function\s+listMembers[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    // Should match principalId to authUsers.id
    expect(fnBody).toMatch(/principalId/);
    expect(fnBody).toMatch(/authUsers\.id/);
  });

  test("listMembers selects membership base fields (id, companyId, status, businessRole)", () => {
    const fnMatch = content.match(
      /async\s+function\s+listMembers[\s\S]*?(?=\n\s{2}async\s+function\s|\n\s{2}return\s+\{)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("companyMemberships.id");
    expect(fnBody).toContain("companyMemberships.status");
    expect(fnBody).toContain("companyMemberships.businessRole");
  });
});

// ─── Group 2: Backend — PATCH member status endpoint ─────────────────────────

test.describe("Group 2: PATCH member status endpoint", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("PATCH route for /companies/:companyId/members/:memberId/status exists", () => {
    expect(content).toMatch(
      /router\.patch\s*\(\s*["'][^"']*members\/:memberId\/status["']/,
    );
  });

  test("status endpoint uses assertCompanyPermission with users:manage_permissions", () => {
    // Find the status route section
    const routeIdx = content.indexOf("members/:memberId/status");
    expect(routeIdx).toBeGreaterThan(-1);
    // Look for assertCompanyPermission near the route (within 600 chars)
    const nearbyContent = content.slice(routeIdx, routeIdx + 600);
    expect(nearbyContent).toContain("assertCompanyPermission");
    expect(nearbyContent).toContain("users:manage_permissions");
  });

  test("status endpoint validates status is active or suspended", () => {
    const routeIdx = content.indexOf("members/:memberId/status");
    expect(routeIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(routeIdx, routeIdx + 800);
    expect(nearbyContent).toContain("active");
    expect(nearbyContent).toContain("suspended");
  });

  test("status endpoint updates companyMemberships with new status", () => {
    const routeIdx = content.indexOf("members/:memberId/status");
    expect(routeIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(routeIdx, routeIdx + 800);
    expect(nearbyContent).toMatch(/\.update\s*\(\s*companyMemberships\s*\)/);
    expect(nearbyContent).toContain("status");
  });

  test("status endpoint logs activity", () => {
    const routeIdx = content.indexOf("members/:memberId/status");
    expect(routeIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(routeIdx, routeIdx + 1200);
    expect(nearbyContent).toContain("logActivity");
    expect(nearbyContent).toMatch(/member\.status/);
  });

  test("status endpoint returns 404 for unknown member", () => {
    const routeIdx = content.indexOf("members/:memberId/status");
    expect(routeIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(routeIdx, routeIdx + 1000);
    expect(nearbyContent).toMatch(/notFound/);
  });
});

// ─── Group 3: API client (ui/src/api/access.ts) ─────────────────────────────

test.describe("Group 3: API client functions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(API_ACCESS, "utf-8");
  });

  test("listMembers function exists calling GET /companies/:companyId/members", () => {
    expect(content).toContain("listMembers");
    expect(content).toMatch(/\/companies\/.*\/members/);
  });

  test("updateMemberBusinessRole function exists", () => {
    expect(content).toContain("updateMemberBusinessRole");
    expect(content).toMatch(/\/members\/.*\/business-role/);
  });

  test("updateMemberStatus function exists", () => {
    expect(content).toContain("updateMemberStatus");
    expect(content).toMatch(/\/members\/.*\/status/);
  });

  test("EnrichedMember type is defined with userName, userEmail, userImage", () => {
    expect(content).toMatch(/EnrichedMember/);
    expect(content).toContain("userName");
    expect(content).toContain("userEmail");
    expect(content).toContain("userImage");
  });

  test("listMembers uses api.get", () => {
    // Find listMembers definition and check it uses api.get
    const listMembersIdx = content.indexOf("listMembers");
    expect(listMembersIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(listMembersIdx, listMembersIdx + 200);
    expect(nearbyContent).toMatch(/api\.get/);
  });

  test("updateMemberBusinessRole uses api.patch", () => {
    const fnIdx = content.indexOf("updateMemberBusinessRole");
    expect(fnIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(fnIdx, fnIdx + 300);
    expect(nearbyContent).toMatch(/api\.patch/);
  });

  test("updateMemberStatus uses api.patch", () => {
    const fnIdx = content.indexOf("updateMemberStatus");
    expect(fnIdx).toBeGreaterThan(-1);
    const nearbyContent = content.slice(fnIdx, fnIdx + 300);
    expect(nearbyContent).toMatch(/api\.patch/);
  });
});

// ─── Group 4: Query keys (ui/src/lib/queryKeys.ts) ──────────────────────────

test.describe("Group 4: Query keys for members", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(QUERY_KEYS, "utf-8");
  });

  test("access.members query key factory exists", () => {
    expect(content).toMatch(/members\s*:\s*\(/);
    // Should be in the access namespace
    const accessSection = content.match(/access\s*:\s*\{[\s\S]*?\n\s{2}\}/);
    expect(accessSection).toBeTruthy();
    expect(accessSection![0]).toContain("members");
  });

  test("members query key includes companyId parameter", () => {
    const accessSection = content.match(/access\s*:\s*\{[\s\S]*?\n\s{2}\}/);
    expect(accessSection).toBeTruthy();
    const membersMatch = accessSection![0].match(
      /members\s*:\s*\(.*companyId.*\)/,
    );
    expect(membersMatch).toBeTruthy();
  });
});

// ─── Group 5: Route config (ui/src/App.tsx) ─────────────────────────────────

test.describe("Group 5: Route configuration", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(APP_TSX, "utf-8");
  });

  test("Route path=\"members\" exists in boardRoutes", () => {
    expect(content).toMatch(/path\s*=\s*["']members["']/);
  });

  test("Members page component is imported", () => {
    expect(content).toMatch(/import.*Members.*from.*pages\/Members/);
  });

  test("Members route uses Members component as element", () => {
    // Find the members route and verify it uses <Members /> element
    const membersRouteMatch = content.match(
      /path\s*=\s*["']members["'][^>]*element\s*=\s*\{<\s*Members\s*\/>\}/,
    );
    if (!membersRouteMatch) {
      // Also check the alternative pattern with Route on same line
      expect(content).toMatch(
        /<Route\s+path\s*=\s*["']members["']\s+element\s*=\s*\{<\s*Members\s*\/>\}/,
      );
    }
  });
});

// ─── Group 6: Sidebar navigation ────────────────────────────────────────────

test.describe("Group 6: Sidebar navigation", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR, "utf-8");
  });

  test("Sidebar has Members nav item", () => {
    expect(content).toContain("Members");
    expect(content).toMatch(/label\s*=\s*["']Members["']/);
  });

  test("Members nav item links to /members", () => {
    expect(content).toMatch(/to\s*=\s*["']\/members["']/);
  });

  test("Sidebar imports Users icon from lucide-react", () => {
    expect(content).toMatch(/import\s*\{[\s\S]*?Users[\s\S]*?\}\s*from\s*["']lucide-react["']/);
  });

  test("Members nav item uses Users icon", () => {
    // Find the SidebarNavItem for Members and check icon prop
    const membersItemMatch = content.match(
      /SidebarNavItem[^>]*?label\s*=\s*["']Members["'][^>]*?icon\s*=\s*\{?\s*Users\s*\}?/,
    );
    if (!membersItemMatch) {
      // Try alternate attribute order (icon before label)
      const altMatch = content.match(
        /SidebarNavItem[^>]*?icon\s*=\s*\{?\s*Users\s*\}?[^>]*?label\s*=\s*["']Members["']/,
      );
      expect(altMatch).toBeTruthy();
    }
  });

  test("Members nav item is in the Company section", () => {
    // The Members item should be inside the "Company" SidebarSection
    const companySection = content.match(
      /SidebarSection\s+label\s*=\s*["']Company["'][\s\S]*?<\/SidebarSection>/,
    );
    expect(companySection).toBeTruthy();
    expect(companySection![0]).toContain("Members");
  });
});

// ─── Group 7: Members page component (ui/src/pages/Members.tsx) ─────────────

test.describe("Group 7: Members page component", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(MEMBERS_PAGE, "utf-8");
  });

  // --- Page structure ---

  test("Members page file exists and exports Members component", () => {
    expect(content).toMatch(/export\s+(function|const)\s+Members/);
  });

  test("page container has data-testid=\"mu-s02-page\"", () => {
    expect(content).toContain('data-testid="mu-s02-page"');
  });

  test("page header has data-testid=\"mu-s02-header\"", () => {
    expect(content).toContain('data-testid="mu-s02-header"');
  });

  test("member count badge has data-testid=\"mu-s02-member-count\"", () => {
    expect(content).toContain('data-testid="mu-s02-member-count"');
  });

  // --- Filters ---

  test("filters container has data-testid=\"mu-s02-filters\"", () => {
    expect(content).toContain('data-testid="mu-s02-filters"');
  });

  test("role filter trigger has data-testid=\"mu-s02-filter-role\"", () => {
    expect(content).toContain('data-testid="mu-s02-filter-role"');
  });

  test("status filter trigger has data-testid=\"mu-s02-filter-status\"", () => {
    expect(content).toContain('data-testid="mu-s02-filter-status"');
  });

  test("search input has data-testid=\"mu-s02-search\"", () => {
    expect(content).toContain('data-testid="mu-s02-search"');
  });

  test("role filter has options for all 4 business roles", () => {
    expect(content).toContain("mu-s02-filter-role-all");
    // The role options use dynamic data-testid with BUSINESS_ROLES.map
    expect(content).toMatch(/BUSINESS_ROLES\.map/);
    expect(content).toMatch(/mu-s02-filter-role-\$\{/);
  });

  test("status filter has active, pending, suspended options", () => {
    expect(content).toContain("mu-s02-filter-status-all");
    expect(content).toContain("mu-s02-filter-status-active");
    expect(content).toContain("mu-s02-filter-status-pending");
    expect(content).toContain("mu-s02-filter-status-suspended");
  });

  // --- Table ---

  test("members table has data-testid=\"mu-s02-members-table\"", () => {
    expect(content).toContain('data-testid="mu-s02-members-table"');
  });

  test("member rows have dynamic data-testid with member.id", () => {
    expect(content).toMatch(/data-testid=\{?`mu-s02-member-row-\$\{/);
  });

  test("member name cells have dynamic data-testid", () => {
    expect(content).toMatch(/data-testid=\{?`mu-s02-member-name-\$\{/);
  });

  test("member email cells have dynamic data-testid", () => {
    expect(content).toMatch(/data-testid=\{?`mu-s02-member-email-\$\{/);
  });

  test("member role selectors have dynamic data-testid", () => {
    expect(content).toMatch(/data-testid=\{?`mu-s02-member-role-\$\{/);
  });

  test("member status badges have dynamic data-testid", () => {
    expect(content).toMatch(/data-testid=\{?`mu-s02-member-status-\$\{/);
  });

  test("member actions buttons have dynamic data-testid", () => {
    expect(content).toMatch(/data-testid=\{?`mu-s02-member-actions-\$\{/);
  });

  // --- Invite dialog ---

  test("invite button has data-testid=\"mu-s02-invite-button\"", () => {
    expect(content).toContain('data-testid="mu-s02-invite-button"');
  });

  test("invite dialog has data-testid=\"mu-s02-invite-dialog\"", () => {
    expect(content).toContain('data-testid="mu-s02-invite-dialog"');
  });

  test("invite email input has data-testid=\"mu-s02-invite-email\"", () => {
    expect(content).toContain('data-testid="mu-s02-invite-email"');
  });

  test("invite submit button has data-testid=\"mu-s02-invite-submit\"", () => {
    expect(content).toContain('data-testid="mu-s02-invite-submit"');
  });

  test("invite cancel button has data-testid=\"mu-s02-invite-cancel\"", () => {
    expect(content).toContain('data-testid="mu-s02-invite-cancel"');
  });

  // --- React patterns ---

  test("uses useQuery for fetching members data", () => {
    expect(content).toContain("useQuery");
    expect(content).toMatch(/queryKey.*members/);
  });

  test("uses useMutation for role updates", () => {
    expect(content).toContain("useMutation");
    expect(content).toContain("updateMemberBusinessRole");
  });

  test("uses useMutation for status updates (suspend/reactivate)", () => {
    expect(content).toContain("updateMemberStatus");
  });

  test("imports BUSINESS_ROLES from @mnm/shared", () => {
    expect(content).toContain("BUSINESS_ROLES");
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("imports BUSINESS_ROLE_LABELS from @mnm/shared", () => {
    expect(content).toContain("BUSINESS_ROLE_LABELS");
  });

  test("uses useCompany hook for selectedCompanyId", () => {
    expect(content).toContain("useCompany");
    expect(content).toContain("selectedCompanyId");
  });

  test("imports accessApi from api/access", () => {
    expect(content).toContain("accessApi");
    expect(content).toMatch(/from\s+["'].*api\/access["']/);
  });

  test("invalidates members query after mutations", () => {
    expect(content).toContain("invalidateQueries");
    expect(content).toMatch(/queryKeys\.access\.members/);
  });

  // --- Empty state / loading ---

  test("has empty state with data-testid=\"mu-s02-empty-state\"", () => {
    expect(content).toContain('data-testid="mu-s02-empty-state"');
  });

  test("has loading state", () => {
    expect(content).toContain("isLoading");
  });

  // --- Footer ---

  test("footer has data-testid=\"mu-s02-footer\" with member count", () => {
    expect(content).toContain('data-testid="mu-s02-footer"');
    expect(content).toMatch(/Showing.*members/);
  });

  // --- Suspend/reactivate actions ---

  test("has suspend action with data-testid pattern", () => {
    expect(content).toMatch(/mu-s02-action-suspend/);
  });

  test("has reactivate action with data-testid pattern", () => {
    expect(content).toMatch(/mu-s02-action-reactivate/);
  });
});

// ─── Group 8: data-testid completeness ──────────────────────────────────────

test.describe("Group 8: data-testid completeness", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(MEMBERS_PAGE, "utf-8");
  });

  const requiredTestIds = [
    "mu-s02-page",
    "mu-s02-header",
    "mu-s02-member-count",
    "mu-s02-filters",
    "mu-s02-filter-role",
    "mu-s02-filter-status",
    "mu-s02-search",
    "mu-s02-members-table",
    "mu-s02-invite-button",
    "mu-s02-invite-dialog",
    "mu-s02-invite-email",
    "mu-s02-invite-submit",
    "mu-s02-invite-cancel",
    "mu-s02-empty-state",
    "mu-s02-footer",
  ];

  for (const testId of requiredTestIds) {
    test(`data-testid="${testId}" exists`, () => {
      expect(content).toContain(testId);
    });
  }

  const dynamicTestIdPatterns = [
    "mu-s02-member-row-",
    "mu-s02-member-name-",
    "mu-s02-member-email-",
    "mu-s02-member-role-",
    "mu-s02-member-status-",
    "mu-s02-member-actions-",
    "mu-s02-action-suspend-",
    "mu-s02-action-reactivate-",
  ];

  for (const pattern of dynamicTestIdPatterns) {
    test(`dynamic data-testid pattern "${pattern}{id}" exists`, () => {
      expect(content).toContain(pattern);
    });
  }
});
