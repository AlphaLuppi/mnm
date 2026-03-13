import simpleGit, { type SimpleGit, type StatusResult } from "simple-git";
import { getMnMRoot } from "@/lib/core/paths";

export interface GitRepoInfo {
  repoPath: string;
  branch: string;
  latestCommitSha: string;
  latestCommitMessage: string;
  remotes: { name: string; fetchUrl: string }[];
  status: {
    staged: number;
    unstaged: number;
    untracked: number;
  };
  isRepo: true;
}

export interface NoRepoInfo {
  isRepo: false;
  message: string;
}

export type RepoInfoResult = GitRepoInfo | NoRepoInfo;

function getGit(): SimpleGit {
  const repoRoot = getMnMRoot();
  return simpleGit(repoRoot);
}

export async function getRepoInfo(): Promise<RepoInfoResult> {
  const git = getGit();

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    return {
      isRepo: false,
      message:
        "No git repository detected. Please open a git-initialized project.",
    };
  }

  const [branchSummary, log, remotes, status] = await Promise.all([
    git.branch(),
    git.log({ maxCount: 1 }),
    git.getRemotes(true),
    git.status(),
  ]);

  const latestCommit = log.latest;

  return {
    isRepo: true,
    repoPath: getMnMRoot(),
    branch: branchSummary.current,
    latestCommitSha: latestCommit?.hash ?? "",
    latestCommitMessage: latestCommit?.message ?? "",
    remotes: remotes.map((r) => ({
      name: r.name,
      fetchUrl: r.refs.fetch ?? "",
    })),
    status: {
      staged: status.staged.length,
      unstaged: status.modified.length + status.deleted.length,
      untracked: status.not_added.length,
    },
  };
}

export async function getCurrentHead(): Promise<string> {
  const git = getGit();
  const log = await git.log({ maxCount: 1 });
  return log.latest?.hash ?? "";
}

export async function getFileContent(
  filePath: string,
  ref: string
): Promise<string> {
  const git = getGit();
  return git.show([`${ref}:${filePath}`]);
}

export async function getDiffForFiles(
  fromSha: string,
  toSha: string,
  files: string[]
): Promise<string> {
  const git = getGit();
  return git.diff([`${fromSha}..${toSha}`, "--", ...files]);
}

export async function getCommitLog(
  from?: string,
  to: string = "HEAD",
  maxCount: number = 100
): Promise<
  {
    hash: string;
    message: string;
    author: string;
    date: string;
  }[]
> {
  const git = getGit();

  if (from) {
    const log = await git.log({ from, to, maxCount });
    return log.all.map((c) => ({
      hash: c.hash,
      message: c.message,
      author: c.author_name,
      date: c.date,
    }));
  }

  const log = await git.log({ maxCount });
  return log.all.map((c) => ({
    hash: c.hash,
    message: c.message,
    author: c.author_name,
    date: c.date,
  }));
}

export async function getCommitDetail(sha: string): Promise<{
  hash: string;
  message: string;
  author: string;
  date: string;
  diff: string;
}> {
  const git = getGit();
  const log = await git.log({ maxCount: 1, from: `${sha}~1`, to: sha });
  const commit = log.latest;
  const diff = await git.show([sha, "--format="]);

  return {
    hash: commit?.hash ?? sha,
    message: commit?.message ?? "",
    author: commit?.author_name ?? "",
    date: commit?.date ?? "",
    diff,
  };
}

export { getGit };
