/**
 * Authoring helper for `.hook.ts` files. This is a thin re-export of
 * `@mnm/workflow-hooks/define-hook` so authors can import either module
 * (`@mnm/governed-workflows` for parity with `defineGate`, or
 * `@mnm/workflow-hooks` for proximity to the runner types).
 *
 * Both module ids resolve to the same identity helper inside the
 * isolate's `require()` shim (see `runHook` bootstrap in
 * `@mnm/workflow-hooks/runner.ts`).
 *
 * Note: we intentionally do NOT re-export the `HookContext` /
 * `HookResult` types from `@mnm/workflow-hooks` here — adding a
 * peer-dependency from `@mnm/governed-workflows` to
 * `@mnm/workflow-hooks` would create a cycle (workflow-hooks already
 * depends on governed-workflows for the error codes). Authors who need
 * the typed context should import from `@mnm/workflow-hooks` directly.
 */

// Local identity definition (mirrors defineGate). Generic params are
// kept open so authors don't need to import HookContext to type their
// hook function. The runner enforces the runtime shape via
// `hookResultSchema`.
export function defineHook<
  Ctx extends { phase: string; helpers: object } = {
    phase: string;
    helpers: object;
  },
  Result extends { ok: boolean } = { ok: boolean },
>(fn: (ctx: Ctx) => Promise<Result> | Result): (ctx: Ctx) => Promise<Result> | Result {
  return fn;
}
