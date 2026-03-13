import { test, expect } from "@playwright/test";
import { interceptAnthropicApi } from "./mocks/api-interceptors";

test.describe("FR8: Cross-Document Drift Detection", () => {
  // TODO: These tests will pass once the cross-doc drift feature is built.
  // Cross-doc drift detects contradictions between specification documents.

  test.fixme("cross-doc drift section shows alerts", async ({ page }) => {
    await page.goto("/drift");
    // Cross-doc drift should be a tab or section on the drift page
    await expect(page.getByText(/cross-doc/i)).toBeVisible();
  });

  test.fixme("user can view cross-doc drift details", async ({ page }) => {
    await interceptAnthropicApi(page);
    await page.goto("/drift");

    // Click on cross-doc drift section
    await page.getByText(/cross-doc/i).click();

    // Should show conflicts between documents
    await expect(page.getByText(/conflict/i)).toBeVisible();
  });

  test.fixme("cross-doc drift shows conflicting documents", async ({ page }) => {
    await interceptAnthropicApi(page);
    await page.goto("/drift");
    await page.getByText(/cross-doc/i).click();

    // Should reference the specific documents in conflict
    await expect(page.getByText("prd.md")).toBeVisible();
    await expect(page.getByText("architecture.md")).toBeVisible();
  });

  test.fixme("cross-doc drift shows severity indicators", async ({ page }) => {
    await interceptAnthropicApi(page);
    await page.goto("/drift");
    await page.getByText(/cross-doc/i).click();

    // Conflicts should have severity indicators
    await expect(page.getByText(/high|medium|low/i)).toBeVisible();
  });

  test.fixme("user can resolve cross-doc drift conflicts", async ({ page }) => {
    await interceptAnthropicApi(page);
    await page.goto("/drift");
    await page.getByText(/cross-doc/i).click();

    // Should have action buttons to resolve conflicts
    await expect(
      page.getByRole("button", { name: /resolve|accept|dismiss/i })
    ).toBeVisible();
  });
});
