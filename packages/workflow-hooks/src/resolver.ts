import type { GitProvider } from "@mnm/git-provider";
import type { ResolvedHook } from "./types.js";

/**
 * Context required to resolve a `hook_ref` to its source code.
 *
 * - `companyId` is included for future canonical-override hooks (V1).
 * - `gitProvider` is the workflow repo's provider — used for both
 *   `local:` (loaded at the run's pinned sha) and `shared:` (loaded from
 *   the same provider but at branch `main`, since shared hooks are not
 *   pinned by the workflow run).
 * - `workflowGitSha` is the run's pinned sha; the resolver loads
 *   `hooks/<name>.hook.ts` from that ref for `local:` refs.
 *
 * `sharedRepoBranch` defaults to "main" but is configurable so multi-org
 * setups can pin shared hooks to a release branch.
 */
export interface ResolveHookRefCtx {
  companyId: string;
  gitProvider: GitProvider;
  /** Pinned sha for `local:` resolution. */
  workflowGitSha: string;
  /** Default "main" for `shared:` resolution. */
  sharedRepoBranch?: string;
  /**
   * Lookup function for canonical hooks. Implementations return the hook
   * source code as a string + a synthetic sha (e.g. the package version
   * or a build digest). Returning null surfaces an "unknown canonical
   * hook" error to the resolver.
   */
  loadCanonical: (name: string) => { code: string; sha: string } | null;
}

const HOOK_REF_REGEX = /^(canonical|shared|local):([a-z0-9-]+)$/;

/**
 * Resolve a hook ref string (`canonical:foo`, `shared:bar`, `local:baz`)
 * to its source code.
 *
 * Validation rules:
 *  - Must match `^(canonical|shared|local):[a-z0-9-]+$` — no uppercase,
 *    no underscores, no dots. Refs failing this regex throw.
 *  - For `canonical:`: looked up via `ctx.loadCanonical(name)`. Missing
 *    canonical → throws.
 *  - For `shared:`: `gitProvider.fetchBlob({ path: 'hooks/<name>.hook.ts',
 *    ref: ctx.sharedRepoBranch ?? 'main' })`.
 *  - For `local:`: `gitProvider.fetchBlob({ path: 'hooks/<name>.hook.ts',
 *    ref: ctx.workflowGitSha })`.
 *
 * The returned `ResolvedHook.sha` for `shared:` is the branch ref string
 * (since GitProvider.fetchBlob accepts branch names; the ShaCache layer
 * resolves the sha if memoization is desired). A future enhancement can
 * resolve to the actual commit sha for stricter pinning.
 */
export async function resolveHookRef(
  ref: string,
  ctx: ResolveHookRefCtx,
): Promise<ResolvedHook> {
  if (typeof ref !== "string" || ref.length === 0) {
    throw new Error(`resolveHookRef: ref must be a non-empty string`);
  }
  const match = HOOK_REF_REGEX.exec(ref);
  if (!match) {
    throw new Error(
      `resolveHookRef: ref '${ref}' does not match canonical|shared|local:[a-z0-9-]+`,
    );
  }
  const source = match[1] as "canonical" | "shared" | "local";
  const name = match[2]!;

  if (source === "canonical") {
    const loaded = ctx.loadCanonical(name);
    if (!loaded) {
      throw new Error(`resolveHookRef: unknown canonical hook '${name}'`);
    }
    return {
      source,
      name,
      code: loaded.code,
      sha: loaded.sha,
      sourcePath: `canonical/${name}.hook.ts`,
    };
  }

  // shared / local
  const branchOrSha =
    source === "shared" ? (ctx.sharedRepoBranch ?? "main") : ctx.workflowGitSha;
  const path = `hooks/${name}.hook.ts`;
  const code = await ctx.gitProvider.fetchBlob({ path, ref: branchOrSha });
  return {
    source,
    name,
    code,
    // For `shared:` the sha is the branch ref string until we resolve it
    // to a commit sha via gitProvider.resolveRef (V1 stricter pinning).
    sha: branchOrSha,
    sourcePath: path,
  };
}
