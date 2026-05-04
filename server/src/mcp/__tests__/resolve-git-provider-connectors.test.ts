import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConnectorError } from "../../services/connectors.js";

// CONNECTORS-PLATFORM Sprint 2 — T8.2 unit tests for the Step 1a preference
// path in `createResolveGitProvider`. Mocks `connectorService` so the test
// runs without a Postgres dependency and exercises only the routing logic
// (Connectors → BetterAuth fallback → company config fallback).
//
// Integration coverage (real DB, RLS, refresh) lives in
// connectors-service.test.ts and resolve-git-provider.test.ts.

const getUserTokenSpy = vi.fn();
// Phase 3 compl. — auto-dispatch reads `getActiveConnectorBySlug` from the
// connector service before deciding to mint an installation token. We default
// to "no connector configured" (returns null) so existing tests behave as
// before; the new App-dispatch test cases override per-test.
const getActiveConnectorBySlugSpy = vi.fn(async () => null);

vi.mock("../../services/connectors.js", async () => {
  const actual = await vi.importActual<typeof import("../../services/connectors.js")>(
    "../../services/connectors.js",
  );
  return {
    ...actual,
    connectorService: () => ({
      getUserToken: getUserTokenSpy,
      getActiveConnectorBySlug: getActiveConnectorBySlugSpy,
    }),
  };
});

// Phase 3 compl. — mock the github-app service so we can drive the dispatch
// decision (App configured + matching install OR not).
const getGitHubAppByConnectorSpy = vi.fn(async () => null);
const mintInstallationTokenSpy = vi.fn(async () => "ghs_inst_token");

vi.mock("../../services/github-app.js", () => ({
  githubAppService: () => ({
    getGitHubAppByConnector: getGitHubAppByConnectorSpy,
    mintInstallationToken: mintInstallationTokenSpy,
  }),
}));

