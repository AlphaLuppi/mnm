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
} from "./types.js";

export interface GitlabProviderOptions {
  /** Stable id used for cache keys and error messages (e.g. `gitlab:12345`). */
  providerId: string;
  /** API root, e.g. `https://gitlab.example.com`. No trailing slash required. */
  baseUrl: string;
  /** Numeric or URL-encoded project id (GitLab accepts both). */
  projectId: string;
  /** Bot token (`glpat-...`). Sent as `PRIVATE-TOKEN` header. */
  token: string;
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
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: GitlabProviderOptions) {
    this.providerId = options.providerId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.projectId = options.projectId;
    this.token = options.token;
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
    const payload = {
      branch: args.branch,
      commit_message: args.commitMessage,
      author_name: args.authorName,
      author_email: args.authorEmail,
      actions,
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

  private async request(
    url: string,
    init: RequestInit,
    op: string,
  ): Promise<Response> {
    // Caller headers first, PRIVATE-TOKEN last — class-owned token must win
    // over any accidental or malicious caller-provided PRIVATE-TOKEN header.
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      "PRIVATE-TOKEN": this.token,
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
