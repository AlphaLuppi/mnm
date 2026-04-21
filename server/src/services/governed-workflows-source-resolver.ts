import type { GitProvider, ShaCache } from "@mnm/git-provider";

// Constant providerId since T5 has one GitProvider per MCP service instance.
// Separated from sha so ShaCache's (providerId, path, sha) tuple is used
// as designed — collisions between two providers would only matter in a
// multi-provider setup (post-MVP).
const PROVIDER_ID = "mnm-workflows";

/**
 * Build a `resolveSource` closure compatible with `@mnm/gate-runner`'s
 * `RunGateBlockArgs.resolveSource`. The closure joins a gate's relative
 * source (as declared in workflow.json, e.g. `./gates/x.gate.ts`) with the
 * workflow directory, fetches the blob at the pinned git sha via the
 * provider, and memoises by (sha, path) via the supplied `ShaCache`.
 *
 * Security: the joined path MUST stay within the workflow's directory.
 * `../` traversal is rejected; absolute sources are rejected. Workflows
 * cannot pull gate code from other workflows or outside the repo — gates
 * are workflow-local in MVP (spec §3 "Pas de _shared/ cross-workflow").
 *
 * The cache is consumer-owned so the same `ShaCache` instance can be
 * shared across multiple workflows / runs in the MCP service (process
 * lifetime). Immutability of git shas means entries never need eviction
 * on content change — only on cache-size pressure, handled by ShaCache's
 * internal FIFO (see T3).
 */
export function makeResolveSource(args: {
  gitProvider: GitProvider;
  workflowGitSha: string;
  /** Repo-relative POSIX path to the workflow.json, e.g. "hello-world/workflow.json". */
  workflowRepoPath: string;
  shaCache: ShaCache;
}): (gateItemSource: string) => Promise<{ source: string; gateSourcePath: string }> {
  const { gitProvider, workflowGitSha, workflowRepoPath, shaCache } = args;

  // Directory of the workflow.json, e.g. "hello-world".
  const workflowDir = workflowRepoPath.includes("/")
    ? workflowRepoPath.slice(0, workflowRepoPath.lastIndexOf("/"))
    : "";

  return async (gateItemSource) => {
    if (gateItemSource.startsWith("/")) {
      throw new Error(`Gate source must be relative, got: ${gateItemSource}`);
    }

    // Strip a single leading "./" — everything after MUST stay within the
    // workflow dir. "./a/b" is fine; "../x" or "a/../../etc" is not.
    const normalised = gateItemSource.replace(/^\.\//, "");
    if (normalised.includes("..")) {
      throw new Error(`Gate source ${gateItemSource} escapes outside workflow directory`);
    }

    const gateSourcePath = workflowDir ? `${workflowDir}/${normalised}` : normalised;

    // ShaCache exposes get/set rather than getOrFetch — use them directly.
    const cached = shaCache.get(PROVIDER_ID, gateSourcePath, workflowGitSha);
    if (cached !== undefined) {
      return { source: cached, gateSourcePath };
    }

    const source = await gitProvider.fetchBlob({ path: gateSourcePath, ref: workflowGitSha });
    shaCache.set(PROVIDER_ID, gateSourcePath, workflowGitSha, source);

    return { source, gateSourcePath };
  };
}
