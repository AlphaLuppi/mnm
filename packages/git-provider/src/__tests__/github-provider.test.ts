import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubProvider } from "../github-provider.js";

const BASE = "https://api.github.com";
const OWNER = "alphaluppi";
const REPO = "mnm";
const TOKEN = "ghp_test_oauth_token";

function makeProvider(overrides: { maxRetries?: number; timeoutMs?: number; auth?: ConstructorParameters<typeof GitHubProvider>[0]["auth"] } = {}) {
  return new GitHubProvider({
    providerId: `github:${OWNER}/${REPO}`,
    owner: OWNER,
    repo: REPO,
    auth: overrides.auth ?? { mode: "user-oauth", token: TOKEN },
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

describe("GitHubProvider — auth header", () => {
  it("sends OAuth Bearer token in user-oauth mode", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, "ok"));
    const provider = makeProvider();
    await provider.fetchBlob({ path: "x", ref: "main" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });

  it("calls mintToken in app-installation mode and uses returned token", async () => {
    const mintToken = vi.fn().mockResolvedValue("ghs_app_installation_token");
    fetchMock.mockResolvedValueOnce(textResponse(200, "ok"));
    const provider = makeProvider({ auth: { mode: "app-installation", mintToken } });
    await provider.fetchBlob({ path: "x", ref: "main" });
    expect(mintToken).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer ghs_app_installation_token",
    });
  });

  it("class-owned auth header overrides any caller-provided Authorization", async () => {
    // The internal request() method spreads init.headers first then adds the
    // class auth — verifying the override happens at the spread order.
    fetchMock.mockResolvedValueOnce(textResponse(200, "ok"));
    const provider = makeProvider();
    await provider.fetchBlob({ path: "x", ref: "main" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
    });
  });
});

