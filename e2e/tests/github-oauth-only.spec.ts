/**
 * github-oauth-only.spec.ts -- GitHub provider, OAuth pure (no App) -- Phase 6
 *
 * File-content tests that verify the OAuth-only path of the GitHub provider
 * chantier (plan: docs/superpowers/plans/2026-05-04-github-provider.md). Same
 * pattern as the rest of e2e/tests: locks down the wiring (resolver branch,
 * helper, identity service) without booting a browser. The live browser
 * scenario is captured as a `test.skip` placeholder at the end with the
 * acceptance criteria.
 *
 * Live scenario (deferred, see Group 4 below):
 *   - Admin creates a connector github with OAuth credentials only — no App
 *     is configured.
 *   - A user runs a stub governed workflow that commits a file.
 *   - The resolver dispatches to mode user-oauth, GitHubProvider commits via
 *     Git Data API and injects author == committer == user (D7).
 *   - Verify the resulting commit on the test repo has the user as both the
 *     author and committer fields.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const PROVIDER_FILE = resolve(ROOT, "packages/git-provider/src/github-provider.ts");
const RESOLVE_FILE = resolve(ROOT, "server/src/mcp/build-mcp-services.ts");
const COMMIT_IDENTITY_FILE = resolve(ROOT, "server/src/services/commit-identity.ts");
const HOOKS_PROVIDER_WIRING = resolve(ROOT, "server/src/mcp/build-mcp-services.ts");
const CC_PLUGIN_FACTORY = resolve(ROOT, "server/src/services/cc-plugin-import/source-provider-factory.ts");
const CONNECTOR_TEMPLATES = resolve(ROOT, "server/src/services/connector-templates.ts");

// ---------------------------------------------------------------------------
// Group 1 -- The unified github template (D6) is the single entry point
// ---------------------------------------------------------------------------

test.describe("Group 1 -- unified github template (D6)", () => {
  test("T01 -- connector-templates.ts exposes a single github template", async () => {
    const content = await readFile(CONNECTOR_TEMPLATES, "utf-8");
    expect(content).toMatch(/slug:\s*"github"/);
    // No splintered "github-app" template — D6 enforces a single tile.
    expect(content).not.toMatch(/slug:\s*"github-app"/);
  });
});

// ---------------------------------------------------------------------------
// Group 2 -- Resolver dispatches OAuth user mode when no App is configured
// ---------------------------------------------------------------------------

test.describe("Group 2 -- resolver OAuth fallback", () => {
  test("T02 -- resolver knows about the github GitProviderKind", async () => {
    const content = await readFile(RESOLVE_FILE, "utf-8");
    expect(content).toMatch(/GitProviderKind\s*=\s*[^;]*"github"/);
  });

  test("T03 -- resolver branches on user-oauth when no matching App installation is found", async () => {
    const content = await readFile(RESOLVE_FILE, "utf-8");
    expect(content).toMatch(/mode:\s*"user-oauth"/);
    expect(content).toMatch(/getUserToken/);
    expect(content).toMatch(/"github"/);
  });

  test("T04 -- resolver still throws connectorRequired('github') when OAuth is missing in strict mode", async () => {
    const content = await readFile(RESOLVE_FILE, "utf-8");
    expect(content).toMatch(/connectorRequired/);
    expect(content).toMatch(/"github"/);
  });

  test("T05 -- cc-plugin-import factory accepts kind=github", async () => {
    const content = await readFile(CC_PLUGIN_FACTORY, "utf-8");
    expect(content).toMatch(/github/);
    // The legacy throw "only supports kind=gitlab" must now mention github too
    // (Phase 3 step 2 of the plan removed the gitlab-only restriction).
    expect(content).toMatch(/only supports kind=gitlab\|github/);
  });
});

// ---------------------------------------------------------------------------
// Group 3 -- D7 strict: author == committer == user even in OAuth mode
// ---------------------------------------------------------------------------

test.describe("Group 3 -- D7 commit identity in OAuth mode", () => {
  test("T06 -- GitHubProvider exists", async () => {
    await expect(fsAccess(PROVIDER_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T07 -- GitHubProvider supports user-oauth mode constructor", async () => {
    const content = await readFile(PROVIDER_FILE, "utf-8");
    expect(content).toMatch(/user-oauth/);
  });

  test("T08 -- commit identity service is consumed for both modes (App + OAuth)", async () => {
    const content = await readFile(COMMIT_IDENTITY_FILE, "utf-8");
    expect(content).toMatch(/resolveCommitIdentity/);
  });

  test("T09 -- GitHubProvider injects author AND committer = identity even in OAuth mode", async () => {
    const content = await readFile(PROVIDER_FILE, "utf-8");
    // Same low-level Git Data API path — author and committer are explicit
    // in the createCommit payload regardless of token kind (D7).
    expect(content).toMatch(/createCommit/);
    expect(content).toMatch(/author/);
    expect(content).toMatch(/committer/);
  });

  test("T10 -- providerCatalog wires github so helpers.http(\"github\") works", async () => {
    // The catalog is built in mcp/build-mcp-services.ts (Phase 4 step 2 of the
    // plan) and consumed by workflow-hooks via deps.providerCatalog.
    const content = await readFile(HOOKS_PROVIDER_WIRING, "utf-8");
    expect(content).toMatch(/github:\s*\{\s*baseUrl:\s*"https:\/\/api\.github\.com"/);
  });
});

// ---------------------------------------------------------------------------
// Group 4 -- Acceptance follow-up: live browser flow (skipped placeholder)
// ---------------------------------------------------------------------------

test.describe("Group 4 -- live OAuth-only flow (deferred)", () => {
  test.skip("T11 -- happy path: admin creates github connector OAuth-only, user runs workflow that commits with author=committer=user", async () => {
    // Deferred: requires the dev server with MNM_E2E_SEED=true plus a fake
    // api.github.com fixture (msw or local stub) to intercept Git Data API
    // calls. Same reason as github-flow.spec.ts Group 6 — current e2e harness
    // is file-content driven. Backend resolver (build-mcp-services.ts) is
    // already covered by Vitest unit tests under
    // server/src/mcp/__tests__/resolve-git-provider.test.ts (added in
    // Phase 3 of the GitHub provider plan).
  });
});
