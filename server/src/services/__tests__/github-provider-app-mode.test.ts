import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubProvider } from "@mnm/git-provider";

// ─── GITHUB-PROVIDER Phase 2 (compléter) ──────────────────────────────────────
//
// Integration smoke test of GitHubProvider in `app-installation` auth mode :
// the `mintToken` closure (provided by the caller — typically pointing at
// `githubAppService.mintInstallationToken`) is the single source of truth for
// the bearer token used on every API call. This test wires a stub closure
// that increments a counter so we can assert :
//
//   1. The Authorization header carries the installation token (NOT the App
//      JWT) — the JWT is internal to mintInstallationToken, never exposed.
//   2. mintToken is called at least once per HTTP call (no provider-level
//      caching of the token; caching is mintToken's responsibility).
//   3. commit operations enforce D7 (author === committer === passed-in
//      identity) regardless of mode — the App[bot] never appears in
//      `committer`.
//
// We DO NOT test the full mintToken implementation here — that's covered
// extensively by `github-app.test.ts` (14 unit tests). This file is the
// "wiring" smoke check between the provider class and the service contract.

const OWNER = "alphaluppi";
const REPO = "mnm";

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GitHubProvider in app-installation mode — integration with mintToken closure", () => {
  it("uses mintToken-returned installation token as Bearer (not the JWT)", async () => {
    const mintToken = vi.fn().mockResolvedValue("ghs_inst_token_xyz");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "abc" }));

    const provider = new GitHubProvider({
      providerId: "github:app:test",
      owner: OWNER,
      repo: REPO,
      auth: { mode: "app-installation", mintToken },
    });

    await provider.resolveRef({ ref: "main" });

    expect(mintToken).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghs_inst_token_xyz");
    // Sanity: never expose anything that looks like a JWT in the header.
    // (jose RS256 JWTs always start with "eyJhbGciOiJSUzI1Ni" base64-encoded;
    // an installation token is "ghs_..." or similar opaque material.)
    expect(headers.Authorization).not.toContain("eyJhbG");
  });

  it("delegates per-call token freshness to mintToken (calls it again on next request)", async () => {
    let callCount = 0;
    const mintToken = vi.fn().mockImplementation(async () => `ghs_inst_${++callCount}`);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "first" }))
      .mockResolvedValueOnce(jsonResponse(200, { sha: "second" }));

    const provider = new GitHubProvider({
      providerId: "github:app:test",
      owner: OWNER,
      repo: REPO,
      auth: { mode: "app-installation", mintToken },
    });

    await provider.resolveRef({ ref: "main" });
    await provider.resolveRef({ ref: "develop" });

    expect(mintToken).toHaveBeenCalledTimes(2);
    // Each call gets the latest closure-returned token.
    const [, init1] = fetchMock.mock.calls[0]!;
    const [, init2] = fetchMock.mock.calls[1]!;
    expect((init1 as RequestInit).headers).toMatchObject({
      Authorization: "Bearer ghs_inst_1",
    });
    expect((init2 as RequestInit).headers).toMatchObject({
      Authorization: "Bearer ghs_inst_2",
    });
  });

  it("D7 — commit body still has author === committer in app-installation mode", async () => {
    const mintToken = vi.fn().mockResolvedValue("ghs_inst_token");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "head-sha" } })) // getRefSha
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } })) // getCommit
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-sha" })) // createBlob
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree-sha" })) // createTree
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit-sha" })) // createCommit
      .mockResolvedValueOnce(jsonResponse(200, {})); // updateRef

    const provider = new GitHubProvider({
      providerId: "github:app:test",
      owner: OWNER,
      repo: REPO,
      auth: { mode: "app-installation", mintToken },
    });

    const result = await provider.commitFile({
      path: "workflow.json",
      content: '{"hello":"world"}',
      message: "feat: add workflow",
      branch: "main",
      authorName: "Tom Andrieu",
      authorEmail: "tom@example.com",
    });

    expect(result.sha).toBe("new-commit-sha");

    // Find the createCommit call (the 5th — index 4) and assert D7.
    const [createCommitUrl, createCommitInit] = fetchMock.mock.calls[4]!;
    expect(String(createCommitUrl)).toContain("/git/commits");
    const body = JSON.parse((createCommitInit as RequestInit).body as string);
    expect(body.author).toEqual({
      name: "Tom Andrieu",
      email: "tom@example.com",
      date: expect.any(String),
    });
    expect(body.committer).toEqual({
      name: "Tom Andrieu",
      email: "tom@example.com",
      date: expect.any(String),
    });
    // Critical D7 invariant: NO bot/App identity smuggled in either field.
    expect(body.committer.email).not.toMatch(/\[bot\]/);
    expect(body.committer.email).not.toMatch(/users\.noreply\.github\.com$/);
    expect(body.author.email).toBe(body.committer.email);
    expect(body.author.name).toBe(body.committer.name);

    // Sanity: the Authorization header on the createCommit call is the
    // installation token, not the JWT.
    const headers = (createCommitInit as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghs_inst_token");
  });

  it("propagates errors from mintToken (e.g. installation suspended) to the caller", async () => {
    const mintToken = vi
      .fn()
      .mockRejectedValue(new Error("GITHUB_APP_INSTALL_SUSPENDED"));

    const provider = new GitHubProvider({
      providerId: "github:app:test",
      owner: OWNER,
      repo: REPO,
      auth: { mode: "app-installation", mintToken },
    });

    await expect(provider.resolveRef({ ref: "main" })).rejects.toThrow(
      "GITHUB_APP_INSTALL_SUSPENDED",
    );
    // No HTTP call should have been made — failure happens at the auth stage.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
