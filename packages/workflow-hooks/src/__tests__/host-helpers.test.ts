import { describe, it, expect, vi } from "vitest";
import {
  buildHostHelpers,
  HookHelperError,
} from "../host-helpers.js";
import type {
  ConnectorTokenSource,
  LlmRequest,
  LlmResponse,
} from "../types.js";

function lastFetchCall(fetchImpl: ReturnType<typeof vi.fn>): {
  url: string;
  init: { headers?: Headers; method?: string; body?: unknown };
} {
  const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
  const last = calls[calls.length - 1]!;
  return { url: last[0], init: last[1] as { headers?: Headers; method?: string; body?: unknown } };
}

const COMPANY_ID = "co-1";
const ACTOR_USER_ID = "user-1";
const RUN_ID = "run-1";
const GIT_SHA = "deadbeef";

function noopAssertSafeUrl(): Promise<void> {
  return Promise.resolve();
}

function fakeConnectors(over: Partial<ConnectorTokenSource> = {}): ConnectorTokenSource {
  return {
    getActiveConnectorBySlug: async (_co, slug) =>
      slug === "jira"
        ? { id: "c-1", type: "oauth2", baseUrl: "https://jira.example.com" }
        : null,
    getUserToken: async () => ({
      accessToken: "tok-abc",
      expiresAt: null,
      scopes: ["read"],
      type: "oauth2",
    }),
    ...over,
  };
}

function fakeLlm(
  budget: number | null = 100_000,
  invokeImpl: (req: LlmRequest) => Promise<LlmResponse> = async (req) => ({
    text: `echo:${req.prompt}`,
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
) {
  return {
    invoke: invokeImpl,
    estimateInputTokens: (req: LlmRequest) =>
      Math.ceil((req.prompt.length + (req.system?.length ?? 0)) / 4),
    tokenBudgetRemaining: () => budget,
  };
}

function fakeGitProvider() {
  return {
    fetchBlob: vi.fn(async () => "<handoff content>"),
  } as unknown as Parameters<typeof buildHostHelpers>[0]["gitProvider"];
}

const RUNTIME = {
  companyId: COMPANY_ID,
  actorUserId: ACTOR_USER_ID,
  runId: RUN_ID,
  workflowGitSha: GIT_SHA,
};

describe("buildHostHelpers — http [security tests 1-5, 6-7]", () => {
  it("[T1] HostHelpers does not expose `credential` (HOST-ONLY)", () => {
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(async () => new Response("{}", { status: 200 })),
      },
      RUNTIME,
    );
    expect((helpers as unknown as Record<string, unknown>).credential).toBeUndefined();
    // Object.keys must NOT contain 'credential'
    expect(Object.keys(helpers)).toEqual(
      expect.arrayContaining(["http", "llm", "fetchHandoff"]),
    );
    expect(Object.keys(helpers)).not.toContain("credential");
  });

  it("[T2] OAuth token injected as Bearer Authorization", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl,
      },
      RUNTIME,
    );
    await helpers.http({ provider: "jira", path: "/rest/api/3/issue/PROJ-1" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const { init } = lastFetchCall(fetchImpl);
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok-abc");
  });

  it("[T3] User not connected → HOOK_USER_NOT_CONNECTED", async () => {
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors({
          getUserToken: async () => {
            const err = new Error("not connected") as Error & { code: string };
            err.code = "CONNECTOR_USER_NOT_CONNECTED";
            throw err;
          },
        }),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.http({ provider: "jira", path: "/" }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_USER_NOT_CONNECTED",
    });
  });

  it("[T4] Authorization header from caller is silently rejected (host re-injects)", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl,
      },
      RUNTIME,
    );
    await helpers.http({
      provider: "jira",
      path: "/x",
      headers: {
        Authorization: "Bearer ATTACKER",
        "X-API-Key": "ATTACKER",
        "X-Custom": "preserved",
      },
    });
    const { init } = lastFetchCall(fetchImpl);
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok-abc");
    expect(headers.get("X-API-Key")).toBeNull();
    expect(headers.get("X-Custom")).toBe("preserved");
  });

  it("[T5] Cross-company user → HOOK_USER_NOT_IN_COMPANY", async () => {
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors({
          getUserToken: async () => {
            const err = new Error("forbidden") as Error & { code: string };
            err.code = "CONNECTOR_USER_NOT_IN_COMPANY";
            throw err;
          },
        }),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.http({ provider: "jira", path: "/x" }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_USER_NOT_IN_COMPANY",
    });
  });

  it("[T6] DNS rebind to RFC-1918 → HOOK_SSRF_BLOCKED", async () => {
    const assertSafeUrl = vi.fn(async () => {
      throw new Error("SSRF guard: IP address 10.0.0.1 resolves to a blocked private/reserved range");
    });
    const helpers = buildHostHelpers(
      {
        assertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.http({ provider: "jira", path: "/" }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_SSRF_BLOCKED",
    });
    expect(assertSafeUrl).toHaveBeenCalled();
  });

  it("[T7] Cloud metadata 169.254.169.254 → HOOK_SSRF_BLOCKED via assertSafeUrl", async () => {
    const assertSafeUrl = vi.fn(async (url: string) => {
      if (url.includes("169.254.169.254")) {
        throw new Error("SSRF guard: link-local rejected");
      }
    });
    const helpers = buildHostHelpers(
      {
        assertSafeUrl,
        connectors: fakeConnectors({
          getActiveConnectorBySlug: async () => ({
            id: "c",
            type: "oauth2",
            baseUrl: "http://169.254.169.254",
          }),
        }),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.http({ provider: "jira", path: "/latest/meta-data" }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_SSRF_BLOCKED",
    });
  });

  it("Unknown provider → HOOK_PROVIDER_NOT_ALLOWED", async () => {
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.http({ provider: "unknown", path: "/" }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_PROVIDER_NOT_ALLOWED",
    });
  });
});

