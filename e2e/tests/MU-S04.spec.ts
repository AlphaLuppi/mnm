/**
 * MU-S04: Selecteur de Company -- E2E Tests
 *
 * These tests verify the deliverables of MU-S04:
 *   - AC-01: CompanyRail has data-testid="mu-s04-company-rail" and role/aria-label
 *   - AC-02: CompanyRail company icons have dynamic data-testid="mu-s04-company-icon-{id}"
 *   - AC-03: CompanyRail active company has data-testid="mu-s04-company-active"
 *   - AC-04: CompanySwitcher trigger has data-testid="mu-s04-switcher-trigger"
 *   - AC-05: CompanySwitcher dropdown has data-testid="mu-s04-switcher-dropdown"
 *   - AC-06: CompanySwitcher options have dynamic data-testid="mu-s04-switcher-option-{id}"
 *   - AC-07: Layout has data-testid="mu-s04-layout"
 *   - AC-08: Sidebar has data-testid="mu-s04-sidebar"
 *   - AC-09: CompanyContext localStorage.getItem wrapped in try/catch
 *   - AC-10: CompanyContext localStorage.setItem wrapped in try/catch
 *
 * Source files:
 *   - ui/src/components/CompanyRail.tsx -- company rail with icons
 *   - ui/src/components/CompanySwitcher.tsx -- dropdown company selector
 *   - ui/src/components/Layout.tsx -- main layout container
 *   - ui/src/components/Sidebar.tsx -- sidebar navigation
 *   - ui/src/context/CompanyContext.tsx -- company context with localStorage
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const COMPANY_RAIL = resolve(ROOT, "ui/src/components/CompanyRail.tsx");
const COMPANY_SWITCHER = resolve(ROOT, "ui/src/components/CompanySwitcher.tsx");
const LAYOUT = resolve(ROOT, "ui/src/components/Layout.tsx");
const SIDEBAR = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const COMPANY_CONTEXT = resolve(ROOT, "ui/src/context/CompanyContext.tsx");

// --- Group 1: CompanyRail (ui/src/components/CompanyRail.tsx) ----------------

test.describe("Group 1: CompanyRail data-testid and accessibility", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(COMPANY_RAIL, "utf-8");
  });

  test('has data-testid="mu-s04-company-rail" on the rail container', () => {
    expect(content).toContain('data-testid="mu-s04-company-rail"');
  });

  test("has dynamic data-testid for company icons (mu-s04-company-icon-)", () => {
    // Should contain a dynamic testid like data-testid={`mu-s04-company-icon-${company.id}`}
    expect(content).toMatch(/data-testid=\{[`"']mu-s04-company-icon-/);
  });

  test('has role="navigation" or aria-label for accessibility', () => {
    // The rail container should have either role="navigation" or an aria-label
    const hasRole = content.includes('role="navigation"');
    const hasAriaLabel = content.match(/aria-label=["'][^"']*["']/);
    expect(hasRole || !!hasAriaLabel).toBe(true);
  });

  test("has data-testid marker for the active/selected company", () => {
    // Should mark the currently selected/active company with a testid
    // Implementation may use "mu-s04-company-active" or "mu-s04-company-icon-selected"
    const hasActive = content.includes("mu-s04-company-active");
    const hasSelected = content.includes("mu-s04-company-icon-selected");
    expect(
      hasActive || hasSelected,
      'Expected "mu-s04-company-active" or "mu-s04-company-icon-selected" in CompanyRail',
    ).toBe(true);
  });
});

// --- Group 2: CompanySwitcher (ui/src/components/CompanySwitcher.tsx) --------

test.describe("Group 2: CompanySwitcher data-testid", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(COMPANY_SWITCHER, "utf-8");
  });

  test('has data-testid="mu-s04-switcher-trigger" on the switcher trigger button', () => {
    expect(content).toContain('data-testid="mu-s04-switcher-trigger"');
  });

  test('has data-testid="mu-s04-switcher-dropdown" on the dropdown content', () => {
    expect(content).toContain('data-testid="mu-s04-switcher-dropdown"');
  });

  test("has dynamic data-testid for company options (mu-s04-switcher-option-)", () => {
    // The implementation uses a ternary: data-testid={company.id === ... ? "mu-s04-switcher-option-active" : `mu-s04-switcher-option-${company.id}`}
    // Verify both the active option testid and the dynamic per-company testid are present
    expect(content).toMatch(/mu-s04-switcher-option-active/);
    expect(content).toMatch(/mu-s04-switcher-option-\$/);
  });
});

// --- Group 3: Layout (ui/src/components/Layout.tsx) -------------------------

test.describe("Group 3: Layout data-testid", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(LAYOUT, "utf-8");
  });

  test('has data-testid="mu-s04-layout" on the layout root', () => {
    expect(content).toContain('data-testid="mu-s04-layout"');
  });
});

// --- Group 4: Sidebar (ui/src/components/Sidebar.tsx) -----------------------

test.describe("Group 4: Sidebar data-testid", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SIDEBAR, "utf-8");
  });

  test('has data-testid="mu-s04-sidebar" on the sidebar root', () => {
    expect(content).toContain('data-testid="mu-s04-sidebar"');
  });
});

// --- Group 5: CompanyContext localStorage (ui/src/context/CompanyContext.tsx) -

test.describe("Group 5: CompanyContext localStorage robustness", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(COMPANY_CONTEXT, "utf-8");
  });

  test("has try/catch around localStorage.getItem", () => {
    // Find localStorage.getItem usage and verify it is inside a try block
    // Pattern: try { ... localStorage.getItem ... } catch
    expect(content).toMatch(
      /try\s*\{[\s\S]*?localStorage\.getItem[\s\S]*?\}\s*catch/,
    );
  });

  test("has try/catch around localStorage.setItem", () => {
    // Find localStorage.setItem usage and verify it is inside a try block
    // Pattern: try { ... localStorage.setItem ... } catch
    expect(content).toMatch(
      /try\s*\{[\s\S]*?localStorage\.setItem[\s\S]*?\}\s*catch/,
    );
  });
});

// --- Group 6: data-testid completeness across all components ----------------

test.describe("Group 6: data-testid completeness", () => {
  let railContent: string;
  let switcherContent: string;
  let layoutContent: string;
  let sidebarContent: string;

  test.beforeAll(async () => {
    [railContent, switcherContent, layoutContent, sidebarContent] =
      await Promise.all([
        readFile(COMPANY_RAIL, "utf-8"),
        readFile(COMPANY_SWITCHER, "utf-8"),
        readFile(LAYOUT, "utf-8"),
        readFile(SIDEBAR, "utf-8"),
      ]);
  });

  test("all 4 key static data-testid attributes are present across components", () => {
    const requiredTestIds = [
      { id: "mu-s04-company-rail", file: "CompanyRail", content: railContent },
      { id: "mu-s04-switcher-trigger", file: "CompanySwitcher", content: switcherContent },
      { id: "mu-s04-layout", file: "Layout", content: layoutContent },
      { id: "mu-s04-sidebar", file: "Sidebar", content: sidebarContent },
    ];

    const missing: string[] = [];
    for (const { id, file, content } of requiredTestIds) {
      if (!content.includes(`data-testid="${id}"`)) {
        missing.push(`${id} in ${file}`);
      }
    }

    expect(missing, `Missing data-testid attributes: ${missing.join(", ")}`).toHaveLength(0);
  });

  test("CompanyRail has dynamic company icon testid pattern", () => {
    expect(railContent).toMatch(/mu-s04-company-icon-/);
  });

  test("CompanySwitcher has dynamic company option testid pattern", () => {
    expect(switcherContent).toMatch(/mu-s04-switcher-option-/);
  });

  test("CompanySwitcher has dropdown testid", () => {
    expect(switcherContent).toContain('data-testid="mu-s04-switcher-dropdown"');
  });

  test("CompanyRail has active company indicator testid", () => {
    const hasActive = railContent.includes("mu-s04-company-active");
    const hasSelected = railContent.includes("mu-s04-company-icon-selected");
    expect(hasActive || hasSelected).toBe(true);
  });
});
