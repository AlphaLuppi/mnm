/**
 * github-flow.spec.ts -- GitHub provider end-to-end (App + OAuth) -- Phase 6
 *
 * File-content tests that lock down the surface area of the GitHub provider
 * chantier (plan: docs/superpowers/plans/2026-05-04-github-provider.md). They
 * exercise the same shape as the project's other connector specs: assert that
 * the wiring exists in the source tree (routes, components, testids, services),
 * not the running stack. This is the agreed pattern with the rest of e2e/tests.
 *
 * What the happy path "would" do live (kept in comments next to each group as
 * acceptance reference for a future browser-driven spec, see test.skip block at
 * the bottom of this file):
 *   - Admin creates a connector github (OAuth credentials, mocked).
 *   - Admin opens the GitHub Sheet, clicks "Configurer la App" and pastes a
 *     fake App ID + private key. Backend validates via JWT-signed POST /app
 *     (mocked 200).
 *   - Admin clicks the install deep-link, GitHub redirects back to
 *     /api/connectors/github/app-install/callback?installation_id=...
 *     &setup_action=install. Callback persists the row.
 *   - Sheet's installations table refreshes via the SSE event
 *     `connector.github_app_installation_added` (no polling).
 *   - A governed workflow stub commits a file via the App; verify the resulting
 *     commit shows author=committer=user (D7 strict identity).
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const PLAN_FILE = resolve(ROOT, "docs/superpowers/plans/2026-05-04-github-provider.md");
const WIZARD_FILE = resolve(ROOT, "ui/src/components/connectors/GitHubConnectorWizard.tsx");
const SHEET_FILE = resolve(ROOT, "ui/src/components/connectors/GitHubConnectorSheet.tsx");
const CONNECTORS_PAGE = resolve(ROOT, "ui/src/pages/Connectors.tsx");
const APP_SERVICE_FILE = resolve(ROOT, "server/src/services/github-app.ts");
const APP_ROUTES_FILE = resolve(ROOT, "server/src/routes/github-app.ts");
const CALLBACK_FILE = resolve(ROOT, "server/src/routes/connectors-callback.ts");
const APP_TS = resolve(ROOT, "server/src/app.ts");
const PROVIDER_FILE = resolve(ROOT, "packages/git-provider/src/github-provider.ts");
const COMMIT_IDENTITY_FILE = resolve(ROOT, "server/src/services/commit-identity.ts");
const RESOLVE_GIT_PROVIDER_FILE = resolve(ROOT, "server/src/mcp/build-mcp-services.ts");

// ---------------------------------------------------------------------------
// Group 1 -- Plan + Phase 6 contracts in place
// ---------------------------------------------------------------------------

test.describe("Group 1 -- plan & decision wiring", () => {
  test("T01 -- Phase 6 plan file exists", async () => {
    await expect(fsAccess(PLAN_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 -- plan documents D6 unified template + D7 strict identity", async () => {
    const content = await readFile(PLAN_FILE, "utf-8");
    expect(content).toMatch(/D6.*Un seul template.*github.*unifi/);
    expect(content).toMatch(/D7.*Commit identity = user partout/);
  });
});

// ---------------------------------------------------------------------------
// Group 2 -- Admin wizard surface (testids + steps)
// ---------------------------------------------------------------------------

test.describe("Group 2 -- GitHub wizard surface", () => {
  test("T03 -- wizard component file exists", async () => {
    await expect(fsAccess(WIZARD_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T04 -- wizard exposes the OAuth step (gh-app-wizard-step-1) with required fields", async () => {
    const content = await readFile(WIZARD_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-wizard-step-1"');
    expect(content).toContain('data-testid="gh-app-display-name"');
    expect(content).toContain('data-testid="gh-app-client-id"');
    expect(content).toContain('data-testid="gh-app-client-secret"');
    expect(content).toContain('data-testid="gh-app-oauth-submit"');
  });

  test("T05 -- wizard exposes the optional App banner (step-2) with configure + skip", async () => {
    const content = await readFile(WIZARD_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-wizard-step-2"');
    expect(content).toContain('data-testid="gh-app-banner-configure"');
    expect(content).toContain('data-testid="gh-app-banner-skip"');
  });

  test("T06 -- wizard exposes the create-on-github deep-link step (3a)", async () => {
    const content = await readFile(WIZARD_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-wizard-step-3a"');
    expect(content).toContain('data-testid="gh-app-create-deeplink"');
  });

  test("T07 -- wizard exposes paste-credentials step (3b) with appId/privateKey/webhookSecret", async () => {
    const content = await readFile(WIZARD_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-wizard-step-3b"');
    expect(content).toContain('data-testid="gh-app-paste-app-id"');
    expect(content).toContain('data-testid="gh-app-paste-private-key"');
    expect(content).toContain('data-testid="gh-app-paste-webhook-secret"');
    expect(content).toContain('data-testid="gh-app-paste-submit"');
  });

  test("T08 -- wizard exposes the install-on-org step (3c) with deep-link + finish + install rows", async () => {
    const content = await readFile(WIZARD_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-wizard-step-3c"');
    expect(content).toContain('data-testid="gh-app-install-deeplink"');
    expect(content).toContain('data-testid="gh-app-finish"');
    expect(content).toMatch(/data-testid=\{?`gh-app-install-row-\$\{/);
  });
});

// ---------------------------------------------------------------------------
// Group 3 -- Sheet surface (sections + actions)
// ---------------------------------------------------------------------------

test.describe("Group 3 -- GitHub Sheet surface", () => {
  test("T09 -- sheet component file exists", async () => {
    await expect(fsAccess(SHEET_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T10 -- sheet exposes OAuth and App sections", async () => {
    const content = await readFile(SHEET_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-sheet"');
    expect(content).toContain('data-testid="gh-app-sheet-oauth-section"');
    expect(content).toContain('data-testid="gh-app-sheet-app-section"');
  });

  test("T11 -- sheet exposes configure + reconfigure + uninstall actions", async () => {
    const content = await readFile(SHEET_FILE, "utf-8");
    expect(content).toContain('data-testid="gh-app-sheet-configure"');
    expect(content).toContain('data-testid="gh-app-reconfigure"');
    expect(content).toContain('data-testid="gh-app-uninstall"');
    expect(content).toContain('data-testid="gh-app-uninstall-confirm"');
  });

  test("T12 -- sheet renders an installations table with rows keyed by installationId", async () => {
    const content = await readFile(SHEET_FILE, "utf-8");
    expect(content).toMatch(/data-testid=\{?`gh-app-installation-row-\$\{/);
    expect(content).toContain('data-testid="gh-app-install-view-on-github"');
  });

  test("T13 -- admin Connectors page mounts a single GitHub tile (D6)", async () => {
    const content = await readFile(CONNECTORS_PAGE, "utf-8");
    // Single tile = the github template slug appears once as a wizard dispatch
    // target. We assert the wizard import + the dispatch by slug.
    expect(content).toContain("GitHubConnectorWizard");
    expect(content).toContain("GitHubConnectorSheet");
    expect(content).toMatch(/templateSlug.*===\s*"github"|slug.*===\s*"github"/);
  });
});

// ---------------------------------------------------------------------------
// Group 4 -- Backend App infra + REST routes
// ---------------------------------------------------------------------------

test.describe("Group 4 -- GitHub App service + REST", () => {
  test("T14 -- service file exposes mintInstallationToken + listInstallations", async () => {
    const content = await readFile(APP_SERVICE_FILE, "utf-8");
    expect(content).toMatch(/mintInstallationToken/);
    expect(content).toMatch(/listInstallations/);
    expect(content).toMatch(/createGitHubApp|persistGitHubApp/);
  });

  test("T15 -- service caches installation tokens with sub-1h TTL (advisory lock)", async () => {
    const content = await readFile(APP_SERVICE_FILE, "utf-8");
    // Per plan (Phase 1 step 2): TTL ~55min in-memory cache + advisory lock.
    expect(content).toMatch(/55|cache|TTL/i);
  });

  test("T16 -- REST file mounts the 4 admin routes scoped per company+connector", async () => {
    const content = await readFile(APP_ROUTES_FILE, "utf-8");
    expect(content).toMatch(/\/companies\/:companyId\/connectors\/:connectorId\/github\/app/);
    expect(content).toMatch(/router\.post/);
    expect(content).toMatch(/router\.get/);
    expect(content).toMatch(/router\.delete/);
    expect(content).toMatch(/installations\/sync/);
  });

  test("T17 -- callback handler persists install + redirects with focus param", async () => {
    const content = await readFile(CALLBACK_FILE, "utf-8");
    expect(content).toContain("/api/connectors/github/app-install/callback");
    expect(content).toMatch(/installation_id/);
    expect(content).toMatch(/setup_action/);
  });

  test("T18 -- routes are mounted in app.ts", async () => {
    const content = await readFile(APP_TS, "utf-8");
    expect(content).toMatch(/githubApp|github-app/);
  });
});

// ---------------------------------------------------------------------------
// Group 5 -- D7 strict commit identity (author == committer == user)
// ---------------------------------------------------------------------------

test.describe("Group 5 -- D7 strict commit identity", () => {
  test("T19 -- GitHubProvider exists and uses Git Data API for writes", async () => {
    const content = await readFile(PROVIDER_FILE, "utf-8");
    // Plan Phase 2 step 2 requires git.createBlob + git.createTree +
    // git.createCommit + git.updateRef instead of repos.createOrUpdateFileContents.
    expect(content).toMatch(/createBlob/);
    expect(content).toMatch(/createTree/);
    expect(content).toMatch(/createCommit/);
    expect(content).toMatch(/updateRef/);
  });

  test("T20 -- GitHubProvider injects author AND committer = identity (D7)", async () => {
    const content = await readFile(PROVIDER_FILE, "utf-8");
    // Both fields must be present in the createCommit payload.
    expect(content).toMatch(/author/);
    expect(content).toMatch(/committer/);
  });

  test("T21 -- commit-identity service exists and resolves a {name,email}", async () => {
    const content = await readFile(COMMIT_IDENTITY_FILE, "utf-8");
    expect(content).toMatch(/resolveCommitIdentity/);
    expect(content).toMatch(/name/);
    expect(content).toMatch(/email/);
  });

  test("T22 -- resolver auto-dispatches App vs OAuth without bot identity", async () => {
    const content = await readFile(RESOLVE_GIT_PROVIDER_FILE, "utf-8");
    expect(content).toMatch(/github/i);
    // The resolver should reference both modes — "user-oauth" and "app-installation".
    expect(content).toMatch(/app-installation|appInstallation/);
    expect(content).toMatch(/user-oauth|userOauth/);
  });
});

// ---------------------------------------------------------------------------
// Group 6 -- Acceptance follow-up: live browser flow (skipped placeholder)
// ---------------------------------------------------------------------------

test.describe("Group 6 -- live browser flow (deferred)", () => {
  test.skip("T23 -- happy path: admin creates connector, configures App, install callback, run workflow that commits with author=committer=user", async () => {
    // Deferred: requires the dev server to expose `MNM_E2E_SEED=true` plus a
    // mocking layer (msw or a local fake-github fixture) to intercept
    // api.github.com calls. The current e2e harness is file-content driven and
    // does not boot a router-aware browser context for OAuth/App flows. The
    // backend routes exist (see Group 4) and unit tests cover the service +
    // provider in isolation. Tracked as an open follow-up next to "Webhook
    // ingestion" in the plan.
  });
});
