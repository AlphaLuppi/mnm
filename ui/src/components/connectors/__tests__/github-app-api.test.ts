/**
 * GITHUB-PROVIDER Phase 5 — sanity tests for the API client wrapping
 * (connectorsApi.getGitHubApp — 404 → null contract).
 *
 * The other endpoints (createGitHubApp / sync / delete) are thin wrappers
 * over the shared `api.*` client and don't have branching logic worth
 * mocking the global fetch for. They're covered by Playwright in Phase 6.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("connectorsApi.getGitHubApp — 404 → null", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null when the backend responds with 404 (no App configured)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const { connectorsApi } = await import("../../../api/connectors");
    const result = await connectorsApi.getGitHubApp("c-1", "conn-1");
    expect(result).toBeNull();
  });

  it("returns the parsed body on 200", async () => {
    const payload = {
      appId: "12345",
      appSlug: "mnm-acme",
      createdAt: "2026-05-04T00:00:00Z",
      installations: [],
    };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const { connectorsApi } = await import("../../../api/connectors");
    const result = await connectorsApi.getGitHubApp("c-1", "conn-1");
    expect(result).toEqual(payload);
  });

  it("rethrows on non-404 errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "server error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const { connectorsApi } = await import("../../../api/connectors");
    await expect(
      connectorsApi.getGitHubApp("c-1", "conn-1"),
    ).rejects.toThrow();
  });

  it("URL-encodes the connectorId in the path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { connectorsApi } = await import("../../../api/connectors");
    await connectorsApi.getGitHubApp("c-1", "conn/with slashes");
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs?.[0]).toContain("conn%2Fwith%20slashes");
  });
});
