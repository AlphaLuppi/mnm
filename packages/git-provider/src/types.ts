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
  /**
   * D7 strict identity for annotated tags. When BOTH `taggerName` and
   * `taggerEmail` are supplied, providers MUST use them as the tag's
   * `tagger` (so the tag is attributed to the MnM user even when
   * authenticating with a GitHub App installation token, which would
   * otherwise default to the App[bot] identity from `/user`).
   *
   * Provider support:
   * - GitHubProvider: honored fully via the Git Data API (`POST /git/tags`).
   * - LocalBareRepoProvider: honored via `git -c user.name -c user.email tag -a`.
   * - GitlabProvider: NOT honored (the GitLab `POST /repository/tags` endpoint
   *   does not expose a `tagger` override; the tagger is always the API token
   *   owner). Documented as a no-op there.
   *
   * Lightweight tags (no `message`) ignore these fields — git lightweight
   * tags carry no tagger metadata.
   */
  taggerName?: string;
  taggerEmail?: string;
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
  /**
   * If `branch` does not yet exist, create it starting from `startBranch`.
   * On GitLab this maps to the `start_branch` request param. On
   * LocalBareRepoProvider, when `branch` is missing the parent commit is
   * resolved from `refs/heads/<startBranch>` instead of HEAD.
   */
  startBranch?: string;
}

export interface CommitMultipleFilesResult {
  /** SHA of the new commit. */
  sha: string;
}

export interface MergeBranchArgs {
  sourceBranch: string;
  targetBranch: string;
  commitMessage: string;
  /** When true, force a merge commit (no fast-forward). Defaults true. */
  noFf?: boolean;
  authorName: string;
  authorEmail: string;
}

export interface MergeBranchResult {
  /** The merge commit sha (may equal sourceBranch tip if a real merge wasn't needed). */
  sha: string;
}

export interface DeleteBranchArgs {
  branch: string;
}

/**
 * Provider-agnostic reference to a code review (GitLab MR or GitHub PR).
 * The `kind` discriminator lets the gate target a project that may differ
 * from the provider's default (same token works across projects on the
 * same instance for both providers).
 */
export type CodeReviewReference =
  | {
      kind: "gitlab";
      /** Numeric or URL-encoded GitLab project id. */
      projectId: string;
      /** Merge request iid (project-scoped, not global). */
      mrIid: number;
    }
  | {
      kind: "github";
      /** Repo owner login (user or org). */
      owner: string;
      /** Repo name. */
      repo: string;
      /** Pull request number. */
      pullNumber: number;
    };

export type CodeReviewerState =
  | "approved"
  | "changes_requested"
  | "commented"
  | "pending"
  | "dismissed";

/**
 * One reviewer's current state on a code review. `submittedAt` is ISO-8601
 * when present; absent for `pending` (review requested but no submission yet).
 */
export interface CodeReviewer {
  /** Provider-side login (`username` on GitLab, `login` on GitHub). */
  login: string;
  state: CodeReviewerState;
  submittedAt?: string;
}

/**
 * Provider-agnostic snapshot of a code review's current approval status.
 * Returned by `GitProvider.getCodeReviewState` for both GitLab MRs and
 * GitHub PRs.
 *
 * Gate authors should measure `currentApprovals >= requiredApprovals` rather
 * than reading `raw` — `raw` is escape-hatch for provider-specific gates that
 * need fields not surfaced in the abstraction.
 *
 * Mappings:
 * - GitLab: `requiredApprovals = approvals_required`,
 *   `currentApprovals = approved_by.length`,
 *   `reviewers = approved_by.map(u => ({ login: u.user.username, state: "approved" }))`,
 *   `raw = original /approvals payload`.
 * - GitHub: `requiredApprovals = branch protection's required_approving_review_count` (best-effort),
 *   `currentApprovals = unique reviewers in APPROVED state`,
 *   `reviewers = pulls.listReviews + listRequestedReviewers merged`,
 *   `raw = { reviews, branchProtection? }`.
 */
export interface CodeReviewState {
  requiredApprovals: number;
  currentApprovals: number;
  reviewers: CodeReviewer[];
  /** Provider-specific payload for gates that need fields beyond the abstraction. */
  raw: unknown;
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
   * Live-fetch the current code review state of a merge request (GitLab) or
   * pull request (GitHub). Used by gates that verify human review at
   * evaluation time, bypassing whatever the subagent claimed in the
   * artifact. Optional because `LocalBareRepoProvider` has no notion of
   * code reviews — it throws when called.
   *
   * The `kind` discriminator on `args` selects the provider path; an
   * implementation MUST throw `unauthorized` (not crash) when called with a
   * `kind` it doesn't support — `GitlabProvider` rejects `kind: "github"`
   * and vice-versa.
   */
  getCodeReviewState?(args: CodeReviewReference): Promise<CodeReviewState>;
  /**
   * Merge `sourceBranch` into `targetBranch`. With `noFf: true` (default),
   * a merge commit is always created — useful for preserving the boundary
   * of a logical unit of work like a workflow run.
   *
   * Implementations:
   * - GitLab: creates a temporary MR + accepts with `squash: false`. The MR
   *   is visible in the GitLab UI but is closed immediately.
   * - LocalBareRepo: native git merge with --no-ff in a worktree.
   */
  mergeBranch(args: MergeBranchArgs): Promise<MergeBranchResult>;
  /**
   * Delete a branch from the remote / repo. Idempotent: deleting a
   * non-existent branch should not throw `not_found` (return without error).
   */
  deleteBranch(args: DeleteBranchArgs): Promise<void>;
}
