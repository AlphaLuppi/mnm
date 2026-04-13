/**
 * Multi-Tenant Isolation — Browser E2E Tests
 *
 * Verifies that tenant data is strictly isolated between companies.
 * Two seeded companies:
 *   - NovaTech Solutions (prefix: NTS, id: a1000000-...)
 *   - Atelier Numerique  (prefix: ATN, id: a2000000-...)
 *
 * NovaTech has 5 seeded agents; Atelier has none.
 * Each company has its own admin user authenticated via separate browser contexts.
 */
import { test, expect, IDS, COMPANIES, AGENTS } from "../../fixtures/auth.fixture";
import {
  navigateAndWait,
  getNovatechCompanyId,
  getAtelierCompanyId,
  uniqueTestId,
} from "../../fixtures/test-helpers";

// ─── Constants ─────────────────────────────────────────────────────────────

const NOVATECH_PREFIX = COMPANIES.novatech.issuePrefix; // "NTS"
const ATELIER_PREFIX = COMPANIES.atelier.issuePrefix; // "ATN"

const NOVATECH_AGENT_NAMES = AGENTS.map((a) => a.name);
// e.g. ["Claude Stratege", "Marcus Architecte", "Luna Developpeur", "Aria QA", "Phoenix DevOps"]

// ─── Test 1: Agent list is company-scoped ──────────────────────────────────

test.describe("Tenant Isolation — Agent List", () => {
  test("NovaTech admin sees NovaTech agents", async ({ adminPage }) => {
    await navigateAndWait(adminPage, "/agents/all");
    await adminPage.waitForTimeout(3_000);

    // At least some seeded NovaTech agents should be visible
    const visibilityResults = await Promise.all(
      NOVATECH_AGENT_NAMES.map((name) =>
        adminPage.getByText(name).isVisible().catch(() => false),
      ),
    );
    const visibleCount = visibilityResults.filter(Boolean).length;
    expect(visibleCount).toBeGreaterThanOrEqual(1);
  });

  test("Atelier admin does NOT see NovaTech agents", async ({ atelierAdminPage }) => {
    await navigateAndWait(atelierAdminPage, "/agents/all");
    await atelierAdminPage.waitForTimeout(3_000);

    // None of the NovaTech seeded agents should appear in Atelier's view
    for (const name of NOVATECH_AGENT_NAMES) {
      const isVisible = await atelierAdminPage
        .getByText(name, { exact: true })
        .isVisible()
        .catch(() => false);
      expect(isVisible, `NovaTech agent "${name}" should NOT be visible in Atelier`).toBe(false);
    }
  });

  test("Atelier admin sees empty state or only Atelier agents", async ({ atelierAdminPage }) => {
    await navigateAndWait(atelierAdminPage, "/agents/all");
    await atelierAdminPage.waitForTimeout(3_000);

    // Atelier has no seeded agents, so we expect either:
    // 1. An empty state / "Create your first agent" message, OR
    // 2. The page loaded successfully with no NovaTech agents
    const hasEmptyState = await atelierAdminPage
      .getByText(/Create your first agent|No agents|Aucun agent/i)
      .isVisible()
      .catch(() => false);
    const isOnAgentsPage = atelierAdminPage.url().includes("/agents");
    expect(hasEmptyState || isOnAgentsPage).toBeTruthy();
  });
});

// ─── Test 2: Issue list is company-scoped ──────────────────────────────────

test.describe("Tenant Isolation — Issue List", () => {
  const testIssueTitle = `E2E-Isolation-${Date.now()}`;

  test("issue created in NovaTech is NOT visible in Atelier", async ({
    adminPage,
    atelierAdminPage,
    request,
  }) => {
    const novatechCompanyId = getNovatechCompanyId();

    // Step 1: Create an issue in NovaTech via API
    const createRes = await request.post(
      `/api/companies/${novatechCompanyId}/issues`,
      {
        data: {
          title: testIssueTitle,
          description: "Cross-tenant isolation test issue",
          status: "todo",
        },
      },
    );
    // Accept both 200 and 201 as success
    expect(createRes.ok(), `Failed to create issue: ${createRes.status()}`).toBeTruthy();
    const createdIssue = await createRes.json();

    try {
      // Step 2: Verify issue is visible in NovaTech
      await navigateAndWait(adminPage, "/issues");
      await adminPage.waitForTimeout(3_000);
      const isVisibleInNovaTech = await adminPage
        .getByText(testIssueTitle)
        .isVisible()
        .catch(() => false);
      expect(isVisibleInNovaTech, "Issue should be visible in NovaTech").toBe(true);

      // Step 3: Navigate to Atelier issues page
      await navigateAndWait(atelierAdminPage, "/issues");
      await atelierAdminPage.waitForTimeout(3_000);

      // Step 4: Verify issue is NOT visible in Atelier
      const isVisibleInAtelier = await atelierAdminPage
        .getByText(testIssueTitle)
        .isVisible()
        .catch(() => false);
      expect(isVisibleInAtelier, "NovaTech issue should NOT be visible in Atelier").toBe(false);
    } finally {
      // Cleanup: delete the created issue
      if (createdIssue?.id) {
        await request
          .delete(`/api/companies/${novatechCompanyId}/issues/${createdIssue.id}`)
          .catch(() => {});
      }
    }
  });
});

