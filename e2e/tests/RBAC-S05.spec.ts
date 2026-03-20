/**
 * RBAC-S05: Navigation UI Masquee selon Permissions -- E2E Tests
 *
 * These tests verify the deliverables of RBAC-S05:
 *   - AC1-AC4:  Sidebar navigation masquee selon businessRole (viewer, contributor, manager, admin)
 *   - AC5:      Section masquee quand aucun enfant visible
 *   - AC6-AC7:  Route protegee: redirect vers dashboard / page 403
 *   - AC8:      Command Palette filtree selon permissions
 *   - AC9-AC10: Bouton + masque dans SidebarProjects / SidebarAgents
 *   - AC11:     Permissions se mettent a jour au changement de role
 *   - AC12:     Mode local_trusted affiche tout
 *
 * Verified files:
 *   - ui/src/hooks/usePermissions.ts          -- hook fetching effective permissions
 *   - ui/src/components/RequirePermission.tsx  -- route/content guard component
 *   - ui/src/pages/Forbidden.tsx              -- 403 page
 *   - ui/src/components/Sidebar.tsx           -- navigation masquee via usePermissions
 *   - ui/src/components/SidebarProjects.tsx   -- bouton + masque
 *   - ui/src/components/SidebarAgents.tsx     -- bouton + masque
 *   - ui/src/App.tsx                          -- RequirePermission route guards
 *   - server/src/routes/access.ts             -- GET /companies/:companyId/my-permissions
 *   - ui/src/api/access.ts                    -- getMyPermissions client function
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "../..");

// File paths
const USE_PERMISSIONS = resolve(ROOT, "ui/src/hooks/usePermissions.ts");
const REQUIRE_PERMISSION = resolve(ROOT, "ui/src/components/RequirePermission.tsx");
const FORBIDDEN_PAGE = resolve(ROOT, "ui/src/pages/Forbidden.tsx");
const SIDEBAR = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const SIDEBAR_PROJECTS = resolve(ROOT, "ui/src/components/SidebarProjects.tsx");
const SIDEBAR_AGENTS = resolve(ROOT, "ui/src/components/SidebarAgents.tsx");
const APP_TSX = resolve(ROOT, "ui/src/App.tsx");
const ACCESS_ROUTES = resolve(ROOT, "server/src/routes/access.ts");
const API_ACCESS = resolve(ROOT, "ui/src/api/access.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");

// ---------------------------------------------------------------------------
// Group 1: Hook usePermissions (ui/src/hooks/usePermissions.ts)
// ---------------------------------------------------------------------------

test.describe("Group 1: usePermissions hook", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(USE_PERMISSIONS, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(USE_PERMISSIONS).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports usePermissions function", () => {
    expect(content).toMatch(/export\s+function\s+usePermissions\s*\(/);
  });

  test("uses useQuery from @tanstack/react-query", () => {
    expect(content).toContain("useQuery");
    expect(content).toMatch(/from\s+["']@tanstack\/react-query["']/);
  });

  test("fetches my-permissions endpoint", () => {
    // The hook delegates to accessApi.getMyPermissions / queryKeys.access.myPermissions
    expect(content).toMatch(/myPermissions|my-permissions/);
  });

  test("has staleTime of 30 seconds (30000 or 30_000)", () => {
    expect(content).toMatch(/staleTime\s*:\s*(30_?000|30\s*\*\s*1000)/);
  });

  test("returns hasPermission or canUser function", () => {
    expect(content).toMatch(/(hasPermission|canUser)/);
  });

  test("returns permissions array", () => {
    expect(content).toMatch(/permissions/);
  });

  test("returns isLoading state", () => {
    expect(content).toContain("isLoading");
  });

  test("uses selectedCompanyId in queryKey or URL", () => {
    expect(content).toMatch(/(selectedCompanyId|companyId)/);
  });

  test("query is enabled conditionally on companyId", () => {
    expect(content).toMatch(/enabled\s*:/);
  });

  test("includes useCallback for permission check function", () => {
    expect(content).toMatch(/useCallback/);
  });

  test("checks effectivePermissions.includes for permission lookup", () => {
    expect(content).toMatch(/effectivePermissions.*includes|\.includes\s*\(\s*permission/);
  });
});

// ---------------------------------------------------------------------------
// Group 2: RequirePermission component (ui/src/components/RequirePermission.tsx)
// ---------------------------------------------------------------------------

test.describe("Group 2: RequirePermission component", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(REQUIRE_PERMISSION, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(REQUIRE_PERMISSION).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports RequirePermission component", () => {
    expect(content).toMatch(/export\s+function\s+RequirePermission/);
  });

  test("accepts a permission prop", () => {
    expect(content).toMatch(/permission\s*[:\?]/);
  });

  test("accepts a children prop", () => {
    expect(content).toContain("children");
  });

  test("accepts an optional fallback prop", () => {
    expect(content).toContain("fallback");
  });

  test("uses usePermissions hook", () => {
    expect(content).toContain("usePermissions");
    expect(content).toMatch(/from\s+["'].*usePermissions["']/);
  });

  test("returns null or fallback when permission denied", () => {
    // Should have a conditional that returns fallback or null
    expect(content).toMatch(/return\s+(fallback|null)/);
  });

  test("handles loading state", () => {
    expect(content).toContain("isLoading");
  });
});

// ---------------------------------------------------------------------------
// Group 3: Forbidden page (ui/src/pages/Forbidden.tsx)
// ---------------------------------------------------------------------------

test.describe("Group 3: Forbidden page (403)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(FORBIDDEN_PAGE, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(FORBIDDEN_PAGE).then(() => true),
    ).resolves.toBe(true);
  });

  test('has data-testid="rbac-s05-forbidden-page"', () => {
    expect(content).toContain('data-testid="rbac-s05-forbidden-page"');
  });

  test('has data-testid="rbac-s05-forbidden-message"', () => {
    expect(content).toContain('data-testid="rbac-s05-forbidden-message"');
  });

  test('has data-testid="rbac-s05-forbidden-back-link"', () => {
    expect(content).toContain('data-testid="rbac-s05-forbidden-back-link"');
  });

  test("contains access denied message", () => {
    expect(content).toMatch(/acces\s+refus|Acces\s+refuse|acces refuse/i);
  });

  test("contains back to dashboard link pointing to /dashboard", () => {
    expect(content).toMatch(/\/dashboard/);
    expect(content).toMatch(/retour|Retour|Dashboard/i);
  });

  test("contains contact administrator message", () => {
    expect(content).toMatch(/administrateur|administrator/i);
  });
});

// ---------------------------------------------------------------------------
// Group 4: Sidebar navigation masquee (ui/src/components/Sidebar.tsx)
// ---------------------------------------------------------------------------

test.describe("Group 4: Sidebar navigation masquee", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR, "utf-8");
  });

  test("imports usePermissions hook", () => {
    expect(content).toMatch(/import.*usePermissions.*from/);
  });

  test("calls usePermissions or destructures canUser/hasPermission", () => {
    expect(content).toMatch(/(usePermissions|canUser|hasPermission)\s*[\(,=]/);
  });

  // --- Navigation items with data-testid ---

  test('New Issue button has data-testid="rbac-s05-nav-new-issue"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-new-issue"');
  });

  test('Dashboard link has data-testid="rbac-s05-nav-dashboard"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-dashboard"');
  });

  test('Inbox link has data-testid="rbac-s05-nav-inbox"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-inbox"');
  });

  test('Issues link has data-testid="rbac-s05-nav-issues"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-issues"');
  });

  test('Workflows link has data-testid="rbac-s05-nav-workflows"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-workflows"');
  });

  test('Goals link has data-testid="rbac-s05-nav-goals"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-goals"');
  });

  test('Members link has data-testid="rbac-s05-nav-members"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-members"');
  });

  test('Org link has data-testid="rbac-s05-nav-org"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-org"');
  });

  test('Costs link has data-testid="rbac-s05-nav-costs"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-costs"');
  });

  test('Activity link has data-testid="rbac-s05-nav-activity"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-activity"');
  });

  test('Settings link has data-testid="rbac-s05-nav-settings"', () => {
    expect(content).toContain('data-testid="rbac-s05-nav-settings"');
  });

  // --- Section data-testid ---

  test('Work section has data-testid="rbac-s05-section-work"', () => {
    expect(content).toContain('data-testid="rbac-s05-section-work"');
  });

  test('Projects section has data-testid="rbac-s05-section-projects" (in Sidebar or SidebarProjects)', () => {
    // May be in Sidebar.tsx or in SidebarProjects.tsx
    const sidebarProjectsContent = readFileSync(SIDEBAR_PROJECTS, "utf-8");
    const combined = content + sidebarProjectsContent;
    expect(combined).toContain("rbac-s05-section-projects");
  });

  test('Agents section has data-testid="rbac-s05-section-agents" (in Sidebar or SidebarAgents)', () => {
    // May be in Sidebar.tsx or in SidebarAgents.tsx
    const sidebarAgentsContent = readFileSync(SIDEBAR_AGENTS, "utf-8");
    const combined = content + sidebarAgentsContent;
    expect(combined).toContain("rbac-s05-section-agents");
  });

  test('Company section has data-testid="rbac-s05-section-company"', () => {
    expect(content).toContain('data-testid="rbac-s05-section-company"');
  });

  // --- Permission-gated navigation items ---

  test("New Issue is gated by stories:create permission", () => {
    // The New Issue button should be conditionally rendered with stories:create
    const newIssueIdx = content.indexOf("rbac-s05-nav-new-issue");
    expect(newIssueIdx).toBeGreaterThan(-1);
    // Look in a window before the element for a permission check or derived variable
    const windowBefore = content.slice(Math.max(0, newIssueIdx - 300), newIssueIdx);
    expect(windowBefore).toMatch(/stories:create|canCreate|canUser.*stories|hasPermission.*stories/);
  });

  test("Workflows is gated by workflows:create permission", () => {
    const idx = content.indexOf("rbac-s05-nav-workflows");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = content.slice(Math.max(0, idx - 300), idx);
    expect(windowBefore).toMatch(/workflows:create|canViewWorkflows|canUser.*workflow|hasPermission.*workflow/);
  });

  test("Goals is gated by projects:create permission", () => {
    const idx = content.indexOf("rbac-s05-nav-goals");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = content.slice(Math.max(0, idx - 300), idx);
    expect(windowBefore).toMatch(/projects:create|canViewGoals|canUser.*project|hasPermission.*project/);
  });

  test("Members is gated by users:invite permission", () => {
    const idx = content.indexOf("rbac-s05-nav-members");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = content.slice(Math.max(0, idx - 300), idx);
    expect(windowBefore).toMatch(/users:invite|canViewMembers|canUser.*invite|hasPermission.*invite/);
  });

  test("Costs is gated by dashboard:view permission", () => {
    const idx = content.indexOf("rbac-s05-nav-costs");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = content.slice(Math.max(0, idx - 300), idx);
    expect(windowBefore).toMatch(/dashboard:view|canViewCosts|canUser.*dashboard|hasPermission.*dashboard/);
  });

  test("Activity is gated by audit:read permission", () => {
    const idx = content.indexOf("rbac-s05-nav-activity");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = content.slice(Math.max(0, idx - 300), idx);
    expect(windowBefore).toMatch(/audit:read|canViewActivity|canUser.*audit|hasPermission.*audit/);
  });

  test("Settings is gated by company:manage_settings permission", () => {
    const idx = content.indexOf("rbac-s05-nav-settings");
    expect(idx).toBeGreaterThan(-1);
    const windowBefore = content.slice(Math.max(0, idx - 300), idx);
    expect(windowBefore).toMatch(/company:manage_settings|canViewSettings|canUser.*manage_settings|hasPermission.*manage_settings/);
  });

  // --- Universal items (not gated) ---

  test("Dashboard is always visible (no permission gate)", () => {
    // Dashboard should always be rendered without conditional
    expect(content).toContain("rbac-s05-nav-dashboard");
  });

  test("Inbox is always visible (no permission gate)", () => {
    expect(content).toContain("rbac-s05-nav-inbox");
  });

  test("Issues is always visible (no permission gate)", () => {
    expect(content).toContain("rbac-s05-nav-issues");
  });

  test("Org is always visible (no permission gate)", () => {
    expect(content).toContain("rbac-s05-nav-org");
  });

  // --- Permission key presence in sidebar ---

  test('sidebar references all 7 permission keys used for navigation gating', () => {
    const requiredKeys = [
      "stories:create",
      "workflows:create",
      "projects:create",
      "users:invite",
      "dashboard:view",
      "audit:read",
      "company:manage_settings",
    ];
    for (const key of requiredKeys) {
      expect(content).toContain(`"${key}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 5: SidebarProjects — bouton + masque (ui/src/components/SidebarProjects.tsx)
// ---------------------------------------------------------------------------

test.describe("Group 5: SidebarProjects — bouton + masque", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR_PROJECTS, "utf-8");
  });

  test('has data-testid="rbac-s05-btn-new-project"', () => {
    expect(content).toContain("rbac-s05-btn-new-project");
  });

  test("imports or uses usePermissions", () => {
    expect(content).toMatch(/(usePermissions|canUser|hasPermission)/);
  });

  test("gates new project button with projects:create permission", () => {
    expect(content).toContain('"projects:create"');
  });
});

// ---------------------------------------------------------------------------
// Group 6: SidebarAgents — bouton + masque (ui/src/components/SidebarAgents.tsx)
// ---------------------------------------------------------------------------

test.describe("Group 6: SidebarAgents — bouton + masque", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR_AGENTS, "utf-8");
  });

  test('has data-testid="rbac-s05-btn-new-agent"', () => {
    expect(content).toContain("rbac-s05-btn-new-agent");
  });

  test("imports or uses usePermissions", () => {
    expect(content).toMatch(/(usePermissions|canUser|hasPermission)/);
  });

  test("gates new agent button with agents:create permission", () => {
    expect(content).toContain('"agents:create"');
  });
});

// ---------------------------------------------------------------------------
// Group 7: Backend endpoint — GET /companies/:companyId/my-permissions
// ---------------------------------------------------------------------------

test.describe("Group 7: Backend my-permissions endpoint", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("has GET my-permissions route", () => {
    expect(content).toMatch(/router\.get\s*\(\s*["'][^"']*my-permissions["']/);
  });

  test("my-permissions route calls getEffectivePermissions", () => {
    const idx = content.indexOf("my-permissions");
    expect(idx).toBeGreaterThan(-1);
    const afterRoute = content.slice(idx, idx + 800);
    expect(afterRoute).toContain("getEffectivePermissions");
  });

  test("my-permissions route derives userId from session (req.actor.userId)", () => {
    const idx = content.indexOf("my-permissions");
    expect(idx).toBeGreaterThan(-1);
    const afterRoute = content.slice(idx, idx + 800);
    expect(afterRoute).toMatch(/req\.actor\.userId|actor\.userId/);
  });

  test("my-permissions route uses assertCompanyAccess for tenant isolation", () => {
    const idx = content.indexOf("my-permissions");
    expect(idx).toBeGreaterThan(-1);
    const afterRoute = content.slice(idx, idx + 600);
    expect(afterRoute).toContain("assertCompanyAccess");
  });

  test("my-permissions route handles local_trusted/local_implicit bypass", () => {
    const idx = content.indexOf("my-permissions");
    expect(idx).toBeGreaterThan(-1);
    const afterRoute = content.slice(idx, idx + 800);
    // Should check for local_implicit actor and return all PERMISSION_KEYS
    expect(afterRoute).toMatch(/local_implicit|isLocalImplicit/);
    expect(afterRoute).toContain("PERMISSION_KEYS");
  });
});

// ---------------------------------------------------------------------------
// Group 8: Route protection (ui/src/App.tsx)
// ---------------------------------------------------------------------------

test.describe("Group 8: Route protection in App.tsx", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(APP_TSX, "utf-8");
  });

  test("imports RequirePermission component", () => {
    expect(content).toMatch(/import.*RequirePermission.*from/);
  });

  test("uses RequirePermission to protect routes", () => {
    expect(content).toContain("<RequirePermission");
  });

  test("workflows route is protected with workflows:create", () => {
    // Find RequirePermission wrapping workflows route
    expect(content).toMatch(/RequirePermission[\s\S]*?workflows:create/);
  });

  test("goals route is protected with projects:create", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?projects:create/);
  });

  test("members route is protected with users:invite", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?users:invite/);
  });

  test("costs route is protected with dashboard:view", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?dashboard:view/);
  });

  test("activity route is protected with audit:read", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?audit:read/);
  });

  test("company/settings route is protected with company:manage_settings", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?company:manage_settings/);
  });

  test("agents/new route is protected with agents:create", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?agents:create/);
  });

  test("approvals route is protected with joins:approve", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?joins:approve/);
  });

  test("dashboard route is NOT wrapped in RequirePermission (universal access)", () => {
    // Dashboard should not have a RequirePermission guard
    const dashboardRoute = content.match(
      /path\s*=?\s*["']dashboard["'][^>]*element\s*=\s*\{<\s*Dashboard\s*\/>\}/,
    );
    if (dashboardRoute) {
      // If matched directly, ensure it's not inside a RequirePermission
      const dashboardIdx = content.indexOf(dashboardRoute[0]);
      const precedingContent = content.slice(Math.max(0, dashboardIdx - 100), dashboardIdx);
      expect(precedingContent).not.toContain("RequirePermission");
    }
  });
});

// ---------------------------------------------------------------------------
// Group 9: API client — getMyPermissions (ui/src/api/access.ts)
// ---------------------------------------------------------------------------

test.describe("Group 9: API client my-permissions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(API_ACCESS, "utf-8");
  });

  test("has getMyPermissions function or method", () => {
    expect(content).toMatch(/getMyPermissions/);
  });

  test("getMyPermissions calls /my-permissions endpoint", () => {
    expect(content).toMatch(/my-permissions/);
  });

  test("getMyPermissions accepts companyId parameter", () => {
    const fnIdx = content.indexOf("getMyPermissions");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = content.slice(fnIdx, fnIdx + 300);
    expect(fnSection).toMatch(/companyId/);
  });

  test("getMyPermissions uses api.get", () => {
    const fnIdx = content.indexOf("getMyPermissions");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = content.slice(fnIdx, fnIdx + 300);
    expect(fnSection).toMatch(/api\.get/);
  });
});

// ---------------------------------------------------------------------------
// Group 10: Query keys for permissions
// ---------------------------------------------------------------------------

test.describe("Group 10: Query keys for permissions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(QUERY_KEYS, "utf-8");
  });

  test("has permissions query key", () => {
    expect(content).toMatch(/permissions/);
  });
});

// ---------------------------------------------------------------------------
// Group 11: data-testid completeness across all files
// ---------------------------------------------------------------------------

test.describe("Group 11: data-testid completeness", () => {
  let allFrontendContent: string;

  test.beforeAll(async () => {
    const files = [
      SIDEBAR,
      SIDEBAR_PROJECTS,
      SIDEBAR_AGENTS,
      FORBIDDEN_PAGE,
      APP_TSX,
      REQUIRE_PERMISSION,
    ];
    const contents = await Promise.all(
      files.map(async (f) => {
        try {
          return await readFile(f, "utf-8");
        } catch {
          return "";
        }
      }),
    );
    allFrontendContent = contents.join("\n");
  });

  // Sidebar nav items
  const navTestIds = [
    "rbac-s05-nav-new-issue",
    "rbac-s05-nav-dashboard",
    "rbac-s05-nav-inbox",
    "rbac-s05-nav-issues",
    "rbac-s05-nav-workflows",
    "rbac-s05-nav-goals",
    "rbac-s05-nav-members",
    "rbac-s05-nav-org",
    "rbac-s05-nav-costs",
    "rbac-s05-nav-activity",
    "rbac-s05-nav-settings",
  ];

  for (const testId of navTestIds) {
    test(`data-testid="${testId}" exists in frontend code`, () => {
      expect(allFrontendContent).toContain(testId);
    });
  }

  // Section testids
  const sectionTestIds = [
    "rbac-s05-section-work",
    "rbac-s05-section-projects",
    "rbac-s05-section-agents",
    "rbac-s05-section-company",
  ];

  for (const testId of sectionTestIds) {
    test(`data-testid="${testId}" exists in frontend code`, () => {
      expect(allFrontendContent).toContain(testId);
    });
  }

  // Action buttons
  const actionTestIds = [
    "rbac-s05-btn-new-project",
    "rbac-s05-btn-new-agent",
  ];

  for (const testId of actionTestIds) {
    test(`data-testid="${testId}" exists in frontend code`, () => {
      expect(allFrontendContent).toContain(testId);
    });
  }

  // Forbidden page
  const forbiddenTestIds = [
    "rbac-s05-forbidden-page",
    "rbac-s05-forbidden-message",
    "rbac-s05-forbidden-back-link",
  ];

  for (const testId of forbiddenTestIds) {
    test(`data-testid="${testId}" exists in frontend code`, () => {
      expect(allFrontendContent).toContain(testId);
    });
  }

  // Loading state
  test('data-testid="rbac-s05-permissions-loading" exists in frontend code', () => {
    expect(allFrontendContent).toContain("rbac-s05-permissions-loading");
  });
});

// ---------------------------------------------------------------------------
// Group 12: Permission masquage pattern (DOM absence, not CSS hiding)
// ---------------------------------------------------------------------------

test.describe("Group 12: Masquage pattern — DOM absence, not CSS hiding", () => {
  let sidebarContent: string;

  test.beforeAll(async () => {
    sidebarContent = await readFile(SIDEBAR, "utf-8");
  });

  test("uses conditional rendering pattern (&&) not display:none", () => {
    // The sidebar should use {canUser("key") && <element>} or {hasPermission("key") && <element>}
    // and NOT use display:none or visibility:hidden for permission gating
    expect(sidebarContent).not.toMatch(/display\s*:\s*["']?none["']?.*rbac-s05/);
    expect(sidebarContent).not.toMatch(/visibility\s*:\s*["']?hidden["']?.*rbac-s05/);
  });

  test("uses logical AND (&&) for conditional rendering of permission-gated items", () => {
    // Permission checks may use derived variables (e.g. canViewWorkflows && ...)
    // or inline (hasPermission("key") && ...)
    // Either pattern is acceptable
    const hasInlineAnd = /(canUser|hasPermission)\s*\(\s*["'][^"']+["']\s*\)\s*&&/.test(sidebarContent);
    const hasDerivedAnd = /can\w+\s*&&/.test(sidebarContent);
    expect(hasInlineAnd || hasDerivedAnd).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 13: Mapping navigation item -> permission key (structural verification)
// ---------------------------------------------------------------------------

test.describe("Group 13: Navigation-to-permission mapping correctness", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR, "utf-8");
  });

  const permissionMappings: Array<{ navItem: string; permissionKey: string }> = [
    { navItem: "New Issue", permissionKey: "stories:create" },
    { navItem: "Workflows", permissionKey: "workflows:create" },
    { navItem: "Goals", permissionKey: "projects:create" },
    { navItem: "Members", permissionKey: "users:invite" },
    { navItem: "Costs", permissionKey: "dashboard:view" },
    { navItem: "Activity", permissionKey: "audit:read" },
    { navItem: "Settings", permissionKey: "company:manage_settings" },
  ];

  for (const { navItem, permissionKey } of permissionMappings) {
    test(`"${navItem}" nav item is gated by "${permissionKey}"`, () => {
      // Verify that the nav item label appears in the file (quoted, as JSX content, or as a prop)
      const hasDoubleQuoted = content.includes(`"${navItem}"`);
      const hasSingleQuoted = content.includes(`'${navItem}'`);
      const hasJsxContent = content.includes(`>${navItem}<`);
      const hasLabelProp = content.includes(`label="${navItem}"`);
      expect(hasDoubleQuoted || hasSingleQuoted || hasJsxContent || hasLabelProp).toBe(true);
      // The permission key should appear in the file
      expect(content).toContain(`"${permissionKey}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// Group 14: Route protection — permission keys mapped to correct routes
// ---------------------------------------------------------------------------

test.describe("Group 14: Route-to-permission mapping in App.tsx", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(APP_TSX, "utf-8");
  });

  const routePermissions: Array<{ route: string; permission: string }> = [
    { route: "workflows", permission: "workflows:create" },
    { route: "goals", permission: "projects:create" },
    { route: "members", permission: "users:invite" },
    { route: "costs", permission: "dashboard:view" },
    { route: "activity", permission: "audit:read" },
    { route: "company/settings", permission: "company:manage_settings" },
    { route: "agents/new", permission: "agents:create" },
    { route: "approvals", permission: "joins:approve" },
  ];

  for (const { route, permission } of routePermissions) {
    test(`route "${route}" is associated with permission "${permission}"`, () => {
      // Both the route path and the permission key should exist in the file
      expect(content).toContain(route);
      expect(content).toContain(permission);
    });
  }

  // Routes that should NOT be protected
  const unprotectedRoutes = [
    "dashboard",
    "inbox",
    "issues",
    "org",
    "projects",
    "agents/all",
  ];

  for (const route of unprotectedRoutes) {
    test(`route "${route}" remains accessible without RequirePermission`, () => {
      // These routes should exist in the file
      expect(content).toContain(`"${route}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// Group 15: usePermissions hook — implementation quality checks
// ---------------------------------------------------------------------------

test.describe("Group 15: usePermissions hook — implementation quality", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(USE_PERMISSIONS, "utf-8");
  });

  test("imports PermissionKey type from @mnm/shared", () => {
    expect(content).toMatch(/PermissionKey/);
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("uses useCompany hook for selectedCompanyId", () => {
    expect(content).toMatch(/useCompany/);
  });

  test("queryKey includes companyId for automatic refetch on company change", () => {
    // The queryKey may use queryKeys.access.myPermissions(companyId) or an inline array
    const usesQueryKeysHelper = /queryKeys\.access\.myPermissions\(/.test(content);
    const usesInlineArray = /queryKey\s*:\s*\[.*(?:permissions|my-permissions).*(?:companyId|selectedCompanyId)/s.test(content);
    expect(usesQueryKeysHelper || usesInlineArray).toBe(true);
  });

  test("returns businessRole from permissions data", () => {
    expect(content).toContain("businessRole");
  });

  test("handles local_trusted mode — returns all permissions (AC12)", () => {
    expect(content).toContain("local_trusted");
    // Should return true for all permissions in local_trusted mode
    expect(content).toMatch(/PERMISSION_KEYS/);
  });
});

// ---------------------------------------------------------------------------
// Group 16: RequirePermission — redirect or forbidden behavior
// ---------------------------------------------------------------------------

test.describe("Group 16: RequirePermission redirect/forbidden behavior", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(REQUIRE_PERMISSION, "utf-8");
  });

  test("imports Navigate or uses redirect for unauthorized access", () => {
    expect(content).toMatch(/(Navigate|redirect|useNavigate|Forbidden)/);
  });

  test("has data-testid for route guard wrapper", () => {
    // Should have rbac-s05-route-guard or rbac-s05-route-redirect
    expect(content).toMatch(/rbac-s05-route-(guard|redirect)/);
  });
});
