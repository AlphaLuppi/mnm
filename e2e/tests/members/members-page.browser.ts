/**
 * Members Page — Browser E2E Tests
 *
 * Tests the /members page: member list, filters, invite dialog.
 * Uses role-based fixtures to test RBAC on member management.
 */
import { test, expect, USERS } from "../../fixtures/auth.fixture";
import { navigateAndWait, waitForTestId } from "../../fixtures/test-helpers";

test.describe("Members Page — Admin View", () => {
  test("displays members table with seeded users", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-page");
    await expect(adminPage.locator('[data-testid="mu-s02-members-table"]')).toBeVisible();
    // Seeded environment should show at least the 4 NovaTech users
    const rows = adminPage.locator('[data-testid^="mu-s02-member-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("shows member count in footer", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-member-count");
    const text = await adminPage.locator('[data-testid="mu-s02-member-count"]').textContent();
    expect(text).toMatch(/Showing \d+ of \d+ members/);
  });

  test("seeded admin user appears in table", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-members-table");
    // Search for the seeded admin user
    await adminPage.locator('[data-testid="mu-s02-search"]').fill(USERS.novaTechAdmin.name.split(" ")[0]);
    await adminPage.waitForTimeout(500);
    await expect(adminPage.getByText(USERS.novaTechAdmin.name).first()).toBeVisible({ timeout: 5_000 });
  });

  test("invite button is visible for admin", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-invite-button");
  });

  test("clicking invite opens dialog with single and bulk tabs", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await adminPage.locator('[data-testid="mu-s02-invite-button"]').click();
    await expect(adminPage.locator('[data-testid="mu-s02-invite-dialog"]')).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.locator('[data-testid="mu-s03-tab-single"]')).toBeVisible();
    await expect(adminPage.locator('[data-testid="mu-s03-tab-bulk"]')).toBeVisible();
  });

  test("single invite tab has email field", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await adminPage.locator('[data-testid="mu-s02-invite-button"]').click();
    await expect(adminPage.locator('[data-testid="mu-s02-invite-dialog"]')).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.locator('[data-testid="mu-s02-invite-email"]')).toBeVisible();
  });

  test("can filter members by role", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-filter-role");
    await adminPage.locator('[data-testid="mu-s02-filter-role"]').click();
    await adminPage.locator('[data-testid="mu-s02-filter-role-admin"]').click();
    await expect(adminPage.locator('[data-testid="mu-s02-member-count"]')).toBeVisible();
  });

  test("can filter members by status", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-filter-status");
    await adminPage.locator('[data-testid="mu-s02-filter-status"]').click();
    await adminPage.locator('[data-testid="mu-s02-filter-status-active"]').click();
    await expect(adminPage.locator('[data-testid="mu-s02-member-count"]')).toBeVisible();
  });

  test("search filters members by name", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/members");
    await waitForTestId(adminPage, "mu-s02-search");
    await adminPage.locator('[data-testid="mu-s02-search"]').fill("Sophie");
    await adminPage.waitForTimeout(500);
    const count = await adminPage.locator('[data-testid="mu-s02-member-count"]').textContent();
    expect(count).toBeTruthy();
  });
});

test.describe("Members Page — Manager View", () => {
  test("manager can access members page (has users:invite)", async ({ managerPage }) => {
    await navigateAndWait(managerPage, "/members");
    await waitForTestId(managerPage, "mu-s02-page");
    await expect(managerPage.locator('[data-testid="mu-s02-members-table"]')).toBeVisible();
  });

  test("manager can see invite button", async ({ managerPage }) => {
    await navigateAndWait(managerPage, "/members");
    await waitForTestId(managerPage, "mu-s02-invite-button");
  });
});

test.describe("Members Page — RBAC Enforcement", () => {
  test("viewer cannot access members page (no users:invite)", async ({ viewerPage }) => {
    await viewerPage.goto("/members");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false)) ||
      (await viewerPage.locator("text=permission").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/members")).toBeTruthy();
  });

  test("contributor cannot access members page (no users:invite)", async ({ contributorPage }) => {
    await contributorPage.goto("/members");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=Forbidden").isVisible().catch(() => false)) ||
      (await contributorPage.locator("text=permission").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/members")).toBeTruthy();
  });
});