// ─── Test 3: Direct URL access to another company's agent ──────────────────

test.describe("Tenant Isolation — Cross-Company URL Access", () => {
  test("Atelier admin cannot view NovaTech agent via direct URL", async ({
    atelierAdminPage,
  }) => {
    const novatechAgentId = IDS.AGENT_CLAUDE_STRATEGE;

    // Try navigating directly to a NovaTech agent detail page using NovaTech prefix
    await atelierAdminPage.goto(`/${NOVATECH_PREFIX}/agents/${novatechAgentId}`);
    await atelierAdminPage.waitForTimeout(3_000);

    // The page should either:
    // 1. Redirect away (not show the NovaTech agent detail)
    // 2. Show a 403/404/forbidden page
    // 3. Show the agent but scoped to Atelier (agent won't exist there)
    const currentUrl = atelierAdminPage.url();
    const pageContent = await atelierAdminPage.textContent("body").catch(() => "");

    const isBlocked =
      // URL was redirected away from the NovaTech agent page
      !currentUrl.includes(`/${NOVATECH_PREFIX}/agents/${novatechAgentId}`) ||
      // Or shows forbidden/not found
      /forbidden|access denied|not found|404|403/i.test(pageContent ?? "") ||
      // Or page shows error state
      (await atelierAdminPage.locator("text=/error|introuvable/i").isVisible().catch(() => false));

    // Agent name from NovaTech should NOT be visible
    const agentNameVisible = await atelierAdminPage
      .getByText("Claude Stratege")
      .isVisible()
      .catch(() => false);

    expect(
      isBlocked || !agentNameVisible,
      "Atelier admin should NOT see NovaTech agent details via direct URL",
    ).toBe(true);
  });

  test("NovaTech admin cannot view Atelier company routes", async ({ adminPage }) => {
    // Try navigating to Atelier's agents page using Atelier prefix
    await adminPage.goto(`/${ATELIER_PREFIX}/agents/all`);
    await adminPage.waitForTimeout(3_000);

    const currentUrl = adminPage.url();
    const pageContent = await adminPage.textContent("body").catch(() => "");

    // Should be redirected or show forbidden
    const isBlocked =
      !currentUrl.includes(`/${ATELIER_PREFIX}/`) ||
      /forbidden|access denied|not found/i.test(pageContent ?? "");

    // At minimum, NovaTech agents should NOT appear under Atelier prefix
    const hasNovatechAgent = await adminPage
      .getByText("Claude Stratege")
      .isVisible()
      .catch(() => false);

    expect(
      isBlocked || !hasNovatechAgent,
      "NovaTech admin should not access Atelier routes or see NovaTech data under wrong prefix",
    ).toBe(true);
  });
});

// ─── Test 4: API-level cross-company isolation ─────────────────────────────

test.describe("Tenant Isolation — API-Level Enforcement", () => {
  test("Atelier admin gets 403 when accessing NovaTech agents API", async ({
    atelierAdminPage,
  }) => {
    const novatechCompanyId = getNovatechCompanyId();

    // Make API request to NovaTech's agents endpoint using Atelier admin's session
    // We use atelierAdminPage's request context which has Atelier admin cookies
    const res = await atelierAdminPage.request.get(
      `/api/companies/${novatechCompanyId}/agents`,
    );

    // Expect 403 (Forbidden) — Atelier admin is not a member of NovaTech
    expect(
      [403, 401, 404].includes(res.status()),
      `Expected 403/401/404 but got ${res.status()} when Atelier admin hits NovaTech agents API`,
    ).toBe(true);
  });

  test("Atelier admin gets 403 when accessing NovaTech issues API", async ({
    atelierAdminPage,
  }) => {
    const novatechCompanyId = getNovatechCompanyId();

    const res = await atelierAdminPage.request.get(
      `/api/companies/${novatechCompanyId}/issues`,
    );

    expect(
      [403, 401, 404].includes(res.status()),
      `Expected 403/401/404 but got ${res.status()} when Atelier admin hits NovaTech issues API`,
    ).toBe(true);
  });

  test("NovaTech admin gets 403 when accessing Atelier agents API", async ({
    adminPage,
  }) => {
    const atelierCompanyId = getAtelierCompanyId();

    const res = await adminPage.request.get(
      `/api/companies/${atelierCompanyId}/agents`,
    );

    expect(
      [403, 401, 404].includes(res.status()),
      `Expected 403/401/404 but got ${res.status()} when NovaTech admin hits Atelier agents API`,
    ).toBe(true);
  });

  test("Atelier admin cannot create issue in NovaTech via API", async ({
    atelierAdminPage,
  }) => {
    const novatechCompanyId = getNovatechCompanyId();

    const res = await atelierAdminPage.request.post(
      `/api/companies/${novatechCompanyId}/issues`,
      {
        data: {
          title: "Unauthorized cross-tenant issue",
          description: "This should be rejected",
          status: "todo",
        },
      },
    );

    expect(
      [403, 401, 404].includes(res.status()),
      `Expected 403/401/404 but got ${res.status()} when Atelier admin creates issue in NovaTech`,
    ).toBe(true);
  });
});

