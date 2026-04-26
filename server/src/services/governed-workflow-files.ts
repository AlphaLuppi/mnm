/**
 * Service behind the multi-file Workflow Studio editor (U13.*). Wraps the
 * `GitProvider` tree + batch-commit primitives with:
 *
 * - Path validation. Every client-supplied path is forced workflow-relative
 *   and rejected if it contains `..`, starts with `/`, or uses backslashes.
 *   The `<workflowName>/` subtree prefix is the service's responsibility —
 *   NEVER the caller's — so the UI cannot craft a path that escapes the
 *   workflow directory.
 * - Semver tag bump on batch commit. Reuses `computeNextTag` from
 *   `governed-workflows-extensions.ts` so the UI edit path produces the same
 *   `<name>/v<major>.<minor>.<patch>` tags as the programmatic `saveDefinition`
 *   helper.
 * - DB parity. After a successful batch commit, the `latest_git_tag` column on
 *   `governed_workflow_definitions` is advanced so `list_governed_workflows`
 *   and `get_governed_workflow` immediately see the new version.
 *
 * The HTTP routes that consume this service live in U13.3.
 */

import { and, eq } from "drizzle-orm";
import { governedWorkflowDefinitions, type Db } from "@mnm/db";
import type {
  GitProvider,
  ShaCache,
  TreeEntry,
  CommitMultipleFilesArgs,
} from "@mnm/git-provider";
import { GitProviderError } from "@mnm/git-provider";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { GovernedWorkflowError } from "./governed-workflows.js";
import { computeNextTag } from "./governed-workflows-extensions.js";
import { resolveResourcePath, rejectTraversal } from "./git-resource-path.js";
import type { ProviderWithPaths } from "./git-resource-path.js";

// ── Dependencies ────────────────────────────────────────────────────────────

export interface GovernedWorkflowFilesDeps {
  /**
   * Per-company (or per-user) GitProvider resolver. Same contract as
   * `governedWorkflowService` — see spec §T2. We never cache the instance
   * ourselves.
   */
  resolveGitProvider: (args: {
    companyId: string;
    userId: string | null;
    resourceType?: import("./git-resource-path.js").ResourceType;
  }) => Promise<GitProvider>;
  shaCache: ShaCache;
}

// ── Public args / results ───────────────────────────────────────────────────

export interface ListWorkflowFilesArgs {
  companyId: string;
  userId: string | null;
  workflowName: string;
  ref: string;
}

export interface ListWorkflowFilesResult {
  /** Entries with their `<workflowName>/` prefix stripped. */
  tree: TreeEntry[];
}

export interface GetWorkflowFileArgs {
  companyId: string;
  userId: string | null;
  workflowName: string;
  ref: string;
  /** Workflow-relative path. The service prepends `<workflowName>/`. */
  path: string;
}

export interface GetWorkflowFileResult {
  content: string;
  /** Blob sha resolved via `fetchTree`. Empty string if we can't find the entry. */
  sha: string;
}

export interface BatchCommitWorkflowFilesArgs {
  companyId: string;
  userId: string | null;
  workflowName: string;
  branch: string;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
  /** Workflow-relative paths; service prefixes each with `<workflowName>/`. */
  changes: Array<{ path: string; content?: string; delete?: boolean }>;
}

export interface BatchCommitWorkflowFilesResult {
  commitSha: string;
  newGitTag: string;
}

// ── Path validation ─────────────────────────────────────────────────────────

