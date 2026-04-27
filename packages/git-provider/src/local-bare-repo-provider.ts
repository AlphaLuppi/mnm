import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile, unlink } from "node:fs/promises";
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
  FetchTreeArgs,
  TreeEntry,
  CommitMultipleFilesArgs,
  CommitMultipleFilesResult,
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

  async fetchTree(args: FetchTreeArgs): Promise<TreeEntry[]> {
    try {
      const cli = ["--git-dir", this.repoDir, "ls-tree", "--long"];
      if (args.recursive) cli.push("-r");
      cli.push(args.ref);
      if (args.subtree !== undefined && args.subtree !== "") {
        // Trailing slash tells ls-tree to list the contents of the directory
        // (without it, `ls-tree <subtree>` returns the single tree entry).
        const trimmed = args.subtree.replace(/\/+$/, "");
        cli.push(`${trimmed}/`);
      }
      const { stdout } = await execFileAsync("git", cli, {
        maxBuffer: 1024 * 1024 * 16,
      });
      // Format: `<mode> SP <type> SP <sha> SP* <size> TAB <path>`
      // `--long` pads size with spaces, so split on whitespace before the TAB.
      const entries: TreeEntry[] = [];
      for (const raw of stdout.split("\n")) {
        if (raw.length === 0) continue;
        const tabIdx = raw.indexOf("\t");
        if (tabIdx < 0) continue;
        const meta = raw.slice(0, tabIdx).trim().split(/\s+/);
        const path = raw.slice(tabIdx + 1);
        // meta = [mode, type, sha, size]
        const [, type, sha, sizeRaw] = meta;
        if (type !== "blob" && type !== "tree") continue;
        const size = sizeRaw === "-" || sizeRaw === undefined ? null : Number(sizeRaw);
        entries.push({
          path,
          type: type as "blob" | "tree",
          sha: sha ?? "",
          size: size === null || Number.isNaN(size) ? null : size,
        });
      }
      return entries;
    } catch (cause) {
      throw this.classifyGitError(cause, "fetchTree", {
        ref: args.ref,
        subtree: args.subtree,
      });
    }
  }

  async commitMultipleFiles(
    args: CommitMultipleFilesArgs,
  ): Promise<CommitMultipleFilesResult> {
    // Dedicated temp index so concurrent calls don't stomp each other.
    const indexFile = join(
      await mkdtemp(join(tmpdir(), "mnm-git-provider-idx-")),
      "index",
    );
    const env = { ...process.env, GIT_INDEX_FILE: indexFile };
    const cleanup = async () => {
      try {
        await rm(dirname(indexFile), { recursive: true, force: true });
      } catch {
        // best-effort
      }
    };

    try {
      // Resolve parent commit. If the branch exists, use it; otherwise try HEAD;
      // if neither exists, this is an initial commit (no parent).
      // Track whether the branch pre-existed so update-ref knows whether to
      // pass the old value for optimistic-lock semantics.
      let parentSha: string | null = null;
      let branchExisted = false;
      try {
        const { stdout } = await execFileAsync("git", [
          "--git-dir",
          this.repoDir,
          "rev-parse",
          "--verify",
          `refs/heads/${args.branch}`,
        ]);
        parentSha = stdout.trim();
        branchExisted = true;
      } catch {
        // Branch doesn't exist. Prefer startBranch, fall back to HEAD.
        if (args.startBranch) {
          try {
            const { stdout } = await execFileAsync("git", [
              "--git-dir",
              this.repoDir,
              "rev-parse",
              "--verify",
              `refs/heads/${args.startBranch}`,
            ]);
            parentSha = stdout.trim();
          } catch (cause) {
            throw this.classifyGitError(cause as Error, "commitMultipleFiles", {
              branch: args.branch,
              startBranch: args.startBranch,
            });
          }
        } else {
          try {
            const { stdout } = await execFileAsync("git", [
              "--git-dir",
              this.repoDir,
              "rev-parse",
              "--verify",
              "HEAD",
            ]);
            parentSha = stdout.trim();
          } catch {
            parentSha = null;
          }
        }
      }

      // Seed the index from the parent tree (if any).
      if (parentSha !== null) {
        await execFileAsync(
          "git",
          ["--git-dir", this.repoDir, "read-tree", parentSha],
          { env },
        );
      }

      // Apply every action against the index. Use `--index-info` on stdin so
      // bare repos (no worktree) work: lines of the form
      // `<mode> SP <sha> TAB <path>` add/update; lines with the null sha
      // (`0 0000… TAB <path>`) remove the path from the index. This bypasses
      // update-index's worktree check that `--add`/`--force-remove` trigger.
      const indexLines: string[] = [];
      for (const action of args.actions) {
        if (action.delete === true) {
          // Null sha (40 zeros) with mode 0 tells git to drop the entry.
          indexLines.push(`0 ${"0".repeat(40)}\t${action.path}`);
          continue;
        }
        const blobSha = await hashObjectStdin(
          this.repoDir,
          action.content ?? "",
        );
        indexLines.push(`100644 ${blobSha}\t${action.path}`);
      }
      await stdinExec(
        "git",
        ["--git-dir", this.repoDir, "update-index", "--index-info"],
        indexLines.join("\n") + "\n",
        env,
      );

      // Write the tree.
      const { stdout: treeOut } = await execFileAsync(
        "git",
        ["--git-dir", this.repoDir, "write-tree"],
        { env },
      );
      const treeSha = treeOut.trim();

      // Compose commit. `-p` only if we have a parent.
      const commitArgs = [
        "--git-dir",
        this.repoDir,
        "commit-tree",
        treeSha,
        "-m",
        args.commitMessage,
      ];
      if (parentSha !== null) {
        commitArgs.splice(3, 0, "-p", parentSha);
      }
      const { stdout: commitOut } = await execFileAsync("git", commitArgs, {
        env: {
          ...env,
          GIT_AUTHOR_NAME: args.authorName,
          GIT_AUTHOR_EMAIL: args.authorEmail,
          GIT_COMMITTER_NAME: args.authorName,
          GIT_COMMITTER_EMAIL: args.authorEmail,
        },
      });
      const commitSha = commitOut.trim();

      // Update the branch ref atomically. Pass old value only if the branch
      // pre-existed — otherwise update-ref would refuse the create because
      // there is no matching old value on disk.
      const updateRefArgs = [
        "--git-dir",
        this.repoDir,
        "update-ref",
        `refs/heads/${args.branch}`,
        commitSha,
      ];
      if (branchExisted && parentSha !== null) updateRefArgs.push(parentSha);
      await execFileAsync("git", updateRefArgs);

      return { sha: commitSha };
    } catch (cause) {
      throw this.classifyGitError(cause, "commitMultipleFiles", {
        branch: args.branch,
        actions: args.actions.length,
      });
    } finally {
      await cleanup();
      // Ensure the temp index file is gone even if mkdtemp raced with rm.
      try {
        await unlink(indexFile);
      } catch {
        // best-effort
      }
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

/**
 * Write a blob to the object store using `git hash-object -w --stdin` and
 * return the resulting sha. Used by `commitMultipleFiles` to prepare blobs
 * before staging them in the index.
 */
async function hashObjectStdin(repoDir: string, content: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = execFile(
      "git",
      ["--git-dir", repoDir, "hash-object", "-w", "--stdin"],
      { maxBuffer: 1024 * 1024 * 32 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      },
    );
    child.stdin?.end(content, "utf8");
  });
}

/**
 * Run `git <args>` with `input` piped to stdin and the supplied env. Used for
 * `update-index --index-info` batch staging in `commitMultipleFiles`.
 */
async function stdinExec(
  cmd: string,
  args: string[],
  input: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      cmd,
      args,
      { env, maxBuffer: 1024 * 1024 * 32 },
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
    child.stdin?.end(input, "utf8");
  });
}