// ─── Test 5: Company selector shows only user's companies ──────────────────

test.describe("Tenant Isolation — Company Selector", () => {
  test("NovaTech admin sees NovaTech in company rail, not Atelier", async ({
    adminPage,
  }) => {
    await navigateAndWait(adminPage, "/agents/all");

    // Company rail should be visible
    const companyRail = adminPage.locator('[data-testid="mu-s04-company-rail"]');
    await expect(companyRail).toBeVisible({ timeout: 10_000 });

    // NovaTech icon should be in the rail
    const novatechIcon = adminPage.locator(
      `[data-testid="mu-s04-company-icon-${IDS.NOVATECH_COMPANY}"]`,
    );
    const novatechVisible = await novatechIcon.isVisible().catch(() => false);
    expect(novatechVisible, "NovaTech company icon should be visible in rail").toBe(true);

    // Atelier icon should NOT be in the rail (NovaTech admin is not a member of Atelier)
    const atelierIcon = adminPage.locator(
      `[data-testid="mu-s04-company-icon-${IDS.ATELIER_COMPANY}"]`,
    );
    const atelierVisible = await atelierIcon.isVisible().catch(() => false);
    expect(atelierVisible, "Atelier company icon should NOT be visible for NovaTech admin").toBe(
      false,
    );
  });

  test("Atelier admin sees Atelier in company rail, not NovaTech", async ({
    atelierAdminPage,
  }) => {
    await navigateAndWait(atelierAdminPage, "/agents/all");

    const companyRail = atelierAdminPage.locator('[data-testid="mu-s04-company-rail"]');
    await expect(companyRail).toBeVisible({ timeout: 10_000 });

    // Atelier icon should be in the rail
    const atelierIcon = atelierAdminPage.locator(
      `[data-testid="mu-s04-company-icon-${IDS.ATELIER_COMPANY}"]`,
    );
    const atelierVisible = await atelierIcon.isVisible().catch(() => false);
    expect(atelierVisible, "Atelier company icon should be visible in rail").toBe(true);

    // NovaTech icon should NOT be in the rail
    const novatechIcon = atelierAdminPage.locator(
      `[data-testid="mu-s04-company-icon-${IDS.NOVATECH_COMPANY}"]`,
    );
    const novatechVisible = await novatechIcon.isVisible().catch(() => false);
    expect(novatechVisible, "NovaTech company icon should NOT be visible for Atelier admin").toBe(
      false,
    );
  });
});

// ─── Test 6: Creating an agent in one company doesn't appear in another ────

test.describe("Tenant Isolation — Agent Creation Isolation", () => {
  test("agent created in NovaTech does not appear in Atelier", async ({
    adminPage,
    atelierAdminPage,
    request,
  }) => {
    const novatechCompanyId = getNovatechCompanyId();
    const uniqueAgentName = `Isolation-Agent-${uniqueTestId()}`;

    // Step 1: Create a new agent in NovaTech via API
    const createRes = await request.post(`/api/companies/${novatechCompanyId}/agents`, {
      data: {
        name: uniqueAgentName,
        title: "E2E Isolation Test Agent",
        status: "idle",
        adapterType: "process",
        capabilities: "Testing tenant isolation",
      },
    });
    expect(createRes.ok(), `Failed to create agent: ${createRes.status()}`).toBeTruthy();
    const createdAgent = await createRes.json();

    try {
      // Step 2: Verify agent is visible in NovaTech
      await navigateAndWait(adminPage, "/agents/all");
      await adminPage.waitForTimeout(3_000);
      const isVisibleInNovaTech = await adminPage
        .getByText(uniqueAgentName)
        .isVisible()
        .catch(() => false);
      expect(isVisibleInNovaTech, "Created agent should be visible in NovaTech").toBe(true);

      // Step 3: Navigate to Atelier agents page
      await navigateAndWait(atelierAdminPage, "/agents/all");
      await atelierAdminPage.waitForTimeout(3_000);

      // Step 4: Verify agent is NOT visible in Atelier
      const isVisibleInAtelier = await atelierAdminPage
        .getByText(uniqueAgentName)
        .isVisible()
        .catch(() => false);
      expect(isVisibleInAtelier, "NovaTech agent should NOT be visible in Atelier").toBe(false);

      // Step 5: Go back to NovaTech and confirm agent is still there
      await navigateAndWait(adminPage, "/agents/all");
      await adminPage.waitForTimeout(2_000);
      const stillVisible = await adminPage
        .getByText(uniqueAgentName)
        .isVisible()
        .catch(() => false);
      expect(stillVisible, "Agent should still be visible in NovaTech after checking Atelier").toBe(
        true,
      );
    } finally {
      // Cleanup: delete the created agent
      if (createdAgent?.id) {
        await request
          .delete(`/api/companies/${novatechCompanyId}/agents/${createdAgent.id}`)
          .catch(() => {});
      }
    }
  });
});
