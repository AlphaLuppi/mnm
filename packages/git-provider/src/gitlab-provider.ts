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
  MergeBranchArgs,
  MergeBranchResult,
  DeleteBranchArgs,
} from "./types.js";

export interface GitlabProviderOptions {
  /** Stable id used for cache keys and error messages (e.g. `gitlab:12345`). */
  providerId: string;
  /** API root, e.g. `https://gitlab.example.com`. No trailing slash required. */
  baseUrl: string;
  /** Numeric or URL-encoded project id (GitLab accepts both). */
  projectId: string;
  /** Bot PAT (`glpat-...`) or OAuth access_token. See `tokenScheme`. */
  token: string;
  /**
   * How to send `token` to GitLab.
   * - "private-token" (default): `PRIVATE-TOKEN: <token>` — for personal/bot
   *   access tokens (`glpat-...`).
   * - "bearer": `Authorization: Bearer <token>` — for OAuth access tokens
   *   issued via the OIDC flow. PAT and OAuth tokens are NOT interchangeable
   *   on GitLab — sending an OAuth token via PRIVATE-TOKEN returns 401.
   */
  tokenScheme?: "private-token" | "bearer";
  /** Per-request timeout, default 10s. */
  timeoutMs?: number;
  /** Max retries on 5xx/429, default 2 (so 3 attempts total). */
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_MS = [250, 750, 2250];

export class GitlabProvider implements GitProvider {
  readonly providerId: string;
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly token: string;
  private readonly tokenScheme: "private-token" | "bearer";
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: GitlabProviderOptions) {
    this.providerId = options.providerId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.projectId = options.projectId;
    this.token = options.token;
    this.tokenScheme = options.tokenScheme ?? "private-token";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private projectPath(): string {
    return `${this.baseUrl}/api/v4/projects/${encodeURIComponent(this.projectId)}`;
  }

  async fetchBlob(args: FetchBlobArgs): Promise<string> {
    const url = `${this.projectPath()}/repository/files/${encodeURIComponent(args.path)}/raw?ref=${encodeURIComponent(args.ref)}`;
    const res = await this.request(url, { method: "GET" }, "fetchBlob");
    return res.text();
  }

  async resolveRef(args: ResolveRefArgs): Promise<string> {
    const url = `${this.projectPath()}/repository/commits/${encodeURIComponent(args.ref)}`;
    const res = await this.request(url, { method: "GET" }, "resolveRef");
    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      throw new GitProviderError(
        "unknown",
        `GitLab resolveRef returned no commit id for ref=${args.ref}`,
      );
    }
    return body.id;
  }

  async listTags(args?: ListTagsArgs): Promise<Tag[]> {
    const qs = args?.prefix
      ? `?search=${encodeURIComponent(`^${args.prefix}`)}`
      : "";
    const url = `${this.projectPath()}/repository/tags${qs}`;
    const res = await this.request(url, { method: "GET" }, "listTags");
    const body = (await res.json()) as Array<{
      name: string;
      commit: { id: string };
    }>;
    return body.map((t) => ({ name: t.name, sha: t.commit.id }));
  }

  async pathExists(args: PathExistsArgs): Promise<boolean> {
    const url = `${this.projectPath()}/repository/files/${encodeURIComponent(args.path)}?ref=${encodeURIComponent(args.ref)}`;
    try {
      await this.request(url, { method: "HEAD" }, "pathExists");
      return true;
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") return false;
      throw err;
    }
  }

