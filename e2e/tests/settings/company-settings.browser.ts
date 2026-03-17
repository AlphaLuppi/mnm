/**
 * Settings — Company Settings Page (browser tests)
 *
 * Tests the /company/settings page: tabs, general settings, preferences.
 * Requires company:manage_settings permission.
 */
import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Company Settings — Admin View", () => {
  test("admin can access settings page", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.waitForTimeout(3_000);
    await expect(adminPage.getByText("Settings").first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows tab navigation (General, Agents, Invites, Preferences, Advanced)", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.waitForTimeout(3_000);
    await expect(adminPage.getByText("General").first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Agents").first()).toBeVisible();
    await expect(adminPage.getByText("Invites")).toBeVisible();
    await expect(adminPage.getByText("Preferences")).toBeVisible();
    await expect(adminPage.getByText("Advanced")).toBeVisible();
  });

  test("general tab shows company name field", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.waitForTimeout(3_000);
    await expect(adminPage.getByText("Company name")).toBeVisible({ timeout: 15_000 });
  });

  test("general tab shows brand color picker", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.waitForTimeout(3_000);
    await expect(adminPage.getByText("Brand color")).toBeVisible({ timeout: 15_000 });
  });

  test("agents tab shows agent defaults", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.getByText("Agents").first().click();
    await expect(adminPage.getByText("Default agent type")).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText("Max concurrent agents")).toBeVisible();
  });

  test("preferences tab shows theme selector", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.getByText("Preferences").click();
    await expect(adminPage.getByText("Color theme")).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText("Light")).toBeVisible();
    await expect(adminPage.getByText("Dark")).toBeVisible();
    await expect(adminPage.getByText("System")).toBeVisible();
  });

  test("advanced tab shows danger zone", async ({ adminPage }) => {
    await adminPage.goto("/company/settings");
    await adminPage.getByText("Advanced").click();
    await expect(adminPage.getByText("Danger Zone")).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.getByText("Archive company")).toBeVisible();
  });
});

test.describe("Company Settings — RBAC", () => {
  test("viewer cannot access settings (forbidden)", async ({ viewerPage }) => {
    await viewerPage.goto("/company/settings");
    await viewerPage.waitForTimeout(3_000);
    const url = viewerPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await viewerPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/company/settings")).toBeTruthy();
  });

  test("contributor cannot access settings (forbidden)", async ({ contributorPage }) => {
    await contributorPage.goto("/company/settings");
    await contributorPage.waitForTimeout(3_000);
    const url = contributorPage.url();
    const hasForbidden = url.includes("forbidden") ||
      (await contributorPage.locator("text=Forbidden").isVisible().catch(() => false));
    expect(hasForbidden || !url.includes("/company/settings")).toBeTruthy();
  });
});
