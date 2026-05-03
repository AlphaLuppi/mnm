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

vi.mock("../../services/connectors.js", async () => {
  const actual = await vi.importActual<typeof import("../../services/connectors.js")>(
    "../../services/connectors.js",
  );
  return {
    ...actual,
    connectorService: () => ({
      getUserToken: getUserTokenSpy,
    }),
  };
});

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
