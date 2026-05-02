// Authoring helper (re-exported for convenience; @mnm/governed-workflows
// also re-exports `defineHook` so authors may import either)
export { defineHook } from "./define-hook.js";

// Types
export type {
  HookContext,
  HookPhase,
  HookResult,
  HookRunnerOptions,
  HookRunMeta,
  HookStepMeta,
  HostHelpers,
  HttpRequest,
  HttpResponse,
  LlmRequest,
  LlmResponse,
  FetchHandoffArgs,
  ConnectorTokenSource,
  ConnectorTokenResult,
  ResolvedHook,
} from "./types.js";

// Result schema (used by service tests + REST validation)
export {
  hookResultSchema,
  type HookResultParsed,
} from "./hook-result-schema.js";

// Compile + classify
export { compileHookSource, type CompileHookResult } from "./compile-hook.js";
export {
  classifyHookError,
  type ClassifiedHookError,
} from "./classify-hook-error.js";

// Runner
export {
  runHook,
  type HookEvaluationResult,
  type RunHookDeps,
} from "./runner.js";

// Host helpers
export {
  buildHostHelpers,
  HookHelperError,
  type BuildHostHelpersDeps,
  type BuildHostHelpersRuntimeCtx,
} from "./host-helpers.js";

// Resolver — implemented in T2.3 (this file ships in T2.2 to
// expose the package shape; tests in T2.3 will exercise it)
export { resolveHookRef, type ResolveHookRefCtx } from "./resolver.js";
