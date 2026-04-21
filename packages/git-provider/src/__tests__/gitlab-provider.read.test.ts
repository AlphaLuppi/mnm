import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitlabProvider } from "../gitlab-provider.js";

const BASE = "https://gitlab.example.com";
const PROJECT = "123";
const TOKEN = "glpat-test";

function makeProvider(overrides: { maxRetries?: number; timeoutMs?: number } = {}) {
  return new GitlabProvider({
    providerId: `gitlab:${PROJECT}`,
    baseUrl: BASE,
    projectId: PROJECT,
    token: TOKEN,
    maxRetries: overrides.maxRetries,
    timeoutMs: overrides.timeoutMs,
  });
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function textResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitlabProvider.fetchBlob", () => {
  it("GETs /repository/files/:path/raw?ref=... with the bot token", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, '{"name":"hello"}'));
    const provider = makeProvider();
    const content = await provider.fetchBlob({ path: "workflow.json", ref: "v1.0.0" });
    expect(content).toBe('{"name":"hello"}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/files/workflow.json/raw?ref=v1.0.0`,
    );
    expect((init as RequestInit).headers).toMatchObject({ "PRIVATE-TOKEN": TOKEN });
  });

  it("URL-encodes slashes in the path", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, "x"));
    const provider = makeProvider();
    await provider.fetchBlob({ path: "gates/greet.gate.ts", ref: "main" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/files/gates%2Fgreet.gate.ts/raw");
  });

  it("throws not_found on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "File Not Found" }));
    const provider = makeProvider();
    await expect(
      provider.fetchBlob({ path: "missing", ref: "main" }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("throws unauthorized on 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "bad token" }));
    const provider = makeProvider();
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });

  it("retries on 5xx up to maxRetries then fails", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(500, "boom"))
      .mockResolvedValueOnce(textResponse(502, "bad gw"))
      .mockResolvedValueOnce(textResponse(503, "unavailable"));
    const provider = makeProvider({ maxRetries: 2, timeoutMs: 1000 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unknown", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries on 429 and succeeds on the retry", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(429, "slow down"))
      .mockResolvedValueOnce(textResponse(200, "ok"));
    const provider = makeProvider({ maxRetries: 2 });
    const content = await provider.fetchBlob({ path: "x", ref: "main" });
    expect(content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns rate_limited when 429 exhausts retries", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(429, "1"))
      .mockResolvedValueOnce(textResponse(429, "2"))
      .mockResolvedValueOnce(textResponse(429, "3"));
    const provider = makeProvider({ maxRetries: 2 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("throws timeout when the request aborts", async () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValue(err);
    const provider = makeProvider({ maxRetries: 0, timeoutMs: 50 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("throws network for other fetch errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const provider = makeProvider({ maxRetries: 0 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "network" });
  });
});

describe("GitlabProvider.resolveRef", () => {
  it("returns the sha from /repository/commits/:ref", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "abc123", short_id: "abc1" }),
    );
    const provider = makeProvider();
    const sha = await provider.resolveRef({ ref: "v1.0.0" });
    expect(sha).toBe("abc123");
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/commits/v1.0.0`,
    );
  });

  it("throws not_found on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "404" }));
    const provider = makeProvider();
    await expect(provider.resolveRef({ ref: "nope" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("GitlabProvider.listTags", () => {
  it("GETs /repository/tags with search=<prefix> when provided", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { name: "v1.0.0", commit: { id: "aaa" } },
        { name: "v1.1.0", commit: { id: "bbb" } },
      ]),
    );
    const provider = makeProvider();
    const tags = await provider.listTags({ prefix: "v1." });
    expect(tags).toEqual([
      { name: "v1.0.0", sha: "aaa" },
      { name: "v1.1.0", sha: "bbb" },
    ]);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/tags?search=%5Ev1.`,
    );
  });

  it("GETs without search when no prefix", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    const provider = makeProvider();
    await provider.listTags();
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/api/v4/projects/${PROJECT}/repository/tags`,
    );
  });
});

describe("GitlabProvider.pathExists", () => {
  it("HEAD /repository/files/:path?ref=... returns true on 200", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const provider = makeProvider();
    expect(await provider.pathExists({ path: "workflow.json", ref: "main" })).toBe(true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("HEAD");
  });

  it("returns false on 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const provider = makeProvider();
    expect(await provider.pathExists({ path: "x", ref: "main" })).toBe(false);
  });

  it("propagates unauthorized on 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const provider = makeProvider();
    await expect(
      provider.pathExists({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});
