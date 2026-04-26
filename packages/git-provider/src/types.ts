/**
 * Arguments accepted by GitProvider methods.
 * `ref` is a sha OR a tag name OR a branch name. Implementations MUST resolve it.
 * `path` is POSIX-style, repo-relative, no leading slash (e.g. "hello-world/workflow.json").
 */

export interface FetchBlobArgs {
  path: string;
  ref: string;
}

export interface ListTagsArgs {
  prefix?: string;
}

export interface Tag {
  name: string;
  sha: string;
}

export interface ResolveRefArgs {
  ref: string;
}

export interface PathExistsArgs {
  path: string;
  ref: string;
}

export interface CommitFileArgs {
  path: string;
  content: string;
  message: string;
  branch: string;
  authorName: string;
  authorEmail: string;
}

export interface CommitFileResult {
  sha: string;
}

export interface CreateTagArgs {
  /** Tag name, e.g. `hello-world/v1.2.3`. */
  name: string;
  /** SHA or branch name the tag should point to. */
  ref: string;
  /** Optional message for annotated tags. */
  message?: string;
}

export interface CreateTagResult {
  /** The SHA the tag was created at (resolves the ref). */
  sha: string;
}

/**
 * Arguments to `fetchTree`. `subtree` scopes the listing to a single directory;
 * `recursive` controls whether nested entries are flattened into the result.
 */
export interface FetchTreeArgs {
  ref: string;
  /** Repo-relative, POSIX, no leading slash. Undefined = repo root. */
  subtree?: string;
  /** Default false — only immediate children of subtree. */
  recursive?: boolean;
}

/**
 * One entry returned by `fetchTree`. `path` is always full repo-relative
 * (not relative to `subtree`). `size` is bytes for blobs, null for trees or
 * providers that do not surface size cheaply (GitLab tree endpoint).
 */
export interface TreeEntry {
  /** Repo-relative POSIX path, no leading slash. */
  path: string;
  type: "blob" | "tree";
  sha: string;
  size: number | null;
}

/**
 * Arguments to `commitMultipleFiles`. Each action creates, updates or deletes
 * a single path. Order is preserved; duplicate paths are allowed (last wins,
 * per-implementation).
 */
export interface CommitMultipleFilesArgs {
  branch: string;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
  actions: Array<{ path: string; content?: string; delete?: boolean }>;
}

export interface CommitMultipleFilesResult {
  /** SHA of the new commit. */
  sha: string;
}

/**
 * Arguments to `getMergeRequestApprovals`. `projectId` may differ from the
 * provider's default project (e.g. the workflow repo is `org/mnm-demo` but
 * the MR being checked is on `org/app-being-developed`). Same token works
 * across both projects on the same instance.
 */
export interface GetMrApprovalsArgs {
  projectId: string;
  /** Merge request iid (project-scoped, not global). */
  mrIid: number;
}

/**
 * Subset of GitLab's `/merge_requests/:iid/approvals` payload that gates
 * actually consume. Note: `approved: true` with `approvals_required: 0`
 * does NOT mean a human approved — only that no rule blocks merging.
 * Gate authors must measure `approved_by.length`, not `approved`.
 */
export interface MrApprovalsResult {
  approved: boolean;
  approvals_required: number;
  approved_by: Array<{
    user: {
      id: number;
      username: string;
      name?: string;
    };
  }>;
}

/**
 * Minimal git surface the governed-workflows runtime needs. Implemented by:
 * - `LocalBareRepoProvider` (tests + single-dev local mode)
 * - `GitlabProvider` (production — GitLab REST v4)
 *
 * Contract:
 * - Every method rejects with a `GitProviderError` (never a raw Error).
 * - `fetchBlob` / `pathExists` are memoizable by caller only when `ref` is a sha
 *   (implementations do NOT memoize — that's the `ShaCache`'s job, wired by the
 *   consumer in T4/T5).
 * - `commitFile` creates one commit stamped with the supplied author identity,
 *   even if the provider authenticates with a bot token.
 * - `createTag` creates an annotated tag pointing at the given ref.
 */
export interface GitProvider {
  fetchBlob(args: FetchBlobArgs): Promise<string>;
  listTags(args?: ListTagsArgs): Promise<Tag[]>;
  resolveRef(args: ResolveRefArgs): Promise<string>;
  pathExists(args: PathExistsArgs): Promise<boolean>;
  commitFile(args: CommitFileArgs): Promise<CommitFileResult>;
  createTag(args: CreateTagArgs): Promise<CreateTagResult>;
  /**
   * List entries at `ref`/`subtree`. Returns a flat array of `TreeEntry`.
   * With `recursive: false` (default), only immediate children are returned;
   * with `recursive: true`, all nested blobs under the subtree are included.
   */
  fetchTree(args: FetchTreeArgs): Promise<TreeEntry[]>;
  /**
   * Atomically apply a batch of create/update/delete actions on `branch` as a
   * single commit. Implementations MUST use `authorName`/`authorEmail` even
   * when authenticating via a bot token.
   */
  commitMultipleFiles(args: CommitMultipleFilesArgs): Promise<CommitMultipleFilesResult>;
  /**
   * Live-fetch approvals on a merge request. Used by gates that verify
   * human review at evaluation time, bypassing whatever the subagent
   * claimed in the artifact. Optional because LocalBareRepoProvider has
   * no notion of merge requests — it throws when called.
   */
  getMergeRequestApprovals?(args: GetMrApprovalsArgs): Promise<MrApprovalsResult>;
}
