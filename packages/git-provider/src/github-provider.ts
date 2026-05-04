import { GitProviderError, type GitProviderErrorCode } from "./errors.js";
import type {
  GitProvider,
  FetchBlobArgs,
  ListTagsArgs,
  Tag,
  ResolveRefArgs,
  PathExistsArgs,
  CommitFileArgs,
  CommitFileResult,
  CreateTagArgs,
  CreateTagResult,
  FetchTreeArgs,
  TreeEntry,
  CommitMultipleFilesArgs,
  CommitMultipleFilesResult,
  CodeReviewReference,
  CodeReviewState,
  CodeReviewer,
  CodeReviewerState,
  MergeBranchArgs,
  MergeBranchResult,
  DeleteBranchArgs,
} from "./types.js";

/**
 * Authentication strategy for `GitHubProvider`.
 *
 * - `user-oauth` — bearer token bound to a human GitHub user (OAuth App
 *   access_token). The token's owner becomes the natural committer; we
 *   still inject `author` AND `committer` explicitly in commit payloads
 *   for D7 conformance (always = the MnM user identity passed in
 *   `authorName`/`authorEmail`, regardless of token owner).
 *
 * - `app-installation` — short-lived (1h) installation token minted from a
 *   GitHub App's private key + installation_id. The closure `mintToken()`
 *   is responsible for caching + refresh; this class calls it lazily on
 *   each request and the closure may return a cached value or freshly
 *   mint as needed. In this mode, `repos.createOrUpdateFileContents` is
 *   FORBIDDEN (it forces committer = App[bot]); we exclusively use the
 *   low-level Git Data API so that `committer` can be the MnM user.
 */
export type GitHubProviderAuth =
  | { mode: "user-oauth"; token: string }
  | { mode: "app-installation"; mintToken: () => Promise<string> };

export interface GitHubProviderOptions {
  /** Stable id used for cache keys and error messages (e.g. `github:alphaluppi/mnm`). */
  providerId: string;
  /** Repo owner login (user or org). */
  owner: string;
  /** Repo name. */
  repo: string;
  /** Auth strategy — `user-oauth` or `app-installation`. */
  auth: GitHubProviderAuth;
  /** API root, defaults to `https://api.github.com`. No trailing slash required. */
  baseUrl?: string;
  /** Per-request timeout, default 10s. */
  timeoutMs?: number;
  /** Max retries on 5xx/429/403-rate-limited, default 2 (so 3 attempts total). */
  maxRetries?: number;
}

const DEFAULT_BASE_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_MS = [250, 750, 2250];
const GITHUB_API_VERSION = "2022-11-28";

/**
 * GitHub implementation of the `GitProvider` contract. Targets github.com
 * (D2 — no GitHub Enterprise Server in V0; if added later, configurable
 * via `baseUrl`).
 *
 * **D7 strict commit identity** : all write operations
 * (`commitFile`, `commitMultipleFiles`, `createTag` annotated) use the
 * low-level Git Data API (`git.createBlob` + `git.createTree` +
 * `git.createCommit` + `git.updateRef`) rather than `repos.createOrUpdateFileContents`,
 * so that `author` AND `committer` can both be set to the MnM user
 * identity — even when authenticating with a GitHub App installation
 * token. Side-effect: commits are marked "Unverified" in GitHub UI
 * (badge gris) since they are not GPG-signed. GPG signing is an open
 * follow-up (cf plan §Open follow-ups).
 */
