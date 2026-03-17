/**
 * RBAC — Route Access Matrix (rbac browser tests)
 *
 * Comprehensive test that verifies each role's access to protected routes.
 * Uses the browser-rbac project with role-based fixtures.
 *
 * Permission Matrix (from shared BUSINESS_ROLES):
 *   admin:       20/20 permissions — full access
 *   manager:     14/20 permissions — management but not SSO/export
 *   contributor:  5/20 permissions — daily work only
 *   viewer:       2/20 permissions — read-only (audit:read, dashboard:view)
 */
import { test, expect } from "../../fixtures/auth.fixture";

// Routes with their required permission and expected access per role
const PROTECTED_ROUTES = [
  {
    path: "/members",
    permission: "users:invite",
    admin: true,
    manager: true,
    contributor: false,
    viewer: false,
  },
  {
    path: "/admin/roles",
    permission: "users:manage_permissions",
    admin: true,
    manager: false,
    contributor: false,
    viewer: false,
  },
  {
    path: "/admin/sso",
    permission: "company:manage_sso",
    admin: true,
    manager: false,
    contributor: false,
    viewer: false,
  },
  {
    path: "/company/settings",
    permission: "company:manage_settings",
    admin: true,
    manager: false,
    contributor: false,
    viewer: false,
  },
  {
    path: "/workflows",
    permission: "workflows:create",
    admin: true,
    manager: true,
    contributor: false,
    viewer: false,
  },
  {
    path: "/audit",
    permission: "audit:read",
    admin: true,
    manager: true,
    contributor: false,
    viewer: true,
  },
  {
    path: "/containers",
    permission: "agents:manage_containers",
    admin: true,
    manager: true,
    contributor: false,
    viewer: false,
  },
  {
    path: "/chat",
    permission: "chat:agent",
    admin: true,
    manager: true,
    contributor: true,
    viewer: false,
  },
  {
    path: "/approvals/pending",
    permission: "joins:approve",
    admin: true,
    manager: true,
    contributor: false,
    viewer: false,
  },
] as const;

/**
 * Checks whether a page was forbidden (either redirected to /forbidden,
 * shows "Forbidden" text, or was redirected away from the target path).
 */
async function assertForbidden(page: any, targetPath: string): Promise<void> {
  await page.waitForTimeout(3_000);
  const url = page.url();
  const hasForbidden = url.includes("forbidden") ||
    (await page.locator("text=Forbidden").isVisible().catch(() => false)) ||
    (await page.locator("text=permission").isVisible().catch(() => false));
  expect(hasForbidden || !url.includes(targetPath)).toBeTruthy();
}

/**
 * Checks that a page loaded without being forbidden.
 */
async function assertAllowed(page: any, targetPath: string): Promise<void> {
  await page.waitForTimeout(3_000);
  const hasForbidden = await page.locator("text=Forbidden").isVisible().catch(() => false);
  expect(hasForbidden).toBeFalsy();
}

for (const route of PROTECTED_ROUTES) {
  test.describe(`RBAC: ${route.path} (${route.permission})`, () => {
    if (route.admin) {
      test(`admin can access ${route.path}`, async ({ adminPage }) => {
        await adminPage.goto(route.path);
        await assertAllowed(adminPage, route.path);
      });
    }

    if (!route.viewer) {
      test(`viewer cannot access ${route.path}`, async ({ viewerPage }) => {
        await viewerPage.goto(route.path);
        await assertForbidden(viewerPage, route.path);
      });
    } else {
      test(`viewer CAN access ${route.path}`, async ({ viewerPage }) => {
        await viewerPage.goto(route.path);
        await assertAllowed(viewerPage, route.path);
      });
    }

    if (!route.contributor) {
      test(`contributor cannot access ${route.path}`, async ({ contributorPage }) => {
        await contributorPage.goto(route.path);
        await assertForbidden(contributorPage, route.path);
      });
    } else {
      test(`contributor CAN access ${route.path}`, async ({ contributorPage }) => {
        await contributorPage.goto(route.path);
        await assertAllowed(contributorPage, route.path);
      });
    }

    if (!route.manager) {
      test(`manager cannot access ${route.path}`, async ({ managerPage }) => {
        await managerPage.goto(route.path);
        await assertForbidden(managerPage, route.path);
      });
    } else {
      test(`manager CAN access ${route.path}`, async ({ managerPage }) => {
        await managerPage.goto(route.path);
        await assertAllowed(managerPage, route.path);
      });
    }
  });
}
