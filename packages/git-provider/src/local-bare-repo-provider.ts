import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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
  CreateTagArgs,
  CreateTagResult,
} from "./types.js";

const execFileAsync = promisify(execFile);

export interface LocalBareRepoProviderOptions {
  /** Stable id used for cache keys and error messages (e.g. `local:/path/to/repo.git`). */
  providerId: string;
  /** Absolute path to the `--bare` repo (the `.git` dir or a `--bare` clone). */
  repoDir: string;
}

/**
 * GitProvider backed by a local `--bare` repo accessed through the `git` CLI.
 * Used by tests and by the single-dev local mode. Not production-grade — every
 * call spawns `git`.
 */
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
        // 16 MB — workflow files are small; binary blobs are not supported.
        { maxBuffer: 1024 * 1024 * 16 },
      );
      // `git cat-file -p` appends a trailing newline for text blobs, but
      // preserves binary content byte-for-byte. Surface verbatim — callers
      // parse JSON/TS which are byte-exact.
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
    // Verify the ref first so we can distinguish "missing ref" (error) from
    // "missing path at valid ref" (boolean false).
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

  async commitFile(args: CommitFileArgs): Promise<CommitFileResult> {
    const work = await mkdtemp(join(tmpdir(), "mnm-git-provider-work-"));
    try {
      await execFileAsync(
        "git",
        ["clone", "--quiet", "--branch", args.branch, "--single-branch", this.repoDir, work],
      );

      const abs = join(work, args.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, args.content, "utf8");

      await execFileAsync("git", ["-C", work, "add", "--", args.path]);
      await execFileAsync(
        "git",
        [
          "-C",
          work,
          "-c",
          `user.name=${args.authorName}`,
          "-c",
          `user.email=${args.authorEmail}`,
          "commit",
          "-m",
          args.message,
          "--author",
          `${args.authorName} <${args.authorEmail}>`,
        ],
      );

      await execFileAsync("git", ["-C", work, "push", "origin", args.branch]);

      const { stdout } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "rev-parse", `refs/heads/${args.branch}`],
      );
      return { sha: stdout.trim() };
    } catch (cause) {
      throw this.classifyGitError(cause, "commitFile", {
        path: args.path,
        branch: args.branch,
      });
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  async createTag(args: CreateTagArgs): Promise<CreateTagResult> {
    try {
      // Resolve the ref to an actual sha first so the tag points to the commit.
      const sha = await this.resolveRef({ ref: args.ref });
      // Create an annotated tag if a message is provided, otherwise lightweight.
      if (args.message) {
        await execFileAsync(
          "git",
          ["--git-dir", this.repoDir, "tag", "-a", args.name, sha, "-m", args.message],
        );
      } else {
        await execFileAsync(
          "git",
          ["--git-dir", this.repoDir, "tag", args.name, sha],
        );
      }
      return { sha };
    } catch (cause) {
      throw this.classifyGitError(cause, "createTag", { name: args.name, ref: args.ref });
    }
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
    // Push-failure patterns → conflict (non-fast-forward, lock contention).
    // Callers (T4/T5) can retry after re-reading state.
    if (/rejected|non-fast-forward|cannot lock ref|failed to push/i.test(msg)) {
      return new GitProviderError(
        "conflict",
        `git ${op} conflict (${ctxStr}): ${msg}`,
        { cause },
      );
    }
    // git's stderr for missing refs/paths always includes one of these markers.
    // Case-insensitive /i means "not a valid" subsumes "Not a valid object".
    if (
      /unknown revision|not a valid|does not exist|bad revision|Needed a single revision|invalid object name/i.test(
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