describe("buildHostHelpers — llm [security test 16]", () => {
  it("[T16] token budget exceeded short-circuits before invoke", async () => {
    const invoke = vi.fn();
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(10, invoke as unknown as (req: LlmRequest) => Promise<LlmResponse>),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.llm({ prompt: "x".repeat(1000) }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_LLM_BUDGET_EXCEEDED",
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns provider response with usage stamped", async () => {
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    const result = await helpers.llm({ prompt: "hello" });
    expect(result.text).toBe("echo:hello");
    expect(result.usage.input_tokens).toBe(10);
  });

  it("budget=null disables the budget check", async () => {
    const invoke = vi.fn(async () => ({
      text: "ok",
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(null, invoke),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await helpers.llm({ prompt: "x".repeat(500_000) });
    expect(invoke).toHaveBeenCalledOnce();
  });
});

describe("buildHostHelpers — fetchHandoff", () => {
  it("rejects non-sha refs (TOCTOU mitigation)", async () => {
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    await expect(
      helpers.fetchHandoff({ git_sha: "main", path: "x.md" }),
    ).rejects.toThrow(/hex sha or the run's pinned sha/);
  });

  it("accepts a hex sha and forwards to gitProvider", async () => {
    const gitProvider = fakeGitProvider();
    const helpers = buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider,
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
    const content = await helpers.fetchHandoff({
      git_sha: "abcdef0123456789",
      path: "outputs/report.md",
    });
    expect(content).toBe("<handoff content>");
    expect(gitProvider.fetchBlob).toHaveBeenCalledWith({
      path: "outputs/report.md",
      ref: "abcdef0123456789",
    });
  });
});

describe("HookHelperError", () => {
  it("carries errorCode + message", () => {
    const err = new HookHelperError("HOOK_SSRF_BLOCKED", "blocked");
    expect(err.errorCode).toBe("HOOK_SSRF_BLOCKED");
    expect(err.message).toBe("blocked");
    expect(err.name).toBe("HookHelperError");
    expect(err).toBeInstanceOf(Error);
  });
});
