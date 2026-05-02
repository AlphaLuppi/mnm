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
// Full sha1 (40 hex chars, lowercase) — fetchHandoff regex requires
// 40-64 hex; a short 8-char sha would now be rejected.
const GIT_SHA = "deadbeefcafebabe0000000000000000abcdef01";

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
    const fullSha = "abcdef0123456789abcdef0123456789abcdef01"; // 40 hex
    const content = await helpers.fetchHandoff({
      git_sha: fullSha,
      path: "outputs/report.md",
    });
    expect(content).toBe("<handoff content>");
    expect(gitProvider.fetchBlob).toHaveBeenCalledWith({
      path: "outputs/report.md",
      ref: fullSha,
    });
  });
});

describe("buildHostHelpers — http header sanitization (P0.1 hardening)", () => {
  function buildHelpers(fetchImpl: ReturnType<typeof vi.fn>) {
    return buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl,
      },
      RUNTIME,
    );
  }

  it("[P0.1-a] strips x-forwarded-* and other reverse-proxy headers", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const helpers = buildHelpers(fetchImpl);
    await helpers.http({
      provider: "jira",
      path: "/x",
      headers: {
        "X-Forwarded-For": "10.0.0.1",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
        "X-Real-IP": "10.0.0.2",
        Host: "internal.svc",
        "Proxy-Authenticate": "Basic ATTACKER",
        "WWW-Authenticate": "Basic ATTACKER",
        "X-Custom": "preserved",
      },
    });
    const { init } = lastFetchCall(fetchImpl);
    const headers = init.headers as Headers;
    expect(headers.get("X-Forwarded-For")).toBeNull();
    expect(headers.get("X-Forwarded-Host")).toBeNull();
    expect(headers.get("X-Forwarded-Proto")).toBeNull();
    expect(headers.get("X-Real-IP")).toBeNull();
    expect(headers.get("Host")).toBeNull();
    expect(headers.get("Proxy-Authenticate")).toBeNull();
    expect(headers.get("WWW-Authenticate")).toBeNull();
    expect(headers.get("X-Custom")).toBe("preserved");
  });

  it("[P0.1-b] rejects zero-width / NFKC bypasses on Authorization", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const helpers = buildHelpers(fetchImpl);
    // Zero-width space (U+200B) inserted between "Auth" and "orization".
    await helpers.http({
      provider: "jira",
      path: "/x",
      headers: {
        "Auth​orization": "Bearer ATTACKER",
        // Trailing whitespace + uppercase variants — toLowerCase alone
        // would not have stripped these unicode characters.
        " AUTHORIZATION ": "Bearer ATTACKER2",
      },
    });
    const { init } = lastFetchCall(fetchImpl);
    const headers = init.headers as Headers;
    // Only host-injected Bearer survives; both bypass attempts dropped.
    expect(headers.get("Authorization")).toBe("Bearer tok-abc");
  });

  it("[P0.1-c] rejects CRLF in header name", async () => {
    const helpers = buildHelpers(
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(
      helpers.http({
        provider: "jira",
        path: "/x",
        headers: { "X-Foo\r\nAuthorization": "Bearer ATTACKER" },
      }),
    ).rejects.toThrow(/CR\/LF/);
  });

  it("[P0.1-d] rejects CRLF in header value", async () => {
    const helpers = buildHelpers(
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(
      helpers.http({
        provider: "jira",
        path: "/x",
        headers: { "X-Foo": "bar\r\nAuthorization: Bearer ATTACKER" },
      }),
    ).rejects.toThrow(/CR\/LF/);
  });

  it("[P0.1-e] rejects empty-after-normalization header name", async () => {
    const helpers = buildHelpers(
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(
      helpers.http({
        provider: "jira",
        path: "/x",
        // All zero-width / whitespace garbage — normalization strips to "".
        headers: { "​‌‍﻿": "value" },
      }),
    ).rejects.toThrow(/empty after normalization/);
  });
});

describe("buildHostHelpers — http response body cap (P1.3)", () => {
  it("[P1.3] response body > 5 MiB throws HOOK_RESPONSE_TOO_LARGE", async () => {
    // 6 MiB chunked stream — should trip the 5 MiB cap.
    const oversized = new Uint8Array(6 * 1024 * 1024);
    oversized.fill(0x41); // "A"
    const fetchImpl = vi.fn(
      async () =>
        new Response(oversized, {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
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
    await expect(
      helpers.http({ provider: "jira", path: "/big" }),
    ).rejects.toMatchObject({
      errorCode: "HOOK_RESPONSE_TOO_LARGE",
    });
  });
});

describe("buildHostHelpers — fetchHandoff strict regex (P2.1)", () => {
  function helpersFor() {
    return buildHostHelpers(
      {
        assertSafeUrl: noopAssertSafeUrl,
        connectors: fakeConnectors(),
        gitProvider: fakeGitProvider(),
        llm: fakeLlm(),
        fetchImpl: vi.fn(),
      },
      RUNTIME,
    );
  }

  it("[P2.1-a] rejects 7-char short sha (was previously accepted)", async () => {
    const helpers = helpersFor();
    await expect(
      helpers.fetchHandoff({ git_sha: "abc1234", path: "x.md" }),
    ).rejects.toThrow(/hex sha or the run's pinned sha/);
  });

  it("[P2.1-b] rejects uppercase hex (lowercase only)", async () => {
    const helpers = helpersFor();
    const upper = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";
    await expect(
      helpers.fetchHandoff({ git_sha: upper, path: "x.md" }),
    ).rejects.toThrow(/hex sha or the run's pinned sha/);
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
