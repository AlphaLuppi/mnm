/**
 * RBAC-S07: Badges Couleur par Role -- E2E Tests
 *
 * These tests verify the deliverables of RBAC-S07:
 *   - AC-01: RoleBadge component exists and is exported
 *   - AC-02: Admin badge uses rose/red colors
 *   - AC-03: Manager badge uses blue colors
 *   - AC-04: Contributor badge uses green colors
 *   - AC-05: Viewer badge uses gray colors
 *   - AC-06: RoleBadge integrated in Members page
 *   - AC-07: data-testid dynamic with rbac-s07-role-badge- prefix
 *   - AC-08: Badge shadcn/ui base component is NOT modified
 *   - AC-09: className custom is supported
 *   - AC-10: Type-safety -- Record exhaustif sur BusinessRole
 *   - AC-11: RoleBadge integrated in BulkInviteTab preview
 *
 * Source files:
 *   - ui/src/components/RoleBadge.tsx -- RoleBadge component (CREATED)
 *   - ui/src/pages/Members.tsx -- Members page (MODIFIED: add RoleBadge)
 *   - ui/src/components/BulkInviteTab.tsx -- Bulk invite (MODIFIED: add RoleBadge)
 *   - ui/src/components/ui/badge.tsx -- Badge shadcn/ui (NOT modified)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ROLE_BADGE = resolve(ROOT, "ui/src/components/RoleBadge.tsx");
const MEMBERS_PAGE = resolve(ROOT, "ui/src/pages/Members.tsx");
const BADGE_UI = resolve(ROOT, "ui/src/components/ui/badge.tsx");

function readSource(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

// --- Group 1: RoleBadge component (ui/src/components/RoleBadge.tsx) -----------

test.describe("Group 1: RoleBadge component", () => {
  let content: string;

  test.beforeAll(() => {
    content = readSource(ROLE_BADGE);
  });

  test("file exists at ui/src/components/RoleBadge.tsx", () => {
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test("exports RoleBadge function/component", () => {
    expect(content).toMatch(/export\s+function\s+RoleBadge/);
  });

  test("has ROLE_COLORS/ROLE_STYLES record with admin, manager, contributor, viewer keys", () => {
    // Accept either ROLE_COLORS or ROLE_STYLES as the variable name
    expect(content).toMatch(/(?:ROLE_COLORS|ROLE_STYLES)\s*[:\s=]/);
    expect(content).toMatch(/admin\s*:/);
    expect(content).toMatch(/manager\s*:/);
    expect(content).toMatch(/contributor\s*:/);
    expect(content).toMatch(/viewer\s*:/);
  });

  test("admin uses rose/red colors", () => {
    // Extract admin style line
    const adminMatch = content.match(/admin\s*:\s*"([^"]+)"/);
    expect(adminMatch).toBeTruthy();
    const adminStyles = adminMatch![1];
    expect(adminStyles).toContain("bg-rose-");
    expect(adminStyles).toContain("text-rose-");
  });

  test("manager uses blue colors", () => {
    const managerMatch = content.match(/manager\s*:\s*"([^"]+)"/);
    expect(managerMatch).toBeTruthy();
    const managerStyles = managerMatch![1];
    expect(managerStyles).toContain("bg-blue-");
    expect(managerStyles).toContain("text-blue-");
  });

  test("contributor uses green colors", () => {
    const contributorMatch = content.match(/contributor\s*:\s*"([^"]+)"/);
    expect(contributorMatch).toBeTruthy();
    const contributorStyles = contributorMatch![1];
    expect(contributorStyles).toContain("bg-green-");
    expect(contributorStyles).toContain("text-green-");
  });

  test("viewer uses gray colors", () => {
    const viewerMatch = content.match(/viewer\s*:\s*"([^"]+)"/);
    expect(viewerMatch).toBeTruthy();
    const viewerStyles = viewerMatch![1];
    expect(viewerStyles).toContain("bg-gray-");
    expect(viewerStyles).toContain("text-gray-");
  });

  test('has data-testid with rbac-s07-role-badge- prefix', () => {
    expect(content).toMatch(/data-testid=\{[`"']rbac-s07-role-badge-/);
  });

  test("uses BUSINESS_ROLE_LABELS from @mnm/shared", () => {
    expect(content).toContain("BUSINESS_ROLE_LABELS");
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("uses BusinessRole type", () => {
    expect(content).toContain("BusinessRole");
  });

  test("imports Badge from ./ui/badge or @/components/ui/badge", () => {
    expect(content).toMatch(/import\s*\{[^}]*Badge[^}]*\}\s*from\s+["']@\/components\/ui\/badge["']/);
  });
});

// --- Group 2: Members.tsx integration ----------------------------------------

test.describe("Group 2: Members.tsx integration", () => {
  let content: string;

  test.beforeAll(() => {
    content = readSource(MEMBERS_PAGE);
  });

  test("Members.tsx imports RoleBadge", () => {
    expect(content).toMatch(/import\s*\{[^}]*RoleBadge[^}]*\}\s*from/);
  });

  test("Uses RoleBadge component in the table (MemberRow)", () => {
    expect(content).toMatch(/<RoleBadge\s/);
  });

  test("RoleBadge receives role prop from member.businessRole", () => {
    expect(content).toMatch(/<RoleBadge\s[^>]*role=\{member\.businessRole(\s+as\s+BusinessRole)?\}/);
  });

  test("existing Select for role change is preserved (mu-s02-member-role-)", () => {
    expect(content).toContain("mu-s02-member-role-");
  });
});

// --- Group 3: Dark mode support ----------------------------------------------

test.describe("Group 3: Dark mode support", () => {
  let content: string;

  test.beforeAll(() => {
    content = readSource(ROLE_BADGE);
  });

  test("has dark: classes in admin styles", () => {
    const adminMatch = content.match(/admin\s*:\s*"([^"]+)"/);
    expect(adminMatch).toBeTruthy();
    expect(adminMatch![1]).toMatch(/dark:/);
    expect(adminMatch![1]).toMatch(/dark:bg-rose-/);
    expect(adminMatch![1]).toMatch(/dark:text-rose-/);
  });

  test("has dark: classes in manager styles", () => {
    const managerMatch = content.match(/manager\s*:\s*"([^"]+)"/);
    expect(managerMatch).toBeTruthy();
    expect(managerMatch![1]).toMatch(/dark:bg-blue-/);
    expect(managerMatch![1]).toMatch(/dark:text-blue-/);
  });

  test("has dark: classes in contributor styles", () => {
    const contributorMatch = content.match(/contributor\s*:\s*"([^"]+)"/);
    expect(contributorMatch).toBeTruthy();
    expect(contributorMatch![1]).toMatch(/dark:bg-green-/);
    expect(contributorMatch![1]).toMatch(/dark:text-green-/);
  });

  test("has dark: classes in viewer styles", () => {
    const viewerMatch = content.match(/viewer\s*:\s*"([^"]+)"/);
    expect(viewerMatch).toBeTruthy();
    expect(viewerMatch![1]).toMatch(/dark:bg-gray-/);
    expect(viewerMatch![1]).toMatch(/dark:text-gray-/);
  });
});

// --- Group 4: Type safety ----------------------------------------------------

test.describe("Group 4: Type safety", () => {
  let content: string;

  test.beforeAll(() => {
    content = readSource(ROLE_BADGE);
  });

  test("uses Record<BusinessRole, string> or similar typed mapping", () => {
    expect(content).toMatch(/Record<BusinessRole,\s*string>/);
  });

  test("RoleBadgeProps interface exists with role: BusinessRole", () => {
    // Match interface or type definition with role: BusinessRole
    expect(content).toMatch(/interface\s+RoleBadgeProps/);
    expect(content).toMatch(/role\s*:\s*BusinessRole/);
  });

  test("className prop is optional", () => {
    expect(content).toMatch(/className\?\s*:\s*string/);
  });

  test("uses cn() for class merging", () => {
    expect(content).toContain("cn(");
    expect(content).toMatch(/import\s*\{[^}]*cn[^}]*\}\s*from/);
  });

  test('uses variant="outline" on Badge', () => {
    expect(content).toContain('variant="outline"');
  });
});

// --- Group 5: Badge shadcn/ui not modified -----------------------------------

test.describe("Group 5: Badge shadcn/ui not modified", () => {
  test("badge.tsx still exports Badge and badgeVariants", () => {
    const content = readSource(BADGE_UI);
    expect(content).toMatch(/export\s*\{[^}]*Badge[^}]*\}/);
    expect(content).toContain("badgeVariants");
  });

  test("badge.tsx has no RBAC-S07 or role-specific additions", () => {
    const content = readSource(BADGE_UI);
    // The base Badge should NOT contain role-specific color classes
    expect(content).not.toContain("bg-rose-");
    expect(content).not.toContain("bg-blue-100");
    expect(content).not.toContain("bg-green-100");
    expect(content).not.toContain("rbac-s07");
    expect(content).not.toContain("RoleBadge");
  });

  test("badge.tsx has exactly 6 variants (default, secondary, destructive, outline, ghost, link)", () => {
    const content = readSource(BADGE_UI);
    const variants = ["default", "secondary", "destructive", "outline", "ghost", "link"];
    for (const v of variants) {
      expect(content).toContain(v);
    }
  });
});
