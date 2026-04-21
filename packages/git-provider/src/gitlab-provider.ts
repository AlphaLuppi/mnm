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
} from "./types.js";

export interface GitlabProviderOptions {
  providerId: string;
  baseUrl: string;
  projectId: string;
  token: string;
  timeoutMs?: number;
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

  async commitFile(_args: CommitFileArgs): Promise<CommitFileResult> {
    throw new GitProviderError("unknown", "commitFile not yet implemented");
  }

  private async request(
    url: string,
    init: RequestInit,
    op: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "PRIVATE-TOKEN": this.token,
      ...(init.headers as Record<string, string> | undefined),
    };
    const attempts = this.maxRetries + 1;
    let lastError: GitProviderError | undefined;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers,
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