// Drizzle ORM is used by build-mcp-services for the legacy BetterAuth path
// and the company-level config_layer_items lookup. We stub `db` to surface
// "no rows" everywhere — Step 1a will trigger first; Step 1 + Step 2 will
// fall through to the env-var provider in their fall-back path.
function buildEmptyDb() {
  const empty = Object.assign(Promise.resolve([]), {
    limit: () => Promise.resolve([]),
    where: () => Object.assign(Promise.resolve([]), { limit: () => Promise.resolve([]) }),
    orderBy: () => Promise.resolve([]),
  });
  // .innerJoin chain for company-level config_layer_items lookup
  const fromChain = (): unknown => ({
    where: () =>
      Object.assign(Promise.resolve([]), {
        orderBy: () => Promise.resolve([]),
        limit: () => Promise.resolve([]),
      }),
    innerJoin: () => ({
      where: () =>
        Object.assign(Promise.resolve([]), {
          orderBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([]),
        }),
    }),
  });
  return {
    select: () => ({
      from: fromChain,
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    execute: () => Promise.resolve(empty),
  } as unknown as import("@mnm/db").Db;
}

describe("createResolveGitProvider — Step 1a Connectors Platform path", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MNM_DEPLOYMENT_MODE = "authenticated";
    process.env.MNM_GIT_PROVIDER = "local";
    process.env.MNM_GIT_LOCAL_PATH = "/tmp/mnm-test-bare";
    getUserTokenSpy.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("calls getUserToken('gitlab') when authenticated + userId set", async () => {
    getUserTokenSpy.mockResolvedValueOnce({
      accessToken: "gitlab-access-from-connectors",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: ["api", "read_repository"],
      type: "oauth2",
    });
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-000000000001",
      userId: "user-1",
    });

    expect(provider.constructor.name).toBe("GitlabProvider");
    expect(getUserTokenSpy).toHaveBeenCalledTimes(1);
    expect(getUserTokenSpy).toHaveBeenCalledWith(
      "user-1",
      "gitlab",
      "00000000-0000-0000-0000-000000000001",
    );
    // The provider id is namespaced "gitlab:connector:<userId>" so we can
    // distinguish it from the legacy BetterAuth path "gitlab:user:<userId>"
    // and from the company PAT path in audit logs.
    expect((provider as unknown as { providerId: string }).providerId).toBe(
      "gitlab:connector:user-1",
    );
  });

  it("caches the Connectors provider per (company, user, resourceType)", async () => {
    getUserTokenSpy.mockResolvedValue({
      accessToken: "stable-token",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: [],
      type: "oauth2",
    });
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    const args = { companyId: "company-A", userId: "user-X", resourceType: "workflow" as const };
    const p1 = await resolve(args);
    const p2 = await resolve(args);

    expect(p1).toBe(p2);
    // Cache hit on second call — getUserToken called only once.
    expect(getUserTokenSpy).toHaveBeenCalledTimes(1);
  });

  it("falls through to legacy path on CONNECTOR_NOT_CONFIGURED (opt-out only)", async () => {
    process.env.MNM_REQUIRE_USER_CONNECTOR = "false";
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError("CONNECTOR_NOT_CONFIGURED", "no enabled gitlab connector"),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    // No connector + no betterauth row + no config_layer_item → env fallback (LocalBareRepoProvider)
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-000000000002",
      userId: "user-2",
    });

    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
    expect(getUserTokenSpy).toHaveBeenCalled();
  });

  it("falls through to legacy path on CONNECTOR_USER_NOT_CONNECTED (opt-out only)", async () => {
    process.env.MNM_REQUIRE_USER_CONNECTOR = "false";
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError("CONNECTOR_USER_NOT_CONNECTED", "user has not linked gitlab"),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-000000000003",
      userId: "user-3",
    });

    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
  });

  it("surfaces CONNECTOR_USER_NOT_IN_COMPANY (cross-tenant attack signal)", async () => {
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError(
        "CONNECTOR_USER_NOT_IN_COMPANY",
        "userId not an active member of companyId",
      ),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    await expect(
      resolve({ companyId: "company-X", userId: "rogue-user" }),
    ).rejects.toThrow(ConnectorError);
  });

  it("surfaces CONNECTOR_TOKEN_REVOKED (user must reconnect)", async () => {
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError("CONNECTOR_TOKEN_REVOKED", "provider invalidated refresh"),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    await expect(
      resolve({ companyId: "company-Y", userId: "user-Y" }),
    ).rejects.toThrow("provider invalidated refresh");
  });

  it("skips Step 1a entirely in local_trusted mode (no getUserToken call)", async () => {
    process.env.MNM_DEPLOYMENT_MODE = "local_trusted";
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    await resolve({ companyId: "company-Z", userId: "user-Z" });

    expect(getUserTokenSpy).not.toHaveBeenCalled();
  });

  it("skips Step 1a when userId is missing (system-context calls)", async () => {
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());
    await resolve({ companyId: "company-W", userId: null });

    expect(getUserTokenSpy).not.toHaveBeenCalled();
  });

  // Phase 3 of connectors-consolidation plan (2026-05-03) — strict mode.
  it("throws 412 CONNECTOR_REQUIRED when MNM_REQUIRE_USER_CONNECTOR=true and user not connected", async () => {
    process.env.MNM_REQUIRE_USER_CONNECTOR = "true";
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError("CONNECTOR_USER_NOT_CONNECTED", "user has not linked gitlab"),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());

    await expect(
      resolve({
        companyId: "00000000-0000-0000-0000-000000000099",
        userId: "user-strict",
      }),
    ).rejects.toMatchObject({
      status: 412,
      details: {
        code: "CONNECTOR_REQUIRED",
        connectorSlug: "gitlab",
        connectFlowUrl: "/settings/accounts?focus=gitlab",
      },
    });
  });

  it("strict mode also blocks on CONNECTOR_NOT_CONFIGURED", async () => {
    process.env.MNM_REQUIRE_USER_CONNECTOR = "true";
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError("CONNECTOR_NOT_CONFIGURED", "admin has not enabled gitlab"),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildEmptyDb());

    await expect(
      resolve({
        companyId: "00000000-0000-0000-0000-000000000098",
        userId: "user-strict",
      }),
    ).rejects.toMatchObject({ status: 412 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 of github-provider plan (D6 — unified github template, auto-dispatch
// based on company's git_provider config_layer_item kind).
//
// When the company config declares `kind: "github"`, the resolver MUST call
// `getUserToken(userId, "github", companyId)` and instantiate a GitHubProvider
// instead of the default GitlabProvider.
// ─────────────────────────────────────────────────────────────────────────────

function buildDbWithGithubConfig() {
  // Mocked db.select(...).from(...).innerJoin(...).where(...).orderBy(...) and
  // .limit() chains all resolve to a single github config layer item, so both
  // `readCompanyGitProviderKind` and `resolveGitHubCoordinates` get the same
  // row. Build-mcp-services also queries authAccounts (BetterAuth) — we leave
  // those queries returning empty since Step 1 is gitlab-only.
  const githubRow = {
    configJson: {
      kind: "github",
      providerId: "github:alphaluppi/mnm",
      owner: "alphaluppi",
      repo: "mnm",
      paths: { workflows: "workflows", agents: "agents" },
    },
  };
  const fromChain = (): unknown => ({
    where: () =>
      Object.assign(Promise.resolve([githubRow]), {
        orderBy: () => Promise.resolve([githubRow]),
        limit: () => Promise.resolve([githubRow]),
      }),
    innerJoin: () => ({
      where: () =>
        Object.assign(Promise.resolve([githubRow]), {
          orderBy: () => Promise.resolve([githubRow]),
          limit: () => Promise.resolve([githubRow]),
        }),
    }),
  });
  return {
    select: () => ({ from: fromChain }),
    update: () => ({
      set: () => ({ where: () => Promise.resolve() }),
    }),
    execute: () => Promise.resolve([]),
  } as unknown as import("@mnm/db").Db;
}

describe("createResolveGitProvider — github auto-dispatch (Phase 3)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MNM_DEPLOYMENT_MODE = "authenticated";
    getUserTokenSpy.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("calls getUserToken('github') when company config layer kind is github", async () => {
    getUserTokenSpy.mockResolvedValueOnce({
      accessToken: "github-oauth-token-from-connectors",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: ["repo", "read:user"],
      type: "oauth2",
    });
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildDbWithGithubConfig());
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-0000000000g1",
      userId: "user-gh-1",
    });

    expect(provider.constructor.name).toBe("GitHubProvider");
    expect(getUserTokenSpy).toHaveBeenCalledWith(
      "user-gh-1",
      "github",
      "00000000-0000-0000-0000-0000000000g1",
    );
    expect((provider as unknown as { providerId: string }).providerId).toBe(
      "github:connector:user-gh-1",
    );
  });

  it("strict mode throws CONNECTOR_REQUIRED with slug=github when user not connected", async () => {
    process.env.MNM_REQUIRE_USER_CONNECTOR = "true";
    getUserTokenSpy.mockRejectedValueOnce(
      new ConnectorError("CONNECTOR_USER_NOT_CONNECTED", "user has not linked github"),
    );
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildDbWithGithubConfig());

    await expect(
      resolve({
        companyId: "00000000-0000-0000-0000-0000000000g2",
        userId: "user-gh-strict",
      }),
    ).rejects.toMatchObject({
      status: 412,
      details: {
        code: "CONNECTOR_REQUIRED",
        connectorSlug: "github",
        connectFlowUrl: "/settings/accounts?focus=github",
      },
    });
  });

  it("propagates the company kind to the cache key (no leak into the gitlab path)", async () => {
    getUserTokenSpy.mockResolvedValue({
      accessToken: "stable-github-token",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: [],
      type: "oauth2",
    });
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(buildDbWithGithubConfig());
    const args = { companyId: "company-gh", userId: "user-gh-cache", resourceType: "workflow" as const };
    const p1 = await resolve(args);
    const p2 = await resolve(args);

    expect(p1).toBe(p2);
    expect(p1.constructor.name).toBe("GitHubProvider");
    // Cache hit: getUserToken called once even after two resolve() calls.
    expect(getUserTokenSpy).toHaveBeenCalledTimes(1);
    // The single call was for the "github" slug, not "gitlab".
    expect(getUserTokenSpy).toHaveBeenCalledWith("user-gh-cache", "github", "company-gh");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 compl. — App vs OAuth auto-dispatch in the github branch.
//
// When a GitHub App is configured on the company's connector AND has an
// installation matching the resolved repo owner (NOT suspended), the resolver
// MUST instantiate GitHubProvider in mode `app-installation` with a
// mintToken closure forwarding to the github-app service. Otherwise it
// falls through to mode `user-oauth` (existing behavior).
// ─────────────────────────────────────────────────────────────────────────────

function buildDbForAppDispatch(opts: {
  // installationRows is what `db.select(...).from(githubAppInstallations)
  //   .where(...).limit(1)` returns when the App auto-dispatch checks for
  //   a matching install. Default: [] (no matching install).
  installationRows: unknown[];
}) {
  const githubRow = {
    configJson: {
      kind: "github",
      providerId: "github:alphaluppi/mnm",
      owner: "alphaluppi",
      repo: "mnm",
      paths: { workflows: "workflows", agents: "agents" },
    },
  };
  // Two distinct query shapes get hit on the github branch :
  //   1. config_layer_items (.from(...).innerJoin(...).where(...)) — returns githubRow
  //   2. github_app_installations (.from(...).where(...).limit(1)) — returns installationRows
  // The mock dispatches by the order of `from(...)` calls within a single
  // resolve(): config first, then (only if appRow non-null) installations.
  let fromCallCount = 0;
  return {
    select: () => ({
      from: (): unknown => {
        const callIdx = fromCallCount++;
        // Heuristic: first 2-3 `.from(...)` calls in a resolve() are
        // config_layer_items lookups (kind detection + coordinates). Later
        // ones are our installation lookup. We treat the LAST call as the
        // installation lookup if `installationRows` was provided.
        const isInstallationCall = callIdx >= 2;
        const rows = isInstallationCall ? opts.installationRows : [githubRow];
        return {
          where: () =>
            Object.assign(Promise.resolve(rows), {
              orderBy: () => Promise.resolve(rows),
              limit: () => Promise.resolve(rows),
            }),
          innerJoin: () => ({
            where: () =>
              Object.assign(Promise.resolve([githubRow]), {
                orderBy: () => Promise.resolve([githubRow]),
                limit: () => Promise.resolve([githubRow]),
              }),
          }),
        };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    execute: () => Promise.resolve([]),
  } as unknown as import("@mnm/db").Db;
}

describe("createResolveGitProvider — github App auto-dispatch (Phase 3 compl.)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.MNM_DEPLOYMENT_MODE = "authenticated";
    getUserTokenSpy.mockReset();
    getActiveConnectorBySlugSpy.mockReset();
    getGitHubAppByConnectorSpy.mockReset();
    mintInstallationTokenSpy.mockReset();
    // Defaults: connector exists, but no App configured.
    getActiveConnectorBySlugSpy.mockResolvedValue({
      id: "connector-1",
      providerSlug: "github",
    } as never);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("dispatches to mode app-installation when App configured + installation matches owner", async () => {
    getGitHubAppByConnectorSpy.mockResolvedValueOnce({
      id: "app-1",
      appId: "12345",
      appSlug: "mnm-app",
      createdAt: new Date(),
      revokedAt: null,
    } as never);
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(
      buildDbForAppDispatch({
        installationRows: [{ installationId: "9999" }],
      }),
    );
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-0000000000a1",
      userId: "user-app-1",
    });

    expect(provider.constructor.name).toBe("GitHubProvider");
    // Provider id reveals the dispatch decision (app vs connector vs user).
    expect((provider as unknown as { providerId: string }).providerId).toBe(
      "github:app:user-app-1",
    );
    // user-OAuth is NOT consulted when App matches.
    expect(getUserTokenSpy).not.toHaveBeenCalled();
  });

  it("falls through to mode user-oauth when App configured but no matching installation", async () => {
    getGitHubAppByConnectorSpy.mockResolvedValueOnce({
      id: "app-1",
      appId: "12345",
      appSlug: "mnm-app",
      createdAt: new Date(),
      revokedAt: null,
    } as never);
    getUserTokenSpy.mockResolvedValueOnce({
      accessToken: "user-oauth-token",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: [],
      type: "oauth2",
    });
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(
      buildDbForAppDispatch({ installationRows: [] }), // No matching install
    );
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-0000000000a2",
      userId: "user-app-2",
    });

    expect(provider.constructor.name).toBe("GitHubProvider");
    expect((provider as unknown as { providerId: string }).providerId).toBe(
      "github:connector:user-app-2",
    );
    expect(getUserTokenSpy).toHaveBeenCalledWith("user-app-2", "github", expect.any(String));
  });

  it("falls through to mode user-oauth when no App configured at all", async () => {
    // App lookup returns null → straight to user-OAuth.
    getGitHubAppByConnectorSpy.mockResolvedValueOnce(null);
    getUserTokenSpy.mockResolvedValueOnce({
      accessToken: "oauth-token",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: [],
      type: "oauth2",
    });
    const { createResolveGitProvider } = await import("../build-mcp-services.js");
    const resolve = createResolveGitProvider(
      buildDbForAppDispatch({ installationRows: [] }),
    );
    const provider = await resolve({
      companyId: "00000000-0000-0000-0000-0000000000a3",
      userId: "user-app-3",
    });

    expect(provider.constructor.name).toBe("GitHubProvider");
    expect((provider as unknown as { providerId: string }).providerId).toBe(
      "github:connector:user-app-3",
    );
  });
});