  async commitFile(args: CommitFileArgs): Promise<CommitFileResult> {
    const exists = await this.pathExists({ path: args.path, ref: args.branch });
    const action = exists ? "update" : "create";

    // D7 note (plan 2026-05-04-github-provider.md): GitLab's
    // /repository/commits API accepts `author_name` + `author_email` only.
    // The `committer` of a GitLab commit IS the token owner — there is no
    // `committer_name`/`committer_email` field on this endpoint. So D7
    // symmetry on GitLab is "best-effort": if the OAuth user IS the commit
    // author (authorName/Email = the user's identity from `commit-identity`)
    // and the token belongs to that same user (Connectors Platform user
    // OAuth, the default in `MNM_REQUIRE_USER_CONNECTOR=true`), then
    // token owner == author == committer — D7 is satisfied transitively.
    // No API change needed here.
    const url = `${this.projectPath()}/repository/commits`;
    const payload = {
      branch: args.branch,
      commit_message: args.message,
      author_name: args.authorName,
      author_email: args.authorEmail,
      actions: [
        {
          action,
          file_path: args.path,
          content: args.content,
        },
      ],
    };

    let res: Response;
    try {
      res = await this.request(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        "commitFile",
      );
    } catch (err) {
      // 400 from the commits endpoint is typically "file exists" / "branch conflict".
      if (err instanceof GitProviderError && err.status === 400) {
        throw new GitProviderError(
          "conflict",
          `GitLab commitFile conflict (${args.path}@${args.branch}): ${err.message}`,
          { status: 400, cause: err },
        );
      }
      throw err;
    }

    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      throw new GitProviderError(
        "unknown",
        `GitLab commitFile returned no commit id for ${args.path}`,
      );
    }
    return { sha: body.id };
  }

  async createTag(args: CreateTagArgs): Promise<CreateTagResult> {
    const url = `${this.projectPath()}/repository/tags`;
    const payload: Record<string, string> = {
      tag_name: args.name,
      ref: args.ref,
    };
    if (args.message) {
      payload.message = args.message;
    }
    // D7 LIMITATION — GitLab's `POST /projects/:id/repository/tags` endpoint
    // does NOT expose any `tagger` / `committer` override. The tag's tagger
    // is always the API token's owner. `args.taggerName` / `args.taggerEmail`
    // are accepted by the GitProvider contract but ignored here. To preserve
    // human attribution on GitLab the calling token must already belong to
    // the MnM user (OAuth federation) — same constraint we enforce on commits.

    let res: Response;
    try {
      res = await this.request(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        "createTag",
      );
    } catch (err) {
      if (err instanceof GitProviderError && err.status === 400) {
        throw new GitProviderError(
          "conflict",
          `GitLab createTag conflict (${args.name}@${args.ref}): ${err.message}`,
          { status: 400, cause: err },
        );
      }
      throw err;
    }

    const body = (await res.json()) as { commit?: { id?: string } };
    const sha = body.commit?.id;
    if (!sha) {
      throw new GitProviderError(
        "unknown",
        `GitLab createTag returned no commit id for tag ${args.name}`,
      );
    }
    return { sha };
  }

  async fetchTree(args: FetchTreeArgs): Promise<TreeEntry[]> {
    const entries: TreeEntry[] = [];
    const params = new URLSearchParams();
    params.set("ref", args.ref);
    if (args.subtree !== undefined && args.subtree !== "") {
      params.set("path", args.subtree.replace(/\/+$/, ""));
    }
    params.set("recursive", args.recursive ? "true" : "false");
    params.set("per_page", "100");
    params.set("pagination", "keyset");

    let url: string | null = `${this.projectPath()}/repository/tree?${params.toString()}`;
    while (url !== null) {
      const res: Response = await this.request(url, { method: "GET" }, "fetchTree");
      const body = (await res.json()) as Array<{
        id: string;
        type: "blob" | "tree";
        path: string;
        mode?: string;
      }>;
      for (const raw of body) {
        entries.push({
          path: raw.path,
          type: raw.type,
          sha: raw.id,
          // GitLab's tree endpoint does not surface size — callers that need
          // byte counts must fetch the blob separately.
          size: null,
        });
      }
      const nextPage = res.headers.get("x-next-page");
      if (nextPage && nextPage.length > 0 && body.length > 0) {
        // GitLab keyset pagination sometimes returns a Link header with the
        // full next URL; prefer it when present (cheap to parse here).
        const link = res.headers.get("link");
        const match = link?.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1]! : `${this.projectPath()}/repository/tree?${params.toString()}&page=${encodeURIComponent(nextPage)}`;
      } else {
        url = null;
      }
    }
    return entries;
  }

  async commitMultipleFiles(
    args: CommitMultipleFilesArgs,
  ): Promise<CommitMultipleFilesResult> {
    // Resolve create-vs-update for each non-delete action. One tree fetch
    // amortises N HEAD calls; fall back to "update" for every file if the
    // tree fetch 404s (branch may not exist yet — GitLab will error on the
    // commit itself with a clearer message).
    const nonDelete = args.actions.filter((a) => a.delete !== true);
    let existingPaths: Set<string> = new Set();
    if (nonDelete.length > 0) {
      try {
        const tree = await this.fetchTree({ ref: args.branch, recursive: true });
        for (const entry of tree) {
          if (entry.type === "blob") existingPaths.add(entry.path);
        }
      } catch (err) {
        if (err instanceof GitProviderError && err.code === "not_found") {
          // Branch/ref missing — treat all non-delete as "create".
          existingPaths = new Set();
        } else {
          throw err;
        }
      }
    }

    const actions = args.actions.map((a) => {
      if (a.delete === true) {
        return { action: "delete" as const, file_path: a.path };
      }
      const exists = existingPaths.has(a.path);
      return {
        action: exists ? ("update" as const) : ("create" as const),
        file_path: a.path,
        content: a.content ?? "",
      };
    });

    const url = `${this.projectPath()}/repository/commits`;
    const payload: Record<string, unknown> = {
      branch: args.branch,
      commit_message: args.commitMessage,
      author_name: args.authorName,
      author_email: args.authorEmail,
      actions,
    };
    if (args.startBranch) {
      payload.start_branch = args.startBranch;
    }

    let res: Response;
    try {
      res = await this.request(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        "commitMultipleFiles",
      );
    } catch (err) {
      if (err instanceof GitProviderError && err.status === 400) {
        throw new GitProviderError(
          "conflict",
          `GitLab commitMultipleFiles conflict (${args.branch}): ${err.message}`,
          { status: 400, cause: err },
        );
      }
      throw err;
    }

    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      throw new GitProviderError(
        "unknown",
        `GitLab commitMultipleFiles returned no commit id`,
      );
    }
    return { sha: body.id };
  }

  /**
   * Live code review state fetch on a GitLab MR. The project may differ
   * from `this.projectId` — same token works across projects on the same
   * instance, so we rebuild the URL with the caller-supplied projectId.
   *
   * Maps GitLab's `/merge_requests/:iid/approvals` payload to the
   * provider-agnostic `CodeReviewState` shape:
   * - `approvals_required` → `requiredApprovals`
   * - `approved_by.length` → `currentApprovals`
   * - `approved_by[].user.username` → `reviewers[]` with `state: "approved"`
   * - `raw` = the original GitLab payload (escape-hatch for advanced gates)
   *
   * Note: gates that previously read `approved: true` should NOT trust
   * `currentApprovals > 0` alone — measure `currentApprovals >= requiredApprovals`.
   * GitLab returns `approved: true` even when `approvals_required: 0` (no rule
   * blocks merging), which does NOT mean a human approved.
   */
  async getCodeReviewState(args: CodeReviewReference): Promise<CodeReviewState> {
    if (args.kind !== "gitlab") {
      throw new GitProviderError(
        "unauthorized",
        `GitlabProvider.getCodeReviewState rejects kind="${args.kind}" — use a GitHubProvider for GitHub PRs`,
      );
    }
    const url = `${this.baseUrl}/api/v4/projects/${encodeURIComponent(
      args.projectId,
    )}/merge_requests/${args.mrIid}/approvals`;
    const res = await this.request(url, { method: "GET" }, "getCodeReviewState");
    const body = (await res.json()) as {
      approved?: boolean;
      approvals_required?: number;
      approved_by?: Array<{
        user: { id: number; username: string; name?: string };
      }>;
    };
    const approvedBy = body.approved_by ?? [];
    const reviewers: CodeReviewer[] = approvedBy.map((a) => ({
      login: a.user.username,
      state: "approved",
    }));
    return {
      requiredApprovals: body.approvals_required ?? 0,
      currentApprovals: approvedBy.length,
      reviewers,
      raw: body,
    };
  }

  async mergeBranch(args: MergeBranchArgs): Promise<MergeBranchResult> {
    // Step A: create MR
    const createUrl = `${this.projectPath()}/merge_requests`;
    const createRes = await this.request(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_branch: args.sourceBranch,
        target_branch: args.targetBranch,
        title: args.commitMessage.split("\n")[0]!,
        description: args.commitMessage,
        remove_source_branch: false,
      }),
    }, "mergeBranch.createMR");
    const mr = (await createRes.json()) as { iid: number };

    // Step B: accept MR with no fast-forward
    const acceptUrl = `${this.projectPath()}/merge_requests/${mr.iid}/merge`;
    const acceptRes = await this.request(acceptUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merge_commit_message: args.commitMessage,
        squash: false,
        should_remove_source_branch: false,
      }),
    }, "mergeBranch.acceptMR");
    const accepted = (await acceptRes.json()) as { merge_commit_sha?: string };
    if (!accepted.merge_commit_sha) {
      throw new GitProviderError("unknown", "GitLab merge returned no merge_commit_sha");
    }
    return { sha: accepted.merge_commit_sha };
  }

  async deleteBranch(args: DeleteBranchArgs): Promise<void> {
    const url = `${this.projectPath()}/repository/branches/${encodeURIComponent(args.branch)}`;
    try {
      await this.request(url, { method: "DELETE" }, "deleteBranch");
    } catch (err) {
      if (err instanceof GitProviderError && err.code === "not_found") {
        return; // idempotent
      }
      throw err;
    }
  }

  private async request(
    url: string,
    init: RequestInit,
    op: string,
  ): Promise<Response> {
    // Caller headers first, auth header last — class-owned token must win
    // over any accidental or malicious caller-provided auth header.
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      ...(this.tokenScheme === "bearer"
        ? { Authorization: `Bearer ${this.token}` }
        : { "PRIVATE-TOKEN": this.token }),
    };
    const attempts = this.maxRetries + 1;
    let lastError: GitProviderError | undefined;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers,
          // Per-attempt timeout, not cumulative. Worst case = attempts × timeoutMs.
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.ok) return res;

        if (res.status !== 429 && res.status < 500) {
          throw this.httpError(res, op);
        }

        lastError = this.httpError(res, op);
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
          `GitLab ${op} ${code} (${url}): ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
    }

    throw lastError ?? new GitProviderError("unknown", `GitLab ${op}: retries exhausted`);
  }

  private httpError(res: Response, op: string): GitProviderError {
    const code: GitProviderErrorCode =
      res.status === 404
        ? "not_found"
        : res.status === 401 || res.status === 403
          ? "unauthorized"
          : res.status === 429
            ? "rate_limited"
            : res.status >= 500
              ? "unknown"
              : "unknown";
    return new GitProviderError(
      code,
      `GitLab ${op} HTTP ${res.status} ${res.statusText}`,
      { status: res.status },
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
