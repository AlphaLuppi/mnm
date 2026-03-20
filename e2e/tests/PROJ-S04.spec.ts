/**
 * PROJ-S04: Page ProjectAccess -- Gestion des Membres d'un Projet -- E2E Tests
 *
 * These tests verify the deliverables of PROJ-S04:
 *   - Groupe 1: API client project-memberships.ts (T01-T10)
 *   - Groupe 2: Query Keys (T11-T12)
 *   - Groupe 3: ProjectAccessTab component (T16-T40)
 *   - Groupe 4: AddProjectMemberDialog component (T41-T55)
 *   - Groupe 5: Remove confirmation dialog (T56-T59)
 *   - Groupe 6: Integration in ProjectDetail.tsx (T60-T66)
 *   - Groupe 7: Project roles and colors (T67-T69)
 *   - Groupe 8: shadcn/ui components usage (T70-T78)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_CLIENT = resolve(ROOT, "ui/src/api/project-memberships.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const ACCESS_TAB = resolve(ROOT, "ui/src/components/ProjectAccessTab.tsx");
const ADD_DIALOG = resolve(ROOT, "ui/src/components/AddProjectMemberDialog.tsx");
const PROJECT_DETAIL = resolve(ROOT, "ui/src/pages/ProjectDetail.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: API client project-memberships.ts (T01-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: API client project-memberships.ts", () => {
  test("T01 -- project-memberships.ts exports projectMembershipsApi with 6 functions", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(/export\s+const\s+projectMembershipsApi\s*=/);
    expect(content).toContain("listMembers");
    expect(content).toContain("addMember");
    expect(content).toContain("removeMember");
    expect(content).toContain("updateMemberRole");
    expect(content).toContain("bulkAddMembers");
    expect(content).toContain("bulkRemoveMembers");
  });

  test("T02 -- listMembers calls GET /companies/:companyId/projects/:projectId/members", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(
      /listMembers[\s\S]*?api\.get[\s\S]*?\/companies\/\$\{companyId\}\/projects\/\$\{projectId\}\/members/,
    );
  });

  test("T03 -- addMember calls POST with body { userId, role }", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(
      /addMember[\s\S]*?api\.post[\s\S]*?\/companies\/\$\{companyId\}\/projects\/\$\{projectId\}\/members/,
    );
    expect(content).toMatch(/\{\s*userId\s*,\s*role\s*\}/);
  });

  test("T04 -- removeMember calls DELETE .../members/:userId", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(
      /removeMember[\s\S]*?api\.delete[\s\S]*?\/companies\/\$\{companyId\}\/projects\/\$\{projectId\}\/members\/\$\{userId\}/,
    );
  });

  test("T05 -- updateMemberRole calls PATCH with body { role }", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(
      /updateMemberRole[\s\S]*?api\.patch[\s\S]*?\/companies\/\$\{companyId\}\/projects\/\$\{projectId\}\/members\/\$\{userId\}/,
    );
    expect(content).toMatch(/\{\s*role\s*\}/);
  });

  test("T06 -- bulkAddMembers calls POST .../members/bulk with body { userIds, role }", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(
      /bulkAddMembers[\s\S]*?api\.post[\s\S]*?\/companies\/\$\{companyId\}\/projects\/\$\{projectId\}\/members\/bulk/,
    );
    expect(content).toMatch(/\{\s*userIds\s*,\s*role\s*\}/);
  });

  test("T07 -- bulkRemoveMembers calls DELETE .../members/bulk with body { userIds }", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(/bulkRemoveMembers[\s\S]*?\/members\/bulk/);
    expect(content).toMatch(/\{\s*userIds\s*\}/);
  });

  test("T08 -- ProjectMember type exports id, userId, role, userName, userEmail, userImage, createdAt", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(/export\s+interface\s+ProjectMember/);
    expect(content).toContain("id: string");
    expect(content).toContain("userId: string");
    expect(content).toContain("role: string");
    expect(content).toContain("userName: string | null");
    expect(content).toContain("userEmail: string | null");
    expect(content).toContain("userImage: string | null");
    expect(content).toContain("createdAt: string");
  });

  test("T09 -- BulkResult type exports added/removed, skipped, results", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(/export\s+interface\s+BulkResult/);
    expect(content).toContain("added?: number");
    expect(content).toContain("removed?: number");
    expect(content).toContain("skipped: number");
    expect(content).toContain("results: Array<");
  });

  test("T10 -- Import uses api from ./client", async () => {
    const content = await readFile(API_CLIENT, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*api[^}]*\}\s+from\s+["']\.\/client["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Query Keys (T11-T12)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Query Keys", () => {
  test("T11 -- queryKeys.projectMemberships exists in queryKeys.ts", async () => {
    const content = await readFile(QUERY_KEYS, "utf-8");
    expect(content).toContain("projectMemberships");
  });

  test("T12 -- queryKeys.projectMemberships.list(companyId, projectId) returns tuple with project-memberships", async () => {
    const content = await readFile(QUERY_KEYS, "utf-8");
    expect(content).toMatch(
      /projectMemberships[\s\S]*?list[\s\S]*?["']project-memberships["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: ProjectAccessTab component (T16-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: ProjectAccessTab component", () => {
  test("T16 -- ProjectAccessTab.tsx exists and exports ProjectAccessTab", async () => {
    await expect(
      fsAccess(ACCESS_TAB).then(() => true),
    ).resolves.toBe(true);
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/export\s+function\s+ProjectAccessTab/);
  });

  test("T17 -- Props accepts projectId: string and companyId: string", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain("projectId: string");
    expect(content).toContain("companyId: string");
  });

  test("T18 -- Uses useQuery with queryKeys.projectMemberships.list", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain("useQuery");
    expect(content).toContain("queryKeys.projectMemberships.list");
  });

  test("T19 -- Contains data-testid proj-s04-access-tab", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-access-tab"');
  });

  test("T20 -- Contains data-testid proj-s04-header", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-header"');
  });

  test("T21 -- Contains data-testid proj-s04-add-member-button", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-member-button"');
  });

  test("T22 -- Contains data-testid proj-s04-filters", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-filters"');
  });

  test("T23 -- Contains data-testid proj-s04-filter-role", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-filter-role"');
  });

  test("T24 -- Contains data-testid proj-s04-search", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-search"');
  });

  test("T25 -- Contains data-testid proj-s04-members-table", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-members-table"');
  });

  test("T26 -- Contains dynamic data-testid proj-s04-member-row-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-member-row-/);
  });

  test("T27 -- Contains dynamic data-testid proj-s04-member-name-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-member-name-/);
  });

  test("T28 -- Contains dynamic data-testid proj-s04-member-email-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-member-email-/);
  });

  test("T29 -- Contains dynamic data-testid proj-s04-member-role-badge-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-member-role-badge-/);
  });

  test("T30 -- Contains dynamic data-testid proj-s04-member-role-select-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-member-role-select-/);
  });

  test("T31 -- Contains dynamic data-testid proj-s04-member-actions-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-member-actions-/);
  });

  test("T32 -- Contains dynamic data-testid proj-s04-action-remove-", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-action-remove-/);
  });

  test("T33 -- Contains data-testid proj-s04-empty-state", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-empty-state"');
  });

  test("T34 -- Contains data-testid proj-s04-footer", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-footer"');
  });

  test("T35 -- Contains data-testid proj-s04-member-count", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-member-count"');
  });

  test("T36 -- Contains data-testid proj-s04-no-results", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-no-results"');
  });

  test("T37 -- Filter by role uses useState and useMemo to filter members", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain("useState");
    expect(content).toContain("useMemo");
    expect(content).toMatch(/roleFilter/);
    expect(content).toMatch(/filteredMembers/);
  });

  test("T38 -- Search filters by userName or userEmail (case insensitive)", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/toLowerCase/);
    expect(content).toMatch(/userName/);
    expect(content).toMatch(/userEmail/);
    expect(content).toMatch(/includes\s*\(\s*q\s*\)/);
  });

  test("T39 -- useMutation for updateMemberRole with invalidateQueries on success", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain("useMutation");
    expect(content).toMatch(/updateMemberRole/);
    expect(content).toContain("invalidateQueries");
  });

  test("T40 -- useMutation for removeMember with invalidateQueries on success", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain("useMutation");
    expect(content).toMatch(/removeMember/);
    expect(content).toContain("invalidateQueries");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: AddProjectMemberDialog component (T41-T55)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: AddProjectMemberDialog component", () => {
  test("T41 -- AddProjectMemberDialog.tsx exists and exports AddProjectMemberDialog", async () => {
    await expect(
      fsAccess(ADD_DIALOG).then(() => true),
    ).resolves.toBe(true);
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(/export\s+function\s+AddProjectMemberDialog/);
  });

  test("T42 -- Contains data-testid proj-s04-add-dialog", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-dialog"');
  });

  test("T43 -- Contains data-testid proj-s04-add-dialog-title", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-dialog-title"');
  });

  test("T44 -- Contains data-testid proj-s04-add-search", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-search"');
  });

  test("T45 -- Contains data-testid proj-s04-available-members-list", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-available-members-list"');
  });

  test("T46 -- Contains dynamic data-testid proj-s04-available-member-", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-available-member-\$\{/);
  });

  test("T47 -- Contains dynamic data-testid proj-s04-available-member-check-", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(/data-testid=\{?[`"]proj-s04-available-member-check-/);
  });

  test("T48 -- Contains data-testid proj-s04-add-role-select", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-role-select"');
  });

  test("T49 -- Contains data-testid proj-s04-add-submit", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-submit"');
  });

  test("T50 -- Contains data-testid proj-s04-add-cancel", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-add-cancel"');
  });

  test("T51 -- Contains data-testid proj-s04-selected-count", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain('data-testid="proj-s04-selected-count"');
  });

  test("T52 -- Filters company members already in the project via existingMemberIds", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain("existingMemberIds");
    expect(content).toMatch(/existingSet/);
    expect(content).toMatch(/filter/);
  });

  test("T53 -- Search in available members by name or email", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(/userName/);
    expect(content).toMatch(/userEmail/);
    expect(content).toMatch(/toLowerCase/);
    expect(content).toMatch(/includes\s*\(\s*q\s*\)/);
  });

  test("T54 -- Uses bulkAddMembers when >1 selected or addMember when 1 selected", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(/ids\.length\s*===\s*1/);
    expect(content).toContain("addSingleMutation");
    expect(content).toContain("bulkAddMutation");
    expect(content).toMatch(/addMember/);
    expect(content).toMatch(/bulkAddMembers/);
  });

  test("T55 -- Invalidates queryKeys.projectMemberships.list after successful add", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toContain("invalidateQueries");
    expect(content).toContain("queryKeys.projectMemberships.list");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Remove confirmation dialog (T56-T59)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Remove confirmation dialog", () => {
  test("T56 -- Contains data-testid proj-s04-remove-confirm-dialog", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-remove-confirm-dialog"');
  });

  test("T57 -- Contains data-testid proj-s04-remove-confirm-message", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-remove-confirm-message"');
  });

  test("T58 -- Contains data-testid proj-s04-remove-confirm-submit", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-remove-confirm-submit"');
  });

  test("T59 -- Contains data-testid proj-s04-remove-confirm-cancel", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('data-testid="proj-s04-remove-confirm-cancel"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Integration in ProjectDetail.tsx (T60-T66)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Integration in ProjectDetail.tsx", () => {
  test("T60 -- ProjectTab union type contains access", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    expect(content).toMatch(/type\s+ProjectTab\s*=[\s\S]*?"access"/);
  });

  test("T61 -- resolveProjectTab returns access for pathname containing /access", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    expect(content).toMatch(/tab\s*===\s*["']access["'][\s\S]*?return\s+["']access["']/);
  });

  test("T62 -- Tab bar contains an Access tab button", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    // Should render "Access" text in the tab bar
    expect(content).toMatch(/["']access["']\s*\?\s*["']Access["']/);
  });

  test("T63 -- Contains data-testid proj-s04-tab-access", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    expect(content).toContain('proj-s04-tab-access');
  });

  test("T64 -- Access tab conditioned by hasPermission projects:manage_members", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    expect(content).toMatch(/hasPermission\s*\(\s*["']projects:manage_members["']\s*\)/);
  });

  test("T65 -- When activeTab === access renders ProjectAccessTab with projectId and companyId", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    expect(content).toMatch(/activeTab\s*===\s*["']access["']/);
    expect(content).toContain("ProjectAccessTab");
    expect(content).toMatch(/<ProjectAccessTab[\s\S]*?projectId=/);
    expect(content).toMatch(/<ProjectAccessTab[\s\S]*?companyId=/);
  });

  test("T66 -- Import of ProjectAccessTab from ../components/ProjectAccessTab", async () => {
    const content = await readFile(PROJECT_DETAIL, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*ProjectAccessTab[^}]*\}\s+from\s+["']\.\.\/components\/ProjectAccessTab["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Project roles and colors (T67-T69)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Project roles and colors", () => {
  test("T67 -- Uses PROJECT_MEMBERSHIP_ROLES from @mnm/shared or local roles array", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/PROJECT_MEMBERSHIP_ROLES/);
    // Verify import from @mnm/shared
    expect(content).toMatch(
      /import\s+\{[^}]*PROJECT_MEMBERSHIP_ROLES[^}]*\}\s+from\s+["']@mnm\/shared["']/,
    );
  });

  test("T68 -- Labels de role projet: Owner, Manager, Contributor, Viewer", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toContain('"Owner"');
    expect(content).toContain('"Manager"');
    expect(content).toContain('"Contributor"');
    expect(content).toContain('"Viewer"');
  });

  test("T69 -- Badge de role with distinct colors for owner/manager/contributor/viewer", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(/PROJECT_ROLE_COLORS/);
    expect(content).toMatch(/amber/);
    expect(content).toMatch(/blue/);
    expect(content).toMatch(/green/);
    expect(content).toMatch(/gray/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: shadcn/ui components usage (T70-T78)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: shadcn/ui components usage", () => {
  test("T70 -- Uses Avatar and AvatarFallback from shadcn/ui", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*Avatar[^}]*AvatarFallback[^}]*\}\s+from\s+["']@\/components\/ui\/avatar["']/,
    );
  });

  test("T71 -- Uses Select, SelectTrigger, SelectContent, SelectItem from shadcn/ui", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    // Verify import from @/components/ui/select contains all 4 components (any order)
    const selectImportBlock = content.match(
      /import\s+\{([\s\S]*?)\}\s+from\s+["']@\/components\/ui\/select["']/,
    );
    expect(selectImportBlock).not.toBeNull();
    const importBody = selectImportBlock![1];
    expect(importBody).toContain("Select");
    expect(importBody).toContain("SelectTrigger");
    expect(importBody).toContain("SelectContent");
    expect(importBody).toContain("SelectItem");
  });

  test("T72 -- Uses DropdownMenu from shadcn/ui", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*DropdownMenu[^}]*\}\s+from\s+["']@\/components\/ui\/dropdown-menu["']/,
    );
  });

  test("T73 -- Uses Dialog from shadcn/ui in AddProjectMemberDialog", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*Dialog[^}]*\}\s+from\s+["']@\/components\/ui\/dialog["']/,
    );
  });

  test("T74 -- Uses Input from shadcn/ui", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*Input[^}]*\}\s+from\s+["']@\/components\/ui\/input["']/,
    );
  });

  test("T75 -- Uses Button from shadcn/ui", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*Button[^}]*\}\s+from\s+["']@\/components\/ui\/button["']/,
    );
  });

  test("T76 -- Uses Checkbox from shadcn/ui for multi-select in add dialog", async () => {
    const content = await readFile(ADD_DIALOG, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*Checkbox[^}]*\}\s+from\s+["']@\/components\/ui\/checkbox["']/,
    );
  });

  test("T77 -- Uses EmptyState for empty state", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*EmptyState[^}]*\}/,
    );
    expect(content).toContain("<EmptyState");
  });

  test("T78 -- Uses Badge from shadcn/ui for role badges", async () => {
    const content = await readFile(ACCESS_TAB, "utf-8");
    expect(content).toMatch(
      /import\s+\{[^}]*Badge[^}]*\}\s+from\s+["']@\/components\/ui\/badge["']/,
    );
    expect(content).toContain("<Badge");
  });
});