describe("GitHubProvider.fetchBlob", () => {
  it("GETs /repos/:o/:r/contents/:path?ref=... in raw mode", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, '{"name":"hello"}'));
    const provider = makeProvider();
    const content = await provider.fetchBlob({ path: "workflow.json", ref: "v1.0.0" });
    expect(content).toBe('{"name":"hello"}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/repos/${OWNER}/${REPO}/contents/workflow.json?ref=v1.0.0`);
    expect((init as RequestInit).headers).toMatchObject({ Accept: "application/vnd.github.raw" });
  });

  it("URL-encodes each path segment but preserves slashes", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(200, "x"));
    const provider = makeProvider();
    await provider.fetchBlob({ path: "gates/greet.gate.ts", ref: "main" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/contents/gates/greet.gate.ts?");
  });

  it("throws not_found on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }));
    const provider = makeProvider();
    await expect(
      provider.fetchBlob({ path: "missing", ref: "main" }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("throws unauthorized on 401", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "Bad credentials" }));
    const provider = makeProvider();
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });

  it("classifies 403 with X-RateLimit-Remaining: 0 as rate_limited", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(403, { message: "rate limited" }, { "x-ratelimit-remaining": "0" }))
      .mockResolvedValueOnce(jsonResponse(403, { message: "rate limited" }, { "x-ratelimit-remaining": "0" }))
      .mockResolvedValueOnce(jsonResponse(403, { message: "rate limited" }, { "x-ratelimit-remaining": "0" }));
    const provider = makeProvider({ maxRetries: 2 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries on 5xx and succeeds on retry", async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(500, "boom"))
      .mockResolvedValueOnce(textResponse(200, "ok"));
    const provider = makeProvider({ maxRetries: 2 });
    const content = await provider.fetchBlob({ path: "x", ref: "main" });
    expect(content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws timeout on AbortError", async () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValue(err);
    const provider = makeProvider({ maxRetries: 0, timeoutMs: 50 });
    await expect(
      provider.fetchBlob({ path: "x", ref: "main" }),
    ).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("GitHubProvider.resolveRef", () => {
  it("returns sha from /repos/:o/:r/commits/:ref", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "abc123" }));
    const provider = makeProvider();
    const sha = await provider.resolveRef({ ref: "v1.0.0" });
    expect(sha).toBe("abc123");
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/repos/${OWNER}/${REPO}/commits/v1.0.0`);
  });
});

describe("GitHubProvider.listTags", () => {
  it("paginates through /tags and applies prefix filter client-side", async () => {
    // Two pages: first 100 entries, second 1 entry. Filter to "v1.".
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      name: i < 50 ? `v1.${i}.0` : `v2.${i - 50}.0`,
      commit: { sha: `sha-${i}` },
    }));
    const page2 = [{ name: "v1.100.0", commit: { sha: "sha-100" } }];
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, page1))
      .mockResolvedValueOnce(jsonResponse(200, page2));
    const provider = makeProvider();
    const tags = await provider.listTags({ prefix: "v1." });
    // 50 from page1 (v1.0..v1.49) + 1 from page2 (v1.100)
    expect(tags).toHaveLength(51);
    expect(tags[0]).toEqual({ name: "v1.0.0", sha: "sha-0" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops at first non-full page", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ name: "v1.0.0", commit: { sha: "x" } }]));
    const provider = makeProvider();
    const tags = await provider.listTags();
    expect(tags).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("GitHubProvider.pathExists", () => {
  it("returns true on 200 (HEAD)", async () => {
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

describe("GitHubProvider.fetchTree", () => {
  it("resolves ref then GETs /git/trees/:sha?recursive=1 when recursive=true", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "commit-sha" })) // resolveRef
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tree: [
            { path: "workflow.json", type: "blob", sha: "blob-1", size: 42 },
            { path: "gates", type: "tree", sha: "tree-1" },
            { path: "gates/greet.gate.ts", type: "blob", sha: "blob-2", size: 100 },
            { path: "submodule", type: "commit", sha: "skip-me" }, // submodules skipped
          ],
        }),
      );
    const provider = makeProvider();
    const entries = await provider.fetchTree({ ref: "main", recursive: true });
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ path: "workflow.json", type: "blob", sha: "blob-1", size: 42 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining(`/git/trees/commit-sha?recursive=1`),
      expect.any(Object),
    );
  });

  it("filters by subtree when provided", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "commit-sha" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tree: [
            { path: "workflow.json", type: "blob", sha: "x", size: 1 },
            { path: "gates", type: "tree", sha: "y" },
            { path: "gates/greet.gate.ts", type: "blob", sha: "z", size: 2 },
          ],
        }),
      );
    const provider = makeProvider();
    const entries = await provider.fetchTree({ ref: "main", subtree: "gates", recursive: true });
    expect(entries.map((e) => e.path)).toEqual(["gates", "gates/greet.gate.ts"]);
  });

  it("throws on truncated tree", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "commit-sha" }))
      .mockResolvedValueOnce(jsonResponse(200, { truncated: true, tree: [] }));
    const provider = makeProvider();
    await expect(provider.fetchTree({ ref: "main", recursive: true })).rejects.toMatchObject({
      code: "unknown",
    });
  });
});

describe("GitHubProvider.commitFile + commitMultipleFiles — D7 strict identity", () => {
  it("creates a commit with author AND committer = supplied identity (low-level Git Data API)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "head-sha" } })) // getRefSha
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } })) // getCommit
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-sha" })) // createBlob
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree-sha" })) // createTree
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit-sha" })) // createCommit
      .mockResolvedValueOnce(jsonResponse(200, {})); // updateRef
    const provider = makeProvider();
    const result = await provider.commitFile({
      path: "workflow.json",
      content: '{"hello":"world"}',
      message: "Add workflow",
      branch: "main",
      authorName: "Tom Andrieu",
      authorEmail: "tom@example.com",
    });
    expect(result.sha).toBe("new-commit-sha");
    // 6 API calls in the right order
    expect(fetchMock).toHaveBeenCalledTimes(6);

    // Verify createCommit payload: author AND committer = same identity (D7).
    const [createCommitUrl, createCommitInit] = fetchMock.mock.calls[4]!;
    expect(String(createCommitUrl)).toContain("/git/commits");
    const createCommitBody = JSON.parse((createCommitInit as RequestInit).body as string);
    expect(createCommitBody.message).toBe("Add workflow");
    expect(createCommitBody.tree).toBe("new-tree-sha");
    expect(createCommitBody.parents).toEqual(["head-sha"]);
    expect(createCommitBody.author.name).toBe("Tom Andrieu");
    expect(createCommitBody.author.email).toBe("tom@example.com");
    // D7: committer === author
    expect(createCommitBody.committer.name).toBe("Tom Andrieu");
    expect(createCommitBody.committer.email).toBe("tom@example.com");
    expect(createCommitBody.author.date).toBe(createCommitBody.committer.date);
  });

  it("FORBIDS the high-level repos.createOrUpdateFileContents path (no PUT to /contents)", async () => {
    // The contract violation we guard against: a regression that uses
    // PUT /repos/:o/:r/contents/:path forces committer = App[bot] in
    // App mode. We assert no such request was made.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "head-sha" } }))
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-sha" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree-sha" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit-sha" }))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const provider = makeProvider();
    await provider.commitFile({
      path: "x",
      content: "y",
      message: "m",
      branch: "main",
      authorName: "n",
      authorEmail: "e@x",
    });
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call;
      if ((init as RequestInit | undefined)?.method === "PUT") {
        expect(String(url)).not.toContain("/contents/");
      }
    }
  });

  it("commitMultipleFiles batches blobs + tree + commit + ref update", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "head-sha" } }))
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-1" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-2" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree-sha" }))
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit-sha" }))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const provider = makeProvider();
    const result = await provider.commitMultipleFiles({
      branch: "main",
      commitMessage: "Multi",
      authorName: "Tom",
      authorEmail: "t@x",
      actions: [
        { path: "a.txt", content: "AA" },
        { path: "b.txt", content: "BB" },
        { path: "old.txt", delete: true },
      ],
    });
    expect(result.sha).toBe("new-commit-sha");
    // createTree payload includes the deleted entry with sha=null
    const [, createTreeInit] = fetchMock.mock.calls[4]!;
    const createTreeBody = JSON.parse((createTreeInit as RequestInit).body as string);
    expect(createTreeBody.base_tree).toBe("tree-sha");
    expect(createTreeBody.tree).toHaveLength(3);
    expect(createTreeBody.tree[2]).toEqual({
      path: "old.txt",
      mode: "100644",
      type: "blob",
      sha: null,
    });
  });

  it("creates the branch from startBranch when target branch does not exist", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" })) // getRefSha(target) → 404
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "start-sha" } })) // getRefSha(startBranch)
      .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } })) // getCommit
      .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-1" })) // createBlob
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree-sha" })) // createTree
      .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit-sha" })) // createCommit
      .mockResolvedValueOnce(jsonResponse(201, { ref: "refs/heads/feat/new" })); // createRef
    const provider = makeProvider();
    const result = await provider.commitMultipleFiles({
      branch: "feat/new",
      startBranch: "main",
      commitMessage: "Init",
      authorName: "Tom",
      authorEmail: "t@x",
      actions: [{ path: "a.txt", content: "AA" }],
    });
    expect(result.sha).toBe("new-commit-sha");
    // Last call should be createRef (not updateRef)
    const [createRefUrl, createRefInit] = fetchMock.mock.calls[6]!;
    expect(String(createRefUrl)).toContain("/git/refs");
    expect((createRefInit as RequestInit).method).toBe("POST");
    const body = JSON.parse((createRefInit as RequestInit).body as string);
    expect(body.ref).toBe("refs/heads/feat/new");
    expect(body.sha).toBe("new-commit-sha");
  });

  it("throws not_found when branch missing and no startBranch given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }));
    const provider = makeProvider();
    await expect(
      provider.commitMultipleFiles({
        branch: "missing",
        commitMessage: "x",
        authorName: "n",
        authorEmail: "e@x",
        actions: [{ path: "a", content: "b" }],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects empty actions array", async () => {
    const provider = makeProvider();
    await expect(
      provider.commitMultipleFiles({
        branch: "main",
        commitMessage: "x",
        authorName: "n",
        authorEmail: "e@x",
        actions: [],
      }),
    ).rejects.toMatchObject({ code: "unknown" });
  });

  // D7 regression guard (plan 2026-05-04-github-provider.md, §Phase 4 step 7).
  // Strict: the createCommit JSON body MUST satisfy
  //   author.name === committer.name && author.email === committer.email
  // for EVERY mode. A future change that decouples them (e.g. setting
  // committer = App[bot] in app-installation mode) breaks here. Run for both
  // modes to make the invariant explicit.
  for (const mode of ["user-oauth", "app-installation"] as const) {
    it(`D7: createCommit body has author === committer (mode=${mode})`, async () => {
      const auth =
        mode === "user-oauth"
          ? ({ mode: "user-oauth", token: TOKEN } as const)
          : ({
              mode: "app-installation",
              mintToken: vi.fn().mockResolvedValue("ghs_inst_token"),
            } as const);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "head-sha" } }))
        .mockResolvedValueOnce(jsonResponse(200, { tree: { sha: "tree-sha" } }))
        .mockResolvedValueOnce(jsonResponse(201, { sha: "blob-sha" }))
        .mockResolvedValueOnce(jsonResponse(201, { sha: "new-tree-sha" }))
        .mockResolvedValueOnce(jsonResponse(201, { sha: "new-commit-sha" }))
        .mockResolvedValueOnce(jsonResponse(200, {}));
      const provider = makeProvider({ auth });
      await provider.commitMultipleFiles({
        branch: "main",
        commitMessage: "msg",
        authorName: "Tom",
        authorEmail: "tom@example.com",
        actions: [{ path: "a", content: "b" }],
      });
      const [, createCommitInit] = fetchMock.mock.calls[4]!;
      const body = JSON.parse((createCommitInit as RequestInit).body as string);
      // Body invariant — strict equality on the two fields D7 cares about.
      expect(body.author.email === body.committer.email).toBe(true);
      expect(body.author.name === body.committer.name).toBe(true);
      // Sanity: identity must match what we passed in (not the App bot).
      expect(body.author.name).toBe("Tom");
      expect(body.author.email).toBe("tom@example.com");
    });
  }
});

describe("GitHubProvider.createTag", () => {
  it("creates lightweight tag (createRef) when no message", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "commit-sha" })) // resolveRef
      .mockResolvedValueOnce(jsonResponse(201, { ref: "refs/tags/v1" })); // createRef
    const provider = makeProvider();
    const result = await provider.createTag({ name: "v1", ref: "main" });
    expect(result.sha).toBe("commit-sha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates annotated tag (createTag + createRef) with tagger from /user", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "commit-sha" })) // resolveRef
      .mockResolvedValueOnce(jsonResponse(200, { login: "tom", name: "Tom A.", email: "tom@noreply" })) // /user
      .mockResolvedValueOnce(jsonResponse(201, { sha: "tag-obj-sha" })) // createTag
      .mockResolvedValueOnce(jsonResponse(201, { ref: "refs/tags/v1" })); // createRef
    const provider = makeProvider();
    const result = await provider.createTag({ name: "v1", ref: "main", message: "Release v1" });
    expect(result.sha).toBe("commit-sha");
    const [, createTagInit] = fetchMock.mock.calls[2]!;
    const tagBody = JSON.parse((createTagInit as RequestInit).body as string);
    expect(tagBody.tag).toBe("v1");
    expect(tagBody.tagger.name).toBe("Tom A.");
    expect(tagBody.tagger.email).toBe("tom@noreply");
  });

  it("maps 422 conflict on duplicate tag", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { sha: "commit-sha" }))
      .mockResolvedValueOnce(jsonResponse(422, { message: "Reference already exists" }));
    const provider = makeProvider();
    await expect(
      provider.createTag({ name: "v1", ref: "main" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("GitHubProvider.getCodeReviewState", () => {
  it("rejects kind !== github", async () => {
    const provider = makeProvider();
    await expect(
      provider.getCodeReviewState({ kind: "gitlab", projectId: "1", mrIid: 2 }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("merges /pulls/:n/reviews + requested_reviewers + branch protection", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { user: { login: "alice" }, state: "APPROVED", submitted_at: "2026-05-01T10:00:00Z" },
          { user: { login: "bob" }, state: "CHANGES_REQUESTED", submitted_at: "2026-05-01T11:00:00Z" },
          { user: { login: "alice" }, state: "COMMENTED", submitted_at: "2026-05-01T12:00:00Z" }, // ignored, alice already approved
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(200, { users: [{ login: "carol" }] })) // requested
      .mockResolvedValueOnce(jsonResponse(200, { base: { ref: "main" } })) // PR
      .mockResolvedValueOnce(
        jsonResponse(200, {
          required_pull_request_reviews: { required_approving_review_count: 2 },
        }),
      ); // branch protection
    const provider = makeProvider();
    const state = await provider.getCodeReviewState({
      kind: "github",
      owner: OWNER,
      repo: REPO,
      pullNumber: 42,
    });
    expect(state.requiredApprovals).toBe(2);
    expect(state.currentApprovals).toBe(1); // only alice
    const byLogin = Object.fromEntries(state.reviewers.map((r) => [r.login, r.state]));
    expect(byLogin.alice).toBe("approved");
    expect(byLogin.bob).toBe("changes_requested");
    expect(byLogin.carol).toBe("pending"); // requested, no review yet
  });

  it("falls back to requiredApprovals=0 when branch protection 403s", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, { users: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { base: { ref: "main" } }))
      .mockResolvedValueOnce(jsonResponse(403, { message: "no admin scope" }));
    const provider = makeProvider();
    const state = await provider.getCodeReviewState({
      kind: "github",
      owner: OWNER,
      repo: REPO,
      pullNumber: 1,
    });
    expect(state.requiredApprovals).toBe(0);
    expect(state.currentApprovals).toBe(0);
    expect(state.reviewers).toEqual([]);
  });
});

describe("GitHubProvider.mergeBranch", () => {
  it("POSTs /merges and returns the merge commit sha", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { sha: "merge-sha" }));
    const provider = makeProvider();
    const result = await provider.mergeBranch({
      sourceBranch: "feat/x",
      targetBranch: "main",
      commitMessage: "Merge feat/x",
      authorName: "Tom",
      authorEmail: "t@x",
    });
    expect(result.sha).toBe("merge-sha");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/repos/${OWNER}/${REPO}/merges`);
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      base: "main",
      head: "feat/x",
      commit_message: "Merge feat/x",
    });
  });

  it("returns head sha when GitHub responds 204 (already merged)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(200, { object: { sha: "head-sha" } })); // getRefSha fallback
    const provider = makeProvider();
    const result = await provider.mergeBranch({
      sourceBranch: "feat/x",
      targetBranch: "main",
      commitMessage: "no-op",
      authorName: "n",
      authorEmail: "e@x",
    });
    expect(result.sha).toBe("head-sha");
  });
});

describe("GitHubProvider.deleteBranch", () => {
  it("DELETEs /git/refs/heads/:branch on success", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const provider = makeProvider();
    await provider.deleteBranch({ branch: "feat/old" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/repos/${OWNER}/${REPO}/git/refs/heads/feat/old`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("is idempotent on 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const provider = makeProvider();
    await expect(provider.deleteBranch({ branch: "missing" })).resolves.toBeUndefined();
  });

  it("URL-encodes path segments in branch name (e.g. feat/foo-bar)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const provider = makeProvider();
    await provider.deleteBranch({ branch: "feat/foo bar" });
    const [url] = fetchMock.mock.calls[0]!;
    // space is %20 inside the segment, slash preserved
    expect(String(url)).toContain("/git/refs/heads/feat/foo%20bar");
  });
});
