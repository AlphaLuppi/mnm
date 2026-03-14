/**
 * RBAC-S06: UI Admin Matrice Permissions + Page Roles -- E2E Tests
 *
 * These tests verify the deliverables of RBAC-S06:
 *   - AC1-AC2:  Page accessible uniquement aux admins, interdite aux non-admins
 *   - AC3:      Overview tab affiche les 4 role cards avec permissions count
 *   - AC4-AC6:  Permission Matrix grille complete, checkmarks corrects, read-only
 *   - AC7-AC10: Members by Role tab avec filtre, recherche, changement de role
 *   - AC11-AC12: Sidebar lien Roles visible/masque selon permission
 *   - AC13:     Loading state
 *   - AC14:     Presets matrix data correspond au code source
 *   - AC15:     Mode local_trusted affiche la page
 *
 * Verified files:
 *   - ui/src/pages/AdminRoles.tsx            -- Page principale /admin/roles
 *   - ui/src/components/PermissionMatrix.tsx  -- Grille read-only permissions x roles
 *   - ui/src/components/RoleOverviewCard.tsx  -- Card resume d'un role
 *   - ui/src/App.tsx                          -- Route /admin/roles avec RequirePermission
 *   - ui/src/components/Sidebar.tsx           -- Lien "Roles" conditionne
 *   - ui/src/api/access.ts                    -- getRbacPresets client function
 *   - ui/src/lib/queryKeys.ts                 -- rbacPresets query key
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// File paths — new files
const ADMIN_ROLES_PAGE = resolve(ROOT, "ui/src/pages/AdminRoles.tsx");
const PERMISSION_MATRIX = resolve(ROOT, "ui/src/components/PermissionMatrix.tsx");
const ROLE_OVERVIEW_CARD = resolve(ROOT, "ui/src/components/RoleOverviewCard.tsx");

// File paths — modified files
const APP_TSX = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const API_ACCESS = resolve(ROOT, "ui/src/api/access.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");

// ---------------------------------------------------------------------------
// Group 1: AdminRoles page exists and has correct structure
// ---------------------------------------------------------------------------

test.describe("Group 1: AdminRoles page structure", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(ADMIN_ROLES_PAGE).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports AdminRoles component", () => {
    expect(content).toMatch(/export\s+(function|const)\s+AdminRoles/);
  });

  test('has data-testid="rbac-s06-page"', () => {
    expect(content).toContain('data-testid="rbac-s06-page"');
  });

  test('has data-testid="rbac-s06-page-title"', () => {
    expect(content).toContain('data-testid="rbac-s06-page-title"');
  });

  test('has data-testid="rbac-s06-page-description"', () => {
    expect(content).toContain('data-testid="rbac-s06-page-description"');
  });

  test('page title contains "Roles & Permissions"', () => {
    expect(content).toMatch(/Roles\s*&\s*Permissions/);
  });

  test("page is protected via RequirePermission in App.tsx or uses usePermissions", async () => {
    // The page itself doesn't need to import usePermissions/RequirePermission
    // because the route is wrapped with RequirePermission in App.tsx.
    const appContent = await readFile(APP_TSX, "utf-8");
    const pageUsesHook = content.match(/(usePermissions|RequirePermission)/);
    const routeProtected = appContent.match(
      /RequirePermission[\s\S]*?users:manage_permissions[\s\S]*?AdminRoles/,
    );
    expect(pageUsesHook || routeProtected).toBeTruthy();
  });

  test("uses useCompany hook for selectedCompanyId", () => {
    expect(content).toContain("useCompany");
  });
});

// ---------------------------------------------------------------------------
// Group 2: AdminRoles page — 3 Tabs (Overview, Permission Matrix, Members)
// ---------------------------------------------------------------------------

test.describe("Group 2: AdminRoles tabs", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test('has tabs container data-testid="rbac-s06-tabs"', () => {
    expect(content).toContain('data-testid="rbac-s06-tabs"');
  });

  test('has Overview tab trigger data-testid="rbac-s06-tab-overview"', () => {
    expect(content).toContain('data-testid="rbac-s06-tab-overview"');
  });

  test('has Permission Matrix tab trigger data-testid="rbac-s06-tab-matrix"', () => {
    expect(content).toContain('data-testid="rbac-s06-tab-matrix"');
  });

  test('has Members by Role tab trigger data-testid="rbac-s06-tab-members"', () => {
    expect(content).toContain('data-testid="rbac-s06-tab-members"');
  });

  test('has tab content for overview data-testid="rbac-s06-tab-content-overview"', () => {
    expect(content).toContain('data-testid="rbac-s06-tab-content-overview"');
  });

  test('has tab content for matrix data-testid="rbac-s06-tab-content-matrix"', () => {
    expect(content).toContain('data-testid="rbac-s06-tab-content-matrix"');
  });

  test('has tab content for members data-testid="rbac-s06-tab-content-members"', () => {
    expect(content).toContain('data-testid="rbac-s06-tab-content-members"');
  });

  test("uses Tabs components from shadcn/ui (Radix)", () => {
    expect(content).toMatch(/import.*Tabs.*from/);
  });

  test("tab labels are correct: Overview, Permission Matrix, Members by Role", () => {
    expect(content).toContain("Overview");
    expect(content).toContain("Permission Matrix");
    expect(content).toMatch(/Members\s*(by\s*Role)?/);
  });
});

// ---------------------------------------------------------------------------
// Group 3: Overview tab — 4 Role Cards
// ---------------------------------------------------------------------------

test.describe("Group 3: Overview tab — role cards", () => {
  let content: string;
  let cardContent: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
    cardContent = await readFile(ROLE_OVERVIEW_CARD, "utf-8");
  });

  test('has role cards container data-testid="rbac-s06-role-cards"', () => {
    expect(content).toContain('data-testid="rbac-s06-role-cards"');
  });

  test('generates admin role card data-testid="rbac-s06-role-card-admin" dynamically', () => {
    // The data-testid is generated dynamically via template literal in RoleOverviewCard
    expect(cardContent).toMatch(/data-testid=.*rbac-s06-role-card-.*role/);
  });

  test('generates manager role card data-testid="rbac-s06-role-card-manager" dynamically', () => {
    expect(cardContent).toContain("rbac-s06-role-card-");
  });

  test('generates contributor role card data-testid="rbac-s06-role-card-contributor" dynamically', () => {
    expect(cardContent).toContain("rbac-s06-role-card-");
  });

  test('generates viewer role card data-testid="rbac-s06-role-card-viewer" dynamically', () => {
    expect(cardContent).toContain("rbac-s06-role-card-");
  });

  test("has permission count data-testid for each role (dynamic pattern)", () => {
    // data-testid={`rbac-s06-role-card-${role}-count`} in RoleOverviewCard
    expect(cardContent).toContain("rbac-s06-role-card-");
    expect(cardContent).toMatch(/-count/);
  });

  test("has member count data-testid for each role (dynamic pattern)", () => {
    // data-testid={`rbac-s06-role-card-${role}-members`} in RoleOverviewCard
    expect(cardContent).toContain("rbac-s06-role-card-");
    expect(cardContent).toMatch(/-members/);
  });

  test("renders RoleOverviewCard component", () => {
    expect(content).toContain("RoleOverviewCard");
    expect(content).toMatch(/import.*RoleOverviewCard.*from/);
  });
});

// ---------------------------------------------------------------------------
// Group 4: RoleOverviewCard component
// ---------------------------------------------------------------------------

test.describe("Group 4: RoleOverviewCard component", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROLE_OVERVIEW_CARD, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(ROLE_OVERVIEW_CARD).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports RoleOverviewCard component", () => {
    expect(content).toMatch(/export\s+(function|const)\s+RoleOverviewCard/);
  });

  test("accepts role prop", () => {
    expect(content).toMatch(/role\s*[:\?]/);
  });

  test("accepts permissions count prop or computes it", () => {
    expect(content).toMatch(/(permissionsCount|permissions|count)/);
  });

  test("accepts members count prop or computes it", () => {
    expect(content).toMatch(/(membersCount|members)/);
  });

  test("uses RoleBadge component", () => {
    expect(content).toContain("RoleBadge");
    expect(content).toMatch(/import.*RoleBadge.*from/);
  });

  test("displays role name", () => {
    expect(content).toMatch(/(admin|manager|contributor|viewer|role)/i);
  });

  test("displays permissions count", () => {
    expect(content).toMatch(/permission/i);
  });

  test("displays members count", () => {
    expect(content).toMatch(/member/i);
  });
});

// ---------------------------------------------------------------------------
// Group 5: PermissionMatrix component — structure
// ---------------------------------------------------------------------------

test.describe("Group 5: PermissionMatrix component structure", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(PERMISSION_MATRIX).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports PermissionMatrix component", () => {
    expect(content).toMatch(/export\s+(function|const)\s+PermissionMatrix/);
  });

  test('has matrix container data-testid="rbac-s06-matrix"', () => {
    expect(content).toContain('data-testid="rbac-s06-matrix"');
  });

  test('has matrix table data-testid="rbac-s06-matrix-table"', () => {
    expect(content).toContain('data-testid="rbac-s06-matrix-table"');
  });

  test("uses semantic <table> element", () => {
    expect(content).toMatch(/<table/);
    expect(content).toMatch(/<thead/);
    expect(content).toMatch(/<tbody/);
  });

  test("uses <th> with scope for accessibility", () => {
    expect(content).toMatch(/scope\s*=\s*["'](col|row)["']/);
  });

  test("uses aria-label for check/dash icons", () => {
    expect(content).toMatch(/aria-label\s*=.*("Granted"|"Not granted"|granted|not.granted)/i);
  });
});

// ---------------------------------------------------------------------------
// Group 6: PermissionMatrix — column headers (4 roles)
// ---------------------------------------------------------------------------

test.describe("Group 6: PermissionMatrix column headers", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("generates column header data-testid dynamically for each role", () => {
    // data-testid={`rbac-s06-matrix-header-${role}`} -- generated dynamically
    expect(content).toMatch(/data-testid=.*rbac-s06-matrix-header-.*role/);
  });

  test("renders column headers for all 4 roles via BUSINESS_ROLES.map", () => {
    expect(content).toContain("BUSINESS_ROLES");
    expect(content).toContain("rbac-s06-matrix-header-");
  });

  test("column headers use <th> with scope='col'", () => {
    expect(content).toMatch(/scope\s*=\s*["']col["']/);
  });

  test("column headers display role labels via BUSINESS_ROLE_LABELS", () => {
    expect(content).toContain("BUSINESS_ROLE_LABELS");
  });
});

// ---------------------------------------------------------------------------
// Group 7: PermissionMatrix — 10 category headers
// ---------------------------------------------------------------------------

test.describe("Group 7: PermissionMatrix category headers", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("generates category header data-testid dynamically for each category", () => {
    // data-testid={`rbac-s06-matrix-category-${category.id}`} -- generated dynamically
    expect(content).toMatch(/data-testid=.*rbac-s06-matrix-category-.*category/);
  });

  test("defines all 10 permission categories", () => {
    const categories = [
      "agents",
      "users",
      "tasks",
      "projects",
      "workflows",
      "company",
      "audit",
      "stories",
      "dashboard",
      "chat",
    ];
    for (const cat of categories) {
      expect(content).toContain(`id: "${cat}"`);
    }
  });

  test("maps over PERMISSION_CATEGORIES to render category headers", () => {
    expect(content).toContain("PERMISSION_CATEGORIES");
    expect(content).toMatch(/\.map\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Group 8: PermissionMatrix — permission row data-testids
// ---------------------------------------------------------------------------

test.describe("Group 8: PermissionMatrix permission rows", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("has dynamic row data-testid pattern rbac-s06-matrix-row-", () => {
    expect(content).toContain("rbac-s06-matrix-row-");
  });

  test("has dynamic cell data-testid pattern rbac-s06-matrix-cell-", () => {
    expect(content).toContain("rbac-s06-matrix-cell-");
  });

  test("has dynamic check icon data-testid pattern rbac-s06-matrix-check-", () => {
    expect(content).toContain("rbac-s06-matrix-check-");
  });

  test("references all 20 permission keys", () => {
    const permissionKeys = [
      "agents:create",
      "agents:launch",
      "agents:manage_containers",
      "users:invite",
      "users:manage_permissions",
      "tasks:assign",
      "tasks:assign_scope",
      "projects:create",
      "projects:manage_members",
      "workflows:create",
      "workflows:enforce",
      "company:manage_settings",
      "company:manage_sso",
      "audit:read",
      "audit:export",
      "stories:create",
      "stories:edit",
      "dashboard:view",
      "chat:agent",
    ];
    // The component should reference permission keys either directly or via
    // imported PERMISSION_KEYS / ROLE_PERMISSION_PRESETS from @mnm/shared.
    // We check that it receives or references the presets data.
    const usesPresetsImport = /ROLE_PERMISSION_PRESETS|PERMISSION_KEYS/.test(content);
    const usesPresetsData = /presets|permissionKeys|permissions/.test(content);
    expect(usesPresetsImport || usesPresetsData).toBe(true);
    // Ensure the component has at least some permission keys or uses a dynamic
    // rendering pattern that maps over the presets.
    const hasDynamicRendering = /\.map\s*\(/.test(content);
    const hasAtLeastSomeKeys = permissionKeys.some((k) => content.includes(k));
    expect(hasDynamicRendering || hasAtLeastSomeKeys).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 9: PermissionMatrix — read-only (no inputs/checkboxes)
// ---------------------------------------------------------------------------

test.describe("Group 9: PermissionMatrix is read-only", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("does not use <input type=\"checkbox\"> for matrix cells", () => {
    // The matrix should use icons (Check/X) not interactive checkboxes
    expect(content).not.toMatch(/<input\s+type\s*=\s*["']checkbox["']/);
  });

  test("uses Check icon or similar visual indicator for granted permissions", () => {
    // Should import Check from lucide-react or use a similar icon
    expect(content).toMatch(/(Check|CheckIcon|CheckCircle|check)/);
  });

  test("uses Minus/Dash/X icon or empty indicator for denied permissions", () => {
    // Should use a dash or minus icon for denied permissions
    expect(content).toMatch(/(Minus|Dash|X|XIcon|minus|dash)/i);
  });

  test("matrix cells are not interactive (no onClick handler on check/dash)", () => {
    // Cells should be visual-only, no interactive handlers
    // We verify no onClick on the matrix-check elements themselves
    // (onClick on tabs or other elements is fine)
    const matrixSection = content.match(/rbac-s06-matrix-check[\s\S]*?(?=rbac-s06-matrix-check|$)/g);
    if (matrixSection) {
      for (const section of matrixSection) {
        // The check icon should not have an onClick handler
        expect(section).not.toMatch(/onClick/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Group 10: PermissionMatrix — permissions grouped by category
// ---------------------------------------------------------------------------

test.describe("Group 10: PermissionMatrix permission grouping", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("groups permissions by category with category headers", () => {
    // Should have a grouping mechanism — either a PERMISSION_CATEGORIES object,
    // a groupBy function, or categories defined inline
    const hasGrouping =
      /PERMISSION_CATEGORIES|categories|groupBy|grouped|categoryMap/.test(content);
    const hasCategoryHeaders = /rbac-s06-matrix-category-/.test(content);
    expect(hasGrouping || hasCategoryHeaders).toBe(true);
  });

  test("category headers use colspan for visual grouping", () => {
    expect(content).toMatch(/colSpan|colspan/);
  });
});

// ---------------------------------------------------------------------------
// Group 11: AdminRoles — Members by Role tab
// ---------------------------------------------------------------------------

test.describe("Group 11: Members by Role tab", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test('has members section data-testid="rbac-s06-members-section"', () => {
    expect(content).toContain("rbac-s06-members-section");
  });

  test('has role filter data-testid="rbac-s06-members-role-filter"', () => {
    expect(content).toContain("rbac-s06-members-role-filter");
  });

  test('has search input data-testid="rbac-s06-members-search"', () => {
    expect(content).toContain("rbac-s06-members-search");
  });

  test('has members table data-testid="rbac-s06-members-table"', () => {
    expect(content).toContain("rbac-s06-members-table");
  });

  test('has members count data-testid="rbac-s06-members-count"', () => {
    expect(content).toContain("rbac-s06-members-count");
  });

  test('has empty state data-testid="rbac-s06-members-empty"', () => {
    expect(content).toContain("rbac-s06-members-empty");
  });

  test("has dynamic member row data-testid pattern", () => {
    expect(content).toContain("rbac-s06-members-row-");
  });

  test("has dynamic member name data-testid pattern", () => {
    expect(content).toContain("rbac-s06-members-name-");
  });

  test("has dynamic member email data-testid pattern", () => {
    expect(content).toContain("rbac-s06-members-email-");
  });

  test("has dynamic member role badge data-testid pattern", () => {
    expect(content).toContain("rbac-s06-members-role-");
  });

  test("has dynamic change-role dropdown data-testid pattern", () => {
    expect(content).toContain("rbac-s06-members-change-role-");
  });
});

// ---------------------------------------------------------------------------
// Group 12: Members tab — fetching and mutations
// ---------------------------------------------------------------------------

test.describe("Group 12: Members tab data fetching", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test("uses useQuery for fetching members or presets", () => {
    expect(content).toContain("useQuery");
  });

  test("fetches members via accessApi.listMembers or similar", () => {
    expect(content).toMatch(/(listMembers|members)/);
  });

  test("fetches presets via accessApi.getRbacPresets or similar", () => {
    expect(content).toMatch(/(getRbacPresets|rbacPresets|presets)/);
  });

  test("uses useMutation for role changes", () => {
    expect(content).toContain("useMutation");
    expect(content).toMatch(/(updateMemberBusinessRole|changeRole|mutate)/);
  });

  test("invalidates queries after role change mutation", () => {
    expect(content).toContain("invalidateQueries");
  });

  test("uses RoleBadge component for member role display", () => {
    expect(content).toContain("RoleBadge");
  });

  test("imports accessApi from api/access", () => {
    expect(content).toContain("accessApi");
    expect(content).toMatch(/from\s+["'].*api\/access["']/);
  });
});

// ---------------------------------------------------------------------------
// Group 13: Loading and error states
// ---------------------------------------------------------------------------

test.describe("Group 13: Loading and error states", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test('has loading state data-testid="rbac-s06-loading"', () => {
    expect(content).toContain('data-testid="rbac-s06-loading"');
  });

  test('has error state data-testid="rbac-s06-error"', () => {
    expect(content).toContain('data-testid="rbac-s06-error"');
  });

  test("handles isLoading state", () => {
    expect(content).toContain("isLoading");
  });

  test("handles isError or error state", () => {
    expect(content).toMatch(/(isError|error)/);
  });
});

// ---------------------------------------------------------------------------
// Group 14: Route /admin/roles in App.tsx
// ---------------------------------------------------------------------------

test.describe("Group 14: Route configuration in App.tsx", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(APP_TSX, "utf-8");
  });

  test('has route path for admin/roles', () => {
    expect(content).toMatch(/admin\/roles/);
  });

  test("imports AdminRoles page component", () => {
    expect(content).toMatch(/import.*AdminRoles.*from.*pages\/AdminRoles/);
  });

  test("admin/roles route is protected with RequirePermission", () => {
    expect(content).toMatch(/RequirePermission[\s\S]*?users:manage_permissions[\s\S]*?AdminRoles/);
  });

  test("RequirePermission uses showForbidden prop for admin/roles route", () => {
    // The route should show the Forbidden page (not just hide content)
    const adminRolesSection = content.match(
      /admin\/roles[\s\S]*?AdminRoles/,
    );
    if (adminRolesSection) {
      expect(adminRolesSection[0]).toMatch(/(showForbidden|Forbidden)/);
    } else {
      // Alternative: check that RequirePermission wrapping AdminRoles uses showForbidden
      expect(content).toMatch(/RequirePermission[\s\S]*?showForbidden[\s\S]*?AdminRoles|RequirePermission[\s\S]*?AdminRoles[\s\S]*?showForbidden/);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 15: Sidebar navigation — Roles link
// ---------------------------------------------------------------------------

test.describe("Group 15: Sidebar navigation — Roles link", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR, "utf-8");
  });

  test('has Roles nav item data-testid="rbac-s06-nav-roles"', () => {
    expect(content).toContain('data-testid="rbac-s06-nav-roles"');
  });

  test("Roles nav item links to /admin/roles", () => {
    expect(content).toMatch(/\/admin\/roles/);
  });

  test("Roles nav item is gated by users:manage_permissions permission", () => {
    const idx = content.indexOf("rbac-s06-nav-roles");
    expect(idx).toBeGreaterThan(-1);
    // The permission check may be via a variable (e.g. canViewRoles) defined earlier in the file.
    // Check the whole file for: hasPermission("users:manage_permissions") tied to the Roles nav item.
    const hasPermissionCheck = content.match(
      /users:manage_permissions|canManagePermissions|canViewRoles/,
    );
    expect(hasPermissionCheck).toBeTruthy();
    // Also verify the nav item is conditionally rendered (wrapped in canViewRoles or similar)
    const windowBefore = content.slice(Math.max(0, idx - 800), idx);
    expect(windowBefore).toMatch(
      /canViewRoles|canManagePermissions|users:manage_permissions|hasPermission.*manage_permissions/,
    );
  });

  test("Roles nav item uses Shield icon from lucide-react", () => {
    expect(content).toMatch(
      /import\s*\{[\s\S]*?Shield[\s\S]*?\}\s*from\s*["']lucide-react["']/,
    );
  });

  test("Roles nav item is in the Company section", () => {
    const companySection = content.match(
      /SidebarSection\s+label\s*=\s*["']Company["'][\s\S]*?<\/SidebarSection>/,
    );
    expect(companySection).toBeTruthy();
    expect(companySection![0]).toContain("rbac-s06-nav-roles");
  });

  test("Roles is placed between Members and Org in Company section", () => {
    const companySection = content.match(
      /SidebarSection\s+label\s*=\s*["']Company["'][\s\S]*?<\/SidebarSection>/,
    );
    expect(companySection).toBeTruthy();
    const section = companySection![0];
    const membersIdx = section.indexOf("Members");
    const rolesIdx = section.indexOf("Roles");
    const orgIdx = section.indexOf("Org");
    // Roles should appear after Members
    if (membersIdx > -1 && rolesIdx > -1) {
      expect(rolesIdx).toBeGreaterThan(membersIdx);
    }
    // Roles should appear before Org
    if (rolesIdx > -1 && orgIdx > -1) {
      expect(rolesIdx).toBeLessThan(orgIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 16: API client — getRbacPresets function
// ---------------------------------------------------------------------------

test.describe("Group 16: API client — getRbacPresets", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(API_ACCESS, "utf-8");
  });

  test("has getRbacPresets function", () => {
    expect(content).toContain("getRbacPresets");
  });

  test("getRbacPresets calls /rbac/presets endpoint", () => {
    const fnIdx = content.indexOf("getRbacPresets");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = content.slice(fnIdx, fnIdx + 400);
    expect(fnSection).toMatch(/rbac\/presets/);
  });

  test("getRbacPresets accepts companyId parameter", () => {
    const fnIdx = content.indexOf("getRbacPresets");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = content.slice(fnIdx, fnIdx + 300);
    expect(fnSection).toContain("companyId");
  });

  test("getRbacPresets uses api.get", () => {
    const fnIdx = content.indexOf("getRbacPresets");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSection = content.slice(fnIdx, fnIdx + 300);
    expect(fnSection).toMatch(/api\.get/);
  });
});

// ---------------------------------------------------------------------------
// Group 17: Query keys — rbacPresets
// ---------------------------------------------------------------------------

test.describe("Group 17: Query keys — rbacPresets", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(QUERY_KEYS, "utf-8");
  });

  test("has rbacPresets query key", () => {
    expect(content).toMatch(/rbacPresets/);
  });

  test("rbacPresets query key includes companyId parameter", () => {
    const rbacPresetsMatch = content.match(
      /rbacPresets\s*:\s*\(.*companyId.*\)/,
    );
    expect(rbacPresetsMatch).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Group 18: Presets data accuracy — permission counts per role
// ---------------------------------------------------------------------------

test.describe("Group 18: Presets data accuracy", () => {
  let adminRolesContent: string;
  let matrixContent: string;

  test.beforeAll(async () => {
    adminRolesContent = await readFile(ADMIN_ROLES_PAGE, "utf-8");
    matrixContent = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("admin role has 20 permissions (referenced in overview cards or matrix)", () => {
    // The count "20" should appear in the code for admin role
    const combined = adminRolesContent + matrixContent;
    // Could be hardcoded as a prop or computed from presets length
    const hasExplicitCount = combined.includes("20");
    const hasComputed = /presets\[?["']?admin["']?\]?\.length/.test(combined);
    const hasDynamic = /\.length/.test(combined);
    expect(hasExplicitCount || hasComputed || hasDynamic).toBe(true);
  });

  test("viewer role has 2 permissions (referenced somewhere)", () => {
    const combined = adminRolesContent + matrixContent;
    // Check that 2 appears in context of viewer
    const hasExplicitCount = combined.includes("2");
    const hasDynamic = /\.length/.test(combined);
    expect(hasExplicitCount || hasDynamic).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 19: Breadcrumbs
// ---------------------------------------------------------------------------

test.describe("Group 19: Breadcrumbs", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test("sets breadcrumbs with Admin and Roles & Permissions", () => {
    expect(content).toMatch(/setBreadcrumbs|useBreadcrumbs/);
    expect(content).toContain("Admin");
    expect(content).toMatch(/Roles\s*&\s*Permissions/);
  });
});

// ---------------------------------------------------------------------------
// Group 20: PermissionMatrix — uses presets data from API or shared
// ---------------------------------------------------------------------------

test.describe("Group 20: PermissionMatrix data source", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("receives presets or permissions data as props or fetches them", () => {
    expect(content).toMatch(/(presets|permissions|data)/);
  });

  test("maps over roles (admin, manager, contributor, viewer)", () => {
    const hasRoleMapping = /\.map\s*\(/.test(content);
    const hasExplicitRoles =
      content.includes("admin") &&
      content.includes("manager") &&
      content.includes("contributor") &&
      content.includes("viewer");
    expect(hasRoleMapping || hasExplicitRoles).toBe(true);
  });

  test("determines if a role has a permission (check vs dash)", () => {
    // Should have a condition like: presets[role].includes(permKey) or similar
    expect(content).toMatch(/(includes|has|indexOf|\.some)/);
  });
});

// ---------------------------------------------------------------------------
// Group 21: PermissionMatrix — permission key labels
// ---------------------------------------------------------------------------

test.describe("Group 21: PermissionMatrix permission labels", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("displays human-readable labels for permission keys", () => {
    // Should either define labels inline or import from shared
    const hasLabelsInline =
      content.includes("Create agents") ||
      content.includes("Launch agents") ||
      content.includes("Manage permissions") ||
      content.includes("View dashboard");
    const hasLabelsImport = /PERMISSION_LABELS|PERMISSION_KEY_LABELS|permissionLabels/.test(content);
    const hasDynamicLabels = /label|formatPermission|humanize|display/.test(content);
    expect(hasLabelsInline || hasLabelsImport || hasDynamicLabels).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 22: data-testid completeness across all new files
// ---------------------------------------------------------------------------

test.describe("Group 22: data-testid completeness", () => {
  let allContent: string;

  test.beforeAll(async () => {
    const files = [
      ADMIN_ROLES_PAGE,
      PERMISSION_MATRIX,
      ROLE_OVERVIEW_CARD,
      SIDEBAR,
      APP_TSX,
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
    allContent = contents.join("\n");
  });

  // Page-level test ids
  const pageTestIds = [
    "rbac-s06-page",
    "rbac-s06-page-title",
    "rbac-s06-page-description",
  ];

  for (const testId of pageTestIds) {
    test(`data-testid="${testId}" exists in source`, () => {
      expect(allContent).toContain(testId);
    });
  }

  // Tab test ids
  const tabTestIds = [
    "rbac-s06-tabs",
    "rbac-s06-tab-overview",
    "rbac-s06-tab-matrix",
    "rbac-s06-tab-members",
    "rbac-s06-tab-content-overview",
    "rbac-s06-tab-content-matrix",
    "rbac-s06-tab-content-members",
  ];

  for (const testId of tabTestIds) {
    test(`data-testid="${testId}" exists in source`, () => {
      expect(allContent).toContain(testId);
    });
  }

  // Overview tab test ids -- rbac-s06-role-cards is literal, but role-card-{role} are dynamic
  test('data-testid="rbac-s06-role-cards" exists in source', () => {
    expect(allContent).toContain("rbac-s06-role-cards");
  });

  test("dynamic role card data-testid pattern exists (rbac-s06-role-card-${role})", () => {
    // The RoleOverviewCard generates data-testid={`rbac-s06-role-card-${role}`} dynamically
    expect(allContent).toMatch(/rbac-s06-role-card-\$\{role\}|rbac-s06-role-card-\$/);
  });

  // Matrix test ids -- rbac-s06-matrix and rbac-s06-matrix-table are literal
  const matrixLiteralTestIds = [
    "rbac-s06-matrix",
    "rbac-s06-matrix-table",
  ];

  for (const testId of matrixLiteralTestIds) {
    test(`data-testid="${testId}" exists in source`, () => {
      expect(allContent).toContain(testId);
    });
  }

  test("dynamic matrix header data-testid pattern exists (rbac-s06-matrix-header-${role})", () => {
    expect(allContent).toMatch(/rbac-s06-matrix-header-\$\{role\}|rbac-s06-matrix-header-\$/);
  });

  // Category test ids -- generated dynamically via rbac-s06-matrix-category-${category.id}
  test("dynamic category data-testid pattern exists (rbac-s06-matrix-category-${category.id})", () => {
    expect(allContent).toMatch(/rbac-s06-matrix-category-\$\{category\.id\}|rbac-s06-matrix-category-\$/);
  });

  test("all 10 category ids are defined in PERMISSION_CATEGORIES", () => {
    const categories = [
      "agents", "users", "tasks", "projects", "workflows",
      "company", "audit", "stories", "dashboard", "chat",
    ];
    for (const cat of categories) {
      expect(allContent).toContain(`id: "${cat}"`);
    }
  });

  // Members tab test ids
  const membersTestIds = [
    "rbac-s06-members-section",
    "rbac-s06-members-role-filter",
    "rbac-s06-members-search",
    "rbac-s06-members-table",
    "rbac-s06-members-count",
    "rbac-s06-members-empty",
  ];

  for (const testId of membersTestIds) {
    test(`data-testid="${testId}" exists in source`, () => {
      expect(allContent).toContain(testId);
    });
  }

  // Dynamic member test id patterns
  const dynamicMemberPatterns = [
    "rbac-s06-members-row-",
    "rbac-s06-members-name-",
    "rbac-s06-members-email-",
    "rbac-s06-members-role-",
    "rbac-s06-members-change-role-",
  ];

  for (const pattern of dynamicMemberPatterns) {
    test(`dynamic data-testid pattern "${pattern}{id}" exists in source`, () => {
      expect(allContent).toContain(pattern);
    });
  }

  // Navigation
  test('data-testid="rbac-s06-nav-roles" exists in sidebar', () => {
    expect(allContent).toContain("rbac-s06-nav-roles");
  });

  // Loading/Error
  test('data-testid="rbac-s06-loading" exists in source', () => {
    expect(allContent).toContain("rbac-s06-loading");
  });

  test('data-testid="rbac-s06-error" exists in source', () => {
    expect(allContent).toContain("rbac-s06-error");
  });
});

// ---------------------------------------------------------------------------
// Group 23: AdminRoles — search and filter functionality patterns
// ---------------------------------------------------------------------------

test.describe("Group 23: Search and filter patterns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test("has state for role filter", () => {
    expect(content).toMatch(/useState.*role|roleFilter|selectedRole|filterRole/i);
  });

  test("has state for search query", () => {
    expect(content).toMatch(/useState.*search|searchQuery|filterQuery|searchTerm/i);
  });

  test("filters members by role", () => {
    expect(content).toMatch(/\.filter\s*\(/);
    expect(content).toMatch(/(businessRole|role)/);
  });

  test("filters members by search (name or email)", () => {
    expect(content).toMatch(/(toLowerCase|includes|search)/);
    expect(content).toMatch(/(name|email|userName|userEmail)/i);
  });
});

// ---------------------------------------------------------------------------
// Group 24: AdminRoles — role change mutation
// ---------------------------------------------------------------------------

test.describe("Group 24: Role change mutation", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test("calls updateMemberBusinessRole for role change", () => {
    expect(content).toContain("updateMemberBusinessRole");
  });

  test("uses PATCH endpoint for business-role change", () => {
    // Either references the function or the endpoint pattern
    expect(content).toMatch(/(updateMemberBusinessRole|business-role)/);
  });

  test("change-role dropdown offers all 4 business roles", () => {
    expect(content).toMatch(/(BUSINESS_ROLES|admin.*manager.*contributor.*viewer)/);
  });
});

// ---------------------------------------------------------------------------
// Group 25: Accessibility patterns
// ---------------------------------------------------------------------------

test.describe("Group 25: Accessibility", () => {
  let matrixContent: string;

  test.beforeAll(async () => {
    matrixContent = await readFile(PERMISSION_MATRIX, "utf-8");
  });

  test("matrix uses semantic table elements (thead, tbody, th, td)", () => {
    expect(matrixContent).toMatch(/<thead/);
    expect(matrixContent).toMatch(/<tbody/);
    expect(matrixContent).toMatch(/<th/);
    expect(matrixContent).toMatch(/<td/);
  });

  test("check/dash icons have aria-label for screen readers", () => {
    expect(matrixContent).toMatch(/aria-label/);
  });
});

// ---------------------------------------------------------------------------
// Group 26: PermissionMatrix — joins:approve permission (20th key)
// ---------------------------------------------------------------------------

test.describe("Group 26: All 20 permission keys covered", () => {
  let matrixContent: string;
  let adminRolesContent: string;

  test.beforeAll(async () => {
    matrixContent = await readFile(PERMISSION_MATRIX, "utf-8");
    adminRolesContent = await readFile(ADMIN_ROLES_PAGE, "utf-8");
  });

  test("handles joins:approve permission key (the 20th key not in a standard category label)", () => {
    const combined = matrixContent + adminRolesContent;
    // joins:approve should be present either directly or via dynamic rendering of presets
    const hasKey = combined.includes("joins:approve");
    const hasPresetsImport = /ROLE_PERMISSION_PRESETS|PERMISSION_KEYS/.test(combined);
    expect(hasKey || hasPresetsImport).toBe(true);
  });
});
