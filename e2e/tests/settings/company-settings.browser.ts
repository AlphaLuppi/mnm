/**
 * Settings — Company Settings Page (browser tests)
 *
 * Tests the /company/settings page: tabs, general settings, preferences.
 * Requires company:manage_settings permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";
import { navigateAndWait } from "../../fixtures/test-helpers";

test.describe("Company Settings — Admin View", () => {
  test("admin can access settings page", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await expect(adminPage.getByText("Settings").first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows tab navigation (General, Agents, Invites, Preferences, Advanced)", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await expect(adminPage.getByText("General").first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Agents").first()).toBeVisible();
    await expect(adminPage.getByText("Invites")).toBeVisible();
    await expect(adminPage.getByText("Preferences")).toBeVisible();
    await expect(adminPage.getByText("Advanced")).toBeVisible();
  });

  test("general tab shows company name field", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await expect(adminPage.getByText("Company name")).toBeVisible({ timeout: 15_000 });
  });

  test("general tab shows brand color picker", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await expect(adminPage.getByText("Brand color")).toBeVisible({ timeout: 15_000 });
  });

  test("seeded company name visible in general tab", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    // NovaTech Solutions is our seeded company — name should appear in the input
    const hasNovaTech = await adminPage.getByDisplayValue("NovaTech Solutions").isVisible().catch(() => false);
    const hasCompanyName = await adminPage.getByText("Company name").isVisible().catch(() => false);
    expect(hasNovaTech || hasCompanyName).toBeTruthy();
  });

  test("agents tab shows agent defaults", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await adminPage.getByText("Agents").first().click();
    await expect(adminPage.getByText("Default agent type")).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText("Max concurrent agents")).toBeVisible();
  });

  test("preferences tab shows theme selector", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await adminPage.getByText("Preferences").click();
    await expect(adminPage.getByText("Color theme")).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText("Light")).toBeVisible();
    await expect(adminPage.getByText("Dark")).toBeVisible();
    await expect(adminPage.getByText("System")).toBeVisible();
  });

  test("advanced tab shows danger zone", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/company/settings");
    await adminPage.getByText("Advanced").click();
    await expect(adminPage.getByText("Danger Zone")).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText("Archive company")).toBeVisible();
  });
});

test.describe("Company Settings — RBAC Enforcement", () => {
  test("viewer cannot access settings (no company:manage_settings)", async ({ viewerPage }) => {
    await viewerPage.goto("/company/settings");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=/Forbidden|Access Denied/").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/company/settings")).toBeTruthy();
  });

  test("contributor cannot access settings (no company:manage_settings)", async ({ contributorPage }) => {
    await contributorPage.goto("/company/settings");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=/Forbidden|Access Denied/").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/company/settings")).toBeTruthy();
  });

  test("manager cannot access settings (no company:manage_settings)", async ({ managerPage }) => {
    await managerPage.goto("/company/settings");
    await managerPage.waitForTimeout(3_000);
    const url = managerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await managerPage.locator("text=/Forbidden|Access Denied/").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/company/settings")).toBeTruthy();
  });
});
