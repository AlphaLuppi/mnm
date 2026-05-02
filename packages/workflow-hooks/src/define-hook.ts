import type { HookContext, HookResult } from "./types.js";

/**
 * Authoring helper for `.hook.ts` files. Parity with `defineGate` in
 * `@mnm/governed-workflows`.
 *
 * At runtime it is a pure identity function — TypeScript uses it to infer
 * the shape of the hook's artifact + config without the author having to
 * annotate `HookContext` explicitly. The actual output validation happens
 * server-side in the runner via `hookResultSchema`.
 *
 * @example
 *   import { defineHook } from "@mnm/workflow-hooks";
 *
 *   export default defineHook<{ greeting: string }, { issueKey: string }>(
 *     async (ctx) => {
 *       await ctx.helpers.http({
 *         provider: "jira",
 *         method: "POST",
 *         path: `/rest/api/3/issue/${ctx.config.issueKey}/comment`,
 *         body: { body: ctx.artifact?.greeting },
 *       });
 *       return { ok: true };
 *     },
 *   );
 */
export function defineHook<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
>(
  fn: (
    ctx: HookContext<Artifact, Config>,
  ) => Promise<HookResult> | HookResult,
): (
  ctx: HookContext<Artifact, Config>,
) => Promise<HookResult> | HookResult {
  return fn;
}
