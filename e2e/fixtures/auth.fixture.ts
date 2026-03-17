/**
 * Auth Fixture — Extends Playwright's base test with role-based authenticated pages.
 *
 * Provides 4 page fixtures, each pre-authenticated with stored browser state:
 *   - adminPage:       admin@novatech.test (admin role, full permissions)
 *   - managerPage:     manager@novatech.test (manager role, 14/20 permissions)
 *   - contributorPage: contributor@novatech.test (contributor role, 5/20 permissions)
 *   - viewerPage:      viewer@novatech.test (viewer role, 2/20 permissions — read only)
 *
 * Usage:
 *   import { test, expect } from "../fixtures/auth.fixture";
 *   test("admin can see settings", async ({ adminPage }) => { ... });
 */
import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { AUTH_STATES } from "./seed-data";

// ─── Fixture Type Definitions ───────────────────────────────────────────────

type RoleFixtures = {
  adminPage: Page;
  managerPage: Page;
  contributorPage: Page;
  viewerPage: Page;
  adminContext: BrowserContext;
  managerContext: BrowserContext;
  contributorContext: BrowserContext;
  viewerContext: BrowserContext;
};

// ─── Helper: Create authenticated context + page ────────────────────────────

async function createAuthenticatedPage(
  browser: ReturnType<typeof base>["_browser"],
  storageStatePath: string,
): Promise<{ context: BrowserContext; page: Page }> {
  // @ts-expect-error — browser is available at runtime from base fixture
  const context = await browser.newContext({
    storageState: storageStatePath,
  });
  const page = await context.newPage();
  return { context, page };
}

// ─── Extended Test Fixture ──────────────────────────────────────────────────

export const test = base.extend<RoleFixtures>({
  // Admin — full permissions (20/20)
  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: AUTH_STATES.admin,
    });
    await use(context);
    await context.close();
  },
  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage();
    await use(page);
    await page.close();
  },

  // Manager — management permissions (14/20)
  managerContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: AUTH_STATES.manager,
    });
    await use(context);
    await context.close();
  },
  managerPage: async ({ managerContext }, use) => {
    const page = await managerContext.newPage();
    await use(page);
    await page.close();
  },

  // Contributor — daily work permissions (5/20)
  contributorContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: AUTH_STATES.contributor,
    });
    await use(context);
    await context.close();
  },
  contributorPage: async ({ contributorContext }, use) => {
    const page = await contributorContext.newPage();
    await use(page);
    await page.close();
  },

  // Viewer — read-only (2/20)
  viewerContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: AUTH_STATES.viewer,
    });
    await use(context);
    await context.close();
  },
  viewerPage: async ({ viewerContext }, use) => {
    const page = await viewerContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };

// ─── Re-export seed data for convenience ────────────────────────────────────

export { IDS, USERS, COMPANIES, AGENTS, PROJECTS, BASE_URL } from "./seed-data";