// Strict workflow-relative POSIX path: one-or-more `[A-Za-z0-9._-]` segments
// separated by `/`, with NO backslashes, NO leading slash, and NO `..` segment.
// Deliberately narrow — the editor only ever creates workflow authoring files,
// not arbitrary binary blobs.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function validateWorkflowRelativePath(path: string): void {
  if (typeof path !== "string" || path.length === 0) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH,
      "Path must be a non-empty string",
    );
  }
  if (path.includes("\\")) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH,
      `Path '${path}' must not contain backslashes`,
    );
  }
  if (path.startsWith("/")) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH,
      `Path '${path}' must be workflow-relative (no leading slash)`,
    );
  }
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH,
        `Path '${path}' contains an empty or traversal segment`,
      );
    }
    if (!SAFE_SEGMENT.test(seg)) {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_FILE_INVALID_PATH,
        `Path '${path}' contains an invalid character (allowed: [A-Za-z0-9._-] per segment)`,
      );
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function wrapGitError(op: string, cause: unknown): GovernedWorkflowError {
  if (cause instanceof GovernedWorkflowError) return cause;
  if (cause instanceof GitProviderError) {
    return new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.GIT_PROVIDER_ERROR,
      `Git ${op} failed: ${cause.message}`,
      [`underlying git code: ${cause.code}`],
    );
  }
  return new GovernedWorkflowError(
    WORKFLOW_ERROR_CODES.GIT_PROVIDER_ERROR,
    `Git ${op} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
}

function stripPrefix(entry: TreeEntry, prefix: string): TreeEntry {
  // Example: prefix "hello-world/", entry.path "hello-world/gates/foo.ts"
  // -> "gates/foo.ts". If the entry is the subtree root itself we'd return "",
  // but fetchTree with a trailing-slash subtree never includes that entry.
  if (entry.path.startsWith(prefix)) {
    return { ...entry, path: entry.path.slice(prefix.length) };
  }
  return entry;
}

// Returns the workflow directory path (no trailing slash).
// With paths.workflows="workflows": "workflows/hello-world"
// Without paths:                    "hello-world"
//
// M-FIX-3: validate workflowName + base prefix BEFORE concatenating so a
// caller passing `../evil` is rejected here, not at the git provider boundary.
// Practical impact today is bounded by the providers themselves (GitLab API
// scoped to project, git ls-tree rejects `..`) but defense-in-depth keeps a
// single audit point.
function resolveWorkflowDir(provider: ProviderWithPaths, workflowName: string): string {
  const base = provider.paths?.workflows ?? "";
  rejectTraversal("paths prefix", base);
  rejectTraversal("workflow_name", workflowName);
  return base === "" ? workflowName : `${base}/${workflowName}`;
}

// ── Service methods ─────────────────────────────────────────────────────────

/**
 * List every file/directory under `<workflowName>/` at the given ref. Entries
 * are returned with their `<workflowName>/` prefix removed so the UI can show
 * workflow-relative paths directly.
 */
export async function listWorkflowFiles(
  deps: GovernedWorkflowFilesDeps,
  args: ListWorkflowFilesArgs,
): Promise<ListWorkflowFilesResult> {
  const gitProvider = await deps.resolveGitProvider({
    companyId: args.companyId,
    userId: args.userId,
    resourceType: "workflow",
  });

  const workflowDir = resolveWorkflowDir(gitProvider as ProviderWithPaths, args.workflowName);
  const prefix = `${workflowDir}/`;
  let entries: TreeEntry[];
  try {
    entries = await gitProvider.fetchTree({
      ref: args.ref,
      subtree: workflowDir,
      recursive: true,
    });
  } catch (cause) {
    throw wrapGitError("fetchTree", cause);
  }

  return {
    tree: entries.map((e) => stripPrefix(e, prefix)),
  };
}

/**
 * Fetch one workflow-relative file. Returns `{ content, sha }` where `sha` is
 * the blob sha resolved from a tree listing at the file's directory. If we
 * cannot find the entry in the tree (e.g. a race where the file was just
 * deleted) we return an empty sha rather than failing — the content fetch
 * already succeeded.
 */
export async function getWorkflowFile(
  deps: GovernedWorkflowFilesDeps,
  args: GetWorkflowFileArgs,
): Promise<GetWorkflowFileResult> {
  validateWorkflowRelativePath(args.path);

  const gitProvider = await deps.resolveGitProvider({
    companyId: args.companyId,
    userId: args.userId,
    resourceType: "workflow",
  });

  const fullPath = resolveResourcePath(
    gitProvider as ProviderWithPaths,
    "workflow",
    args.workflowName,
    args.path,
  );

  let content: string;
  try {
    content = await gitProvider.fetchBlob({ path: fullPath, ref: args.ref });
  } catch (cause) {
    if (cause instanceof GitProviderError && cause.code === "not_found") {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.WORKFLOW_FILE_NOT_FOUND,
        `File '${args.path}' not found in workflow '${args.workflowName}' at ref '${args.ref}'`,
      );
    }
    throw wrapGitError("fetchBlob", cause);
  }

  // Tree lookup to discover the blob sha. We intentionally scope this to the
  // file's parent directory so a deep workflow doesn't pay the recursive
  // listing cost on every file read.
  let sha = "";
  const lastSlash = fullPath.lastIndexOf("/");
  const parent = lastSlash >= 0 ? fullPath.slice(0, lastSlash) : "";
  try {
    const parentEntries = await gitProvider.fetchTree({
      ref: args.ref,
      subtree: parent === "" ? undefined : parent,
      recursive: false,
    });
    const match = parentEntries.find((e) => e.path === fullPath && e.type === "blob");
    if (match) sha = match.sha;
  } catch {
    // Best-effort. Content already fetched; leaving sha empty is acceptable.
  }

  return { content, sha };
}

/**
 * Atomically commit a batch of create/update/delete actions to the workflow's
 * subtree, push a new semver tag, and update the definition row's
 * `latest_git_tag`. All paths are client-workflow-relative; the service is the
 * only code that computes the `<workflowName>/…` full path.
 */
export async function batchCommitWorkflowFiles(
  db: Db,
  deps: GovernedWorkflowFilesDeps,
  args: BatchCommitWorkflowFilesArgs,
): Promise<BatchCommitWorkflowFilesResult> {
  if (!Array.isArray(args.changes) || args.changes.length === 0) {
    throw new GovernedWorkflowError(
      WORKFLOW_ERROR_CODES.WORKFLOW_FILE_EMPTY_CHANGES,
      `batchCommitWorkflowFiles called with no changes`,
      ["Submit at least one create/update/delete action"],
    );
  }

  // Validate every client path BEFORE touching git — fail-closed.
  for (const change of args.changes) {
    validateWorkflowRelativePath(change.path);
  }

  const gitProvider = await deps.resolveGitProvider({
    companyId: args.companyId,
    userId: args.userId,
    resourceType: "workflow",
  });

  // Prefix every change with the provider-resolved workflow dir — the only
  // place in the codebase that concatenates client paths with the subtree.
  const actions: CommitMultipleFilesArgs["actions"] = args.changes.map((c) => {
    const full = resolveResourcePath(
      gitProvider as ProviderWithPaths,
      "workflow",
      args.workflowName,
      c.path,
    );
    if (c.delete === true) {
      return { path: full, delete: true };
    }
    return { path: full, content: c.content ?? "" };
  });

  let commitSha: string;
  try {
    const result = await gitProvider.commitMultipleFiles({
      branch: args.branch,
      commitMessage: args.commitMessage,
      authorName: args.authorName,
      authorEmail: args.authorEmail,
      actions,
    });
    commitSha = result.sha;
  } catch (cause) {
    throw wrapGitError("commitMultipleFiles", cause);
  }

  // Compute + create the next semver tag.
  let newGitTag: string;
  try {
    const existingTags = await gitProvider.listTags({
      prefix: `${args.workflowName}/v`,
    });
    newGitTag = computeNextTag(
      args.workflowName,
      existingTags.map((t) => t.name),
    );
    await gitProvider.createTag({
      name: newGitTag,
      ref: commitSha,
      message: args.commitMessage,
    });
  } catch (cause) {
    throw wrapGitError("createTag", cause);
  }

  // Parity with `saveDefinition`: bump the DB row so `latest_git_tag` reflects
  // the most recent tag. Silent no-op if the row doesn't exist yet — the UI
  // path always creates a definition via `upsertDefinition` first.
  await db
    .update(governedWorkflowDefinitions)
    .set({ latestGitTag: newGitTag, updatedAt: new Date() })
    .where(
      and(
        eq(governedWorkflowDefinitions.companyId, args.companyId),
        eq(governedWorkflowDefinitions.name, args.workflowName),
      ),
    );

  return { commitSha, newGitTag };
}
