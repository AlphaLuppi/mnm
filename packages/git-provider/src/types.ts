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
 */
export interface GitProvider {
  fetchBlob(args: FetchBlobArgs): Promise<string>;
  listTags(args?: ListTagsArgs): Promise<Tag[]>;
  resolveRef(args: ResolveRefArgs): Promise<string>;
  pathExists(args: PathExistsArgs): Promise<boolean>;
  commitFile(args: CommitFileArgs): Promise<CommitFileResult>;
}
