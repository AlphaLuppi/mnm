import type { Page } from "@playwright/test";
import {
  mockDriftAnalysis,
  mockDiscoveryClassification,
  mockCrossDocDrift,
} from "./llm-responses";

/**
 * Intercept all calls to the Anthropic API and return mock responses.
 * Prevents real API calls during E2E tests.
 */
export async function interceptAnthropicApi(page: Page): Promise<void> {
  await page.route("**/api.anthropic.com/**", (route) => {
    const url = route.request().url();

    // Default to discovery classification response
    let body = mockDiscoveryClassification;

    // Check request body for drift-related prompts
    const postData = route.request().postData();
    if (postData) {
      if (postData.includes("drift") || postData.includes("diverge")) {
        body = mockDriftAnalysis;
      }
      if (postData.includes("cross-doc") || postData.includes("conflict")) {
        body = mockCrossDocDrift;
      }
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/**
 * Intercept internal API routes that call LLMs and return mock data.
 * Use this when the app's own API endpoints proxy to external LLM services.
 */
export async function interceptDriftApi(page: Page): Promise<void> {
  await page.route("**/api/drift/analyze", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        drift: {
          hasDrift: true,
          severity: "medium",
          summary: "Mock drift detection result",
        },
      }),
    });
  });
}

/**
 * Intercept discovery scan API to return mock results.
 */
export async function interceptDiscoveryApi(page: Page): Promise<void> {
  await page.route("**/api/discovery/scan", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        specs: 4,
        workflows: 1,
        agents: 3,
      }),
    });
  });
}