export class GitHubProvider implements GitProvider {
  readonly providerId: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly auth: GitHubProviderAuth;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: GitHubProviderOptions) {
    this.providerId = options.providerId;
    this.owner = options.owner;
    this.repo = options.repo;
    this.auth = options.auth;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private repoPath(): string {
    return `${this.baseUrl}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
  }

  /**
   * Fetch a file's raw content. Uses the Contents API in raw mode
   * (Accept: application/vnd.github.raw). Limited to files <= 1 MB by
   * GitHub; larger blobs require resolving via the tree API + getBlob,
   * out of scope V0.
   */
  async fetchBlob(args: FetchBlobArgs): Promise<string> {
    const url = `${this.repoPath()}/contents/${encodePath(args.path)}?ref=${encodeURIComponent(args.ref)}`;
    const res = await this.request(
      url,
      { method: "GET", headers: { Accept: "application/vnd.github.raw" } },
      "fetchBlob",
    );
    return res.text();
  }

  async resolveRef(args: ResolveRefArgs): Promise<string> {
    const url = `${this.repoPath()}/commits/${encodeURIComponent(args.ref)}`;
    const res = await this.request(url, { method: "GET" }, "resolveRef");
    const body = (await res.json()) as { sha?: string };
    if (!body.sha) {
      throw new GitProviderError(
        "unknown",
        `GitHub resolveRef returned no commit sha for ref=${args.ref}`,
      );
    }
    return body.sha;
  }

  async listTags(args?: ListTagsArgs): Promise<Tag[]> {
    // GitHub's /repos/:o/:r/tags doesn't accept a search filter — paginate
    // and filter client-side. 100 tags per page is the max.
    const tags: Tag[] = [];
    let page = 1;
    // Hard cap to avoid infinite loop if a repo had thousands of tags;
    // governed-workflows tagging convention `<workflow>/v<n>` keeps this
    // small in practice.
    const MAX_PAGES = 50;
    while (page <= MAX_PAGES) {
      const url = `${this.repoPath()}/tags?per_page=100&page=${page}`;
      const res = await this.request(url, { method: "GET" }, "listTags");
      const body = (await res.json()) as Array<{
        name: string;
        commit: { sha: string };
      }>;
      for (const t of body) {
        if (args?.prefix === undefined || t.name.startsWith(args.prefix)) {
          tags.push({ name: t.name, sha: t.commit.sha });
        }
      }
      if (body.length < 100) break;
      page += 1;
    }
    return tags;
  }

  async pathExists(args: PathExistsArgs): Promise<boolean> {
    const url = `${this.repoPath()}/contents/${encodePath(args.path)}?ref=${encodeURIComponent(args.ref)}`;
    try {
      await this.request(url, { method: "HEAD" }, "pathExists");
      return true;
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") return false;
      throw err;
    }
  }

  async fetchTree(args: FetchTreeArgs): Promise<TreeEntry[]> {
    // GitHub returns the tree from the *commit* the ref resolves to; we
    // resolve the ref to a sha first (handles branches and tags
    // transparently). The GET /git/trees/:tree_sha endpoint accepts a
    // commit sha when the commit's tree is requested via the ?recursive
    // query.
    const commitSha = await this.resolveRef({ ref: args.ref });
    const recursive = args.recursive ? "?recursive=1" : "";
    const url = `${this.repoPath()}/git/trees/${encodeURIComponent(commitSha)}${recursive}`;
    const res = await this.request(url, { method: "GET" }, "fetchTree");
    const body = (await res.json()) as {
      truncated?: boolean;
      tree?: Array<{
        path: string;
        type: "blob" | "tree" | "commit";
        sha: string;
        size?: number;
      }>;
    };
    if (body.truncated) {
      // GitHub truncates trees > 100k entries or > 7 MB. For governed
      // workflow repos this is essentially never; surface a clear error
      // instead of silently returning a partial tree.
      throw new GitProviderError(
        "unknown",
        `GitHub fetchTree truncated for ref=${args.ref} (>100k entries or >7MB)`,
      );
    }
    const entries: TreeEntry[] = [];
    const subtree = args.subtree?.replace(/^\/+|\/+$/g, "");
    for (const raw of body.tree ?? []) {
      // GitHub's "commit" type entries are submodules — skip (the contract
      // only supports blob/tree).
      if (raw.type !== "blob" && raw.type !== "tree") continue;
      if (subtree !== undefined && subtree !== "") {
        if (!raw.path.startsWith(`${subtree}/`) && raw.path !== subtree) continue;
      }
      entries.push({
        path: raw.path,
        type: raw.type,
        sha: raw.sha,
        size: raw.size ?? null,
      });
    }
    return entries;
  }

  /**
   * Atomic single-file commit via low-level Git Data API (D7 strict).
   * Delegates to `commitMultipleFiles` with one action — single source of
   * truth for the createBlob+createTree+createCommit+updateRef dance.
   */
  async commitFile(args: CommitFileArgs): Promise<CommitFileResult> {
    const result = await this.commitMultipleFiles({
      branch: args.branch,
      commitMessage: args.message,
      authorName: args.authorName,
      authorEmail: args.authorEmail,
      actions: [{ path: args.path, content: args.content }],
    });
    return { sha: result.sha };
  }

  /**
   * Atomic multi-file commit via low-level Git Data API (D7 strict).
   *
   * Flow:
   * 1. Resolve `branch` (or `startBranch`) to its head commit sha.
   * 2. Get the head commit's tree sha.
   * 3. Create blobs for each non-delete action.
   * 4. Build a new tree based on the parent tree + tree entries (additions/updates set sha; deletes set sha=null).
   * 5. Create the commit object with `author` AND `committer` = the supplied identity (D7).
   * 6. Update the branch ref to point at the new commit.
   *
   * If `branch` does not exist and `startBranch` is provided, the branch
   * is created from `startBranch`'s tip via `createRef`.
   */
  async commitMultipleFiles(
    args: CommitMultipleFilesArgs,
  ): Promise<CommitMultipleFilesResult> {
    if (args.actions.length === 0) {
      throw new GitProviderError(
        "unknown",
        "GitHub commitMultipleFiles: actions array is empty",
      );
    }

    // Step 1+2: resolve parent commit + tree.
    let parentSha: string | null = null;
    let createBranch = false;
    try {
      parentSha = await this.getRefSha(args.branch);
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") {
        if (args.startBranch === undefined) {
          throw new GitProviderError(
            "not_found",
            `GitHub commitMultipleFiles: branch "${args.branch}" not found and no startBranch given`,
            { cause: err },
          );
        }
        parentSha = await this.getRefSha(args.startBranch);
        createBranch = true;
      } else {
        throw err;
      }
    }
    const parentCommit = await this.getCommit(parentSha!);
    const parentTreeSha = parentCommit.tree.sha;

    // Step 3: create blobs for each non-delete action.
    const treeEntries: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string | null;
    }> = [];
    for (const a of args.actions) {
      if (a.delete === true) {
        treeEntries.push({ path: a.path, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const blobSha = await this.createBlob(a.content ?? "");
      treeEntries.push({
        path: a.path,
        mode: "100644",
        type: "blob",
        sha: blobSha,
      });
    }

    // Step 4: create tree.
    const newTreeSha = await this.createTree(parentTreeSha, treeEntries);

    // Step 5: create commit with explicit author + committer (D7).
    const isoNow = new Date().toISOString();
    const identity = {
      name: args.authorName,
      email: args.authorEmail,
      date: isoNow,
    };
    const commitSha = await this.createCommit({
      message: args.commitMessage,
      tree: newTreeSha,
      parents: [parentSha!],
      author: identity,
      committer: identity,
    });

    // Step 6: update the branch ref (or create it).
    if (createBranch) {
      await this.createRef(`refs/heads/${args.branch}`, commitSha);
    } else {
      await this.updateRef(`refs/heads/${args.branch}`, commitSha, false);
    }

    return { sha: commitSha };
  }

  /**
   * Create a tag. With `args.message`, an annotated tag whose `tagger` is
   * the supplied identity (`taggerName` + `taggerEmail`) when both are
   * provided, otherwise the token-owning user resolved via `/user`. Without
   * `args.message`, a lightweight tag pointing directly at the resolved
   * commit sha.
   *
   * D7 note: in `app-installation` mode the `/user` endpoint returns the
   * App[bot] identity, which violates D7 (tag must be attributed to the MnM
   * user). Callers in App mode MUST pass `taggerName` + `taggerEmail` to
   * preserve human attribution. In `user-oauth` mode, omitting the fields
   * is fine — `/user` returns the human user.
   */
  async createTag(args: CreateTagArgs): Promise<CreateTagResult> {
    const commitSha = await this.resolveRef({ ref: args.ref });

    if (args.message === undefined || args.message === "") {
      // Lightweight tag — single createRef.
      try {
        await this.createRef(`refs/tags/${args.name}`, commitSha);
      } catch (err) {
        if (err instanceof GitProviderError && err.code === "conflict") {
          throw new GitProviderError(
            "conflict",
            `GitHub createTag conflict (${args.name}@${args.ref}): tag already exists`,
            { cause: err },
          );
        }
        throw err;
      }
      return { sha: commitSha };
    }

    // Annotated tag — createTag + createRef.
    // D7 — if the caller supplied an explicit identity (typical in
    // app-installation mode), use it; otherwise fall back to /user (the
    // legacy behavior, correct in user-oauth mode).
    const tagger =
      args.taggerName !== undefined && args.taggerEmail !== undefined
        ? { name: args.taggerName, email: args.taggerEmail }
        : await this.fetchTokenUserIdentity();
    const tagObjectUrl = `${this.repoPath()}/git/tags`;
    const tagObjectRes = await this.request(
      tagObjectUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag: args.name,
          message: args.message,
          object: commitSha,
          type: "commit",
          tagger: { ...tagger, date: new Date().toISOString() },
        }),
      },
      "createTag.tagObject",
    );
    const tagObjectBody = (await tagObjectRes.json()) as { sha?: string };
    if (!tagObjectBody.sha) {
      throw new GitProviderError(
        "unknown",
        `GitHub createTag: tag object returned no sha for tag=${args.name}`,
      );
    }
    try {
      await this.createRef(`refs/tags/${args.name}`, tagObjectBody.sha);
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "conflict") {
        throw new GitProviderError(
          "conflict",
          `GitHub createTag conflict (${args.name}@${args.ref}): tag ref already exists`,
          { cause: err },
        );
      }
      throw err;
    }
    return { sha: commitSha };
  }

  async getCodeReviewState(args: CodeReviewReference): Promise<CodeReviewState> {
    if (args.kind !== "github") {
      throw new GitProviderError(
        "unauthorized",
        `GitHubProvider.getCodeReviewState rejects kind="${args.kind}" — use a GitlabProvider for GitLab MRs`,
      );
    }
    const reviewsUrl = `${this.baseUrl}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/pulls/${args.pullNumber}/reviews?per_page=100`;
    const reviewsRes = await this.request(reviewsUrl, { method: "GET" }, "getCodeReviewState.listReviews");
    const reviews = (await reviewsRes.json()) as Array<{
      user?: { login?: string };
      state: string;
      submitted_at?: string;
    }>;

    // Fetch requested reviewers (those who haven't submitted yet).
    const requestedUrl = `${this.baseUrl}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/pulls/${args.pullNumber}/requested_reviewers`;
    const requestedRes = await this.request(requestedUrl, { method: "GET" }, "getCodeReviewState.requestedReviewers");
    const requested = (await requestedRes.json()) as {
      users?: Array<{ login?: string }>;
    };

    // Best-effort branch protection — needs admin scope, often 403 for
    // non-admin tokens. On any non-200, requiredApprovals defaults to 0.
    let requiredApprovals = 0;
    let branchProtection: unknown = null;
    try {
      const prUrl = `${this.baseUrl}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/pulls/${args.pullNumber}`;
      const prRes = await this.request(prUrl, { method: "GET" }, "getCodeReviewState.getPR");
      const pr = (await prRes.json()) as { base?: { ref?: string } };
      if (pr.base?.ref) {
        const protUrl = `${this.baseUrl}/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repo)}/branches/${encodeURIComponent(pr.base.ref)}/protection`;
        const protRes = await this.request(protUrl, { method: "GET" }, "getCodeReviewState.branchProtection");
        const prot = (await protRes.json()) as {
          required_pull_request_reviews?: { required_approving_review_count?: number };
        };
        requiredApprovals = prot.required_pull_request_reviews?.required_approving_review_count ?? 0;
        branchProtection = prot;
      }
    } catch {
      // Expected for non-admin tokens or branches without protection.
    }

    // Reduce reviews to latest state per reviewer (GitHub sends a row per
    // submission; the most recent non-COMMENTED state per user wins).
    const latestByLogin = new Map<string, { state: CodeReviewerState; submittedAt?: string }>();
    for (const r of reviews) {
      const login = r.user?.login;
      if (!login) continue;
      const state = mapReviewState(r.state);
      // COMMENTED never replaces a stronger prior state, but is recorded
      // if no prior state exists.
      const prior = latestByLogin.get(login);
      if (state === "commented" && prior !== undefined) continue;
      latestByLogin.set(login, { state, submittedAt: r.submitted_at });
    }
    const reviewers: CodeReviewer[] = [];
    for (const [login, v] of latestByLogin) {
      reviewers.push({ login, state: v.state, ...(v.submittedAt ? { submittedAt: v.submittedAt } : {}) });
    }
    for (const u of requested.users ?? []) {
      if (!u.login || latestByLogin.has(u.login)) continue;
      reviewers.push({ login: u.login, state: "pending" });
    }

    const currentApprovals = reviewers.filter((r) => r.state === "approved").length;

    return {
      requiredApprovals,
      currentApprovals,
      reviewers,
      raw: { reviews, requestedReviewers: requested, branchProtection },
    };
  }

  async mergeBranch(args: MergeBranchArgs): Promise<MergeBranchResult> {
    // GitHub's POST /merges endpoint always creates a merge commit (no
    // fast-forward shortcut), which matches MnM's noFf:true default.
    // The commit_message becomes the merge commit's message; author and
    // committer of the merge commit are the token's user (no override
    // available on this endpoint, see R8 in plan).
    const url = `${this.repoPath()}/merges`;
    const res = await this.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: args.targetBranch,
          head: args.sourceBranch,
          commit_message: args.commitMessage,
        }),
      },
      "mergeBranch",
    );
    if (res.status === 204) {
      // 204 = nothing to merge (head is already merged). Return the head's sha.
      const headSha = await this.getRefSha(args.sourceBranch);
      return { sha: headSha };
    }
    const body = (await res.json()) as { sha?: string };
    if (!body.sha) {
      throw new GitProviderError(
        "unknown",
        `GitHub mergeBranch returned no sha (${args.sourceBranch} → ${args.targetBranch})`,
      );
    }
    return { sha: body.sha };
  }

  async deleteBranch(args: DeleteBranchArgs): Promise<void> {
    const url = `${this.repoPath()}/git/refs/heads/${encodeRefSegment(args.branch)}`;
    try {
      await this.request(url, { method: "DELETE" }, "deleteBranch");
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") {
        return; // idempotent
      }
      throw err;
    }
  }

  // -------- Internal helpers (Git Data API low-level building blocks) --------

  private async getRefSha(branch: string): Promise<string> {
    const url = `${this.repoPath()}/git/refs/heads/${encodeRefSegment(branch)}`;
    const res = await this.request(url, { method: "GET" }, "getRefSha");
    const body = (await res.json()) as { object?: { sha?: string } };
    if (!body.object?.sha) {
      throw new GitProviderError(
        "unknown",
        `GitHub getRefSha: no sha for branch=${branch}`,
      );
    }
    return body.object.sha;
  }

  private async getCommit(sha: string): Promise<{ tree: { sha: string } }> {
    const url = `${this.repoPath()}/git/commits/${encodeURIComponent(sha)}`;
    const res = await this.request(url, { method: "GET" }, "getCommit");
    const body = (await res.json()) as { tree?: { sha?: string } };
    if (!body.tree?.sha) {
      throw new GitProviderError(
        "unknown",
        `GitHub getCommit: no tree.sha for commit=${sha}`,
      );
    }
    return { tree: { sha: body.tree.sha } };
  }

  private async createBlob(content: string): Promise<string> {
    const url = `${this.repoPath()}/git/blobs`;
    const res = await this.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: Buffer.from(content, "utf8").toString("base64"),
          encoding: "base64",
        }),
      },
      "createBlob",
    );
    const body = (await res.json()) as { sha?: string };
    if (!body.sha) {
      throw new GitProviderError("unknown", "GitHub createBlob: no sha returned");
    }
    return body.sha;
  }

  private async createTree(
    baseTreeSha: string,
    entries: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string | null;
    }>,
  ): Promise<string> {
    const url = `${this.repoPath()}/git/trees`;
    // GitHub: a `tree` entry with `sha: null` means "delete this path".
    // Setting `content: ""` would create a zero-byte file instead. We
    // serialise sha=null literally as JSON null.
    const res = await this.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: entries,
        }),
      },
      "createTree",
    );
    const body = (await res.json()) as { sha?: string };
    if (!body.sha) {
      throw new GitProviderError("unknown", "GitHub createTree: no sha returned");
    }
    return body.sha;
  }

  private async createCommit(payload: {
    message: string;
    tree: string;
    parents: string[];
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  }): Promise<string> {
    const url = `${this.repoPath()}/git/commits`;
    const res = await this.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "createCommit",
    );
    const body = (await res.json()) as { sha?: string };
    if (!body.sha) {
      throw new GitProviderError("unknown", "GitHub createCommit: no sha returned");
    }
    return body.sha;
  }

  private async createRef(ref: string, sha: string): Promise<void> {
    // ref must be the full ref name including `refs/heads/` or `refs/tags/`.
    const url = `${this.repoPath()}/git/refs`;
    try {
      await this.request(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref, sha }),
        },
        "createRef",
      );
    } catch (err) {
      // 422 from createRef = "ref already exists" — surface as conflict.
      if (
        err instanceof GitProviderError &&
        (err.status === 422 || err.code === "conflict")
      ) {
        throw new GitProviderError("conflict", `GitHub createRef conflict (${ref}): already exists`, {
          status: err.status,
          cause: err,
        });
      }
      throw err;
    }
  }

  private async updateRef(ref: string, sha: string, force: boolean): Promise<void> {
    // ref passed as `refs/heads/<branch>`; the PATCH endpoint expects the
    // path WITHOUT the leading `refs/`.
    const refPath = ref.replace(/^refs\//, "");
    const url = `${this.repoPath()}/git/refs/${refPath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/")}`;
    await this.request(
      url,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha, force }),
      },
      "updateRef",
    );
  }

  private async fetchTokenUserIdentity(): Promise<{ name: string; email: string }> {
    // For OAuth mode, GET /user returns the human user. For App mode it
    // returns the App's bot identity (name like "MnMApp[bot]"). Annotated
    // tag tagger falls back to that bot identity in App mode — Phase 4
    // will let callers override via a richer createTag contract.
    const url = `${this.baseUrl}/user`;
    const res = await this.request(url, { method: "GET" }, "fetchTokenUserIdentity");
    const body = (await res.json()) as { name?: string | null; login?: string; email?: string | null };
    const login = body.login ?? "unknown";
    const name = body.name && body.name.length > 0 ? body.name : login;
    const email = body.email && body.email.length > 0 ? body.email : `${login}@users.noreply.github.com`;
    return { name, email };
  }

  private async authHeader(): Promise<string> {
    if (this.auth.mode === "user-oauth") {
      return `Bearer ${this.auth.token}`;
    }
    const token = await this.auth.mintToken();
    return `Bearer ${token}`;
  }

  private async request(
    url: string,
    init: RequestInit,
    op: string,
  ): Promise<Response> {
    // Caller headers first, auth + standard headers last so a malicious or
    // accidental Authorization in `init.headers` cannot override the
    // class-owned token.
    const baseHeaders: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: await this.authHeader(),
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      Accept: (init.headers as Record<string, string> | undefined)?.Accept ?? "application/vnd.github+json",
      "User-Agent": "mnm-git-provider/0.1",
    };

    const attempts = this.maxRetries + 1;
    let lastError: GitProviderError | undefined;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers: baseHeaders,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.ok) return res;

        // 304 Not Modified is fine if we ever start passing If-None-Match;
        // for now any non-2xx is an error.
        const isRateLimit =
          res.status === 429 ||
          (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");

        if (!isRateLimit && res.status < 500) {
          throw await this.httpError(res, op);
        }

        lastError = await this.httpError(res, op);
        if (attempt < attempts - 1) {
          await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
          continue;
        }
        throw lastError;
      } catch (cause) {
        if (cause instanceof GitProviderError) {
          if (
            cause.code === "rate_limited" ||
            (cause.status !== undefined && cause.status >= 500)
          ) {
            if (attempt < attempts - 1) {
              await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
              lastError = cause;
              continue;
            }
          }
          throw cause;
        }
        const code: GitProviderErrorCode =
          cause instanceof Error && cause.name === "AbortError" ? "timeout" : "network";
        throw new GitProviderError(
          code,
          `GitHub ${op} ${code} (${url}): ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
    }

    throw lastError ?? new GitProviderError("unknown", `GitHub ${op}: retries exhausted`);
  }

  private async httpError(res: Response, op: string): Promise<GitProviderError> {
    const isRateLimit =
      res.status === 429 ||
      (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
    const code: GitProviderErrorCode = isRateLimit
      ? "rate_limited"
      : res.status === 404
        ? "not_found"
        : res.status === 401 || res.status === 403
          ? "unauthorized"
          : res.status === 422
            ? "conflict"
            : res.status >= 500
              ? "unknown"
              : "unknown";
    let message = `GitHub ${op} HTTP ${res.status} ${res.statusText}`;
    // Surface GitHub's `message` field for clearer debugging when the
    // body is small JSON (most error responses).
    try {
      const body = (await res.clone().json()) as { message?: string };
      if (typeof body.message === "string" && body.message.length > 0) {
        message += ` — ${body.message}`;
      }
    } catch {
      // Body wasn't JSON or already consumed — ignore.
    }
    return new GitProviderError(code, message, { status: res.status });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Encode a repo-relative path for the GitHub Contents API URL. Each path
 * segment is URL-encoded; slashes are preserved as path separators.
 */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/**
 * Encode a single ref segment (e.g. branch name `feat/foo`). GitHub
 * accepts slashes in branch names but each segment between slashes must
 * be URL-encoded.
 */
function encodeRefSegment(branch: string): string {
  return branch
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function mapReviewState(state: string): CodeReviewerState {
  switch (state.toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes_requested";
    case "COMMENTED":
      return "commented";
    case "DISMISSED":
      return "dismissed";
    case "PENDING":
      return "pending";
    default:
      return "commented";
  }
}
