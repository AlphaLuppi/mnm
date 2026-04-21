import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitProviderError } from "./errors.js";
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

const execFileAsync = promisify(execFile);

export interface LocalBareRepoProviderOptions {
  providerId: string;
  repoDir: string;
}

export class LocalBareRepoProvider implements GitProvider {
  readonly providerId: string;
  private readonly repoDir: string;

  constructor(options: LocalBareRepoProviderOptions) {
    this.providerId = options.providerId;
    this.repoDir = options.repoDir;
  }

  async fetchBlob(args: FetchBlobArgs): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "cat-file", "-p", `${args.ref}:${args.path}`],
        { maxBuffer: 1024 * 1024 * 16 },
      );
      return stdout;
    } catch (cause) {
      throw this.classifyGitError(cause, "fetchBlob", { path: args.path, ref: args.ref });
    }
  }

  async resolveRef(args: ResolveRefArgs): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "rev-parse", "--verify", `${args.ref}^{commit}`],
      );
      return stdout.trim();
    } catch (cause) {
      throw this.classifyGitError(cause, "resolveRef", { ref: args.ref });
    }
  }

  async listTags(args?: ListTagsArgs): Promise<Tag[]> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        [
          "--git-dir",
          this.repoDir,
          "for-each-ref",
          "--format=%(refname:short)\t%(objectname)",
          "refs/tags",
        ],
      );
      const lines = stdout.split("\n").filter((l) => l.length > 0);
      const all: Tag[] = lines.map((line) => {
        const [name = "", sha = ""] = line.split("\t");
        return { name, sha };
      });
      if (args?.prefix) {
        return all.filter((t) => t.name.startsWith(args.prefix!));
      }
      return all;
    } catch (cause) {
      throw this.classifyGitError(cause, "listTags", { prefix: args?.prefix });
    }
  }

  async pathExists(args: PathExistsArgs): Promise<boolean> {
    await this.resolveRef({ ref: args.ref });
    try {
      await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "cat-file", "-e", `${args.ref}:${args.path}`],
      );
      return true;
    } catch {
      return false;
    }
  }

  async commitFile(_args: CommitFileArgs): Promise<CommitFileResult> {
    throw new GitProviderError("unknown", "commitFile not yet implemented");
  }

  private classifyGitError(
    cause: unknown,
    op: string,
    ctx: Record<string, unknown>,
  ): GitProviderError {
    const msg = cause instanceof Error ? cause.message : String(cause);
    const ctxStr = Object.entries(ctx)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");
    if (
      /unknown revision|not a valid|does not exist|Not a valid object|bad revision|Needed a single revision|invalid object name/i.test(
        msg,
      )
    ) {
      return new GitProviderError(
        "not_found",
        `git ${op} failed (${ctxStr}): ${msg}`,
        { cause },
      );
    }
    return new GitProviderError(
      "unknown",
      `git ${op} failed (${ctxStr}): ${msg}`,
      { cause },
    );
  }
}
