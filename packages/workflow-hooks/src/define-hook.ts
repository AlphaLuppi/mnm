import type {
  HookContext,
  HookDefinition,
  HookFunction,
  HookMetadata,
  HookResult,
} from "./types.js";

/**
 * Authoring helper for `.hook.ts` files. Parity with `defineGate` in
 * `@mnm/governed-workflows`.
 *
 * Two forms are accepted:
 *
 * 1. **Legacy form** — pass a function. Returns the function unchanged.
 *
 *    ```ts
 *    export default defineHook<{ greeting: string }, { issueKey: string }>(
 *      async (ctx) => { ... },
 *    );
 *    ```
 *
 * 2. **Metadata form (P4-G)** — pass a `HookDefinition` object that
 *    bundles metadata (description, phase, configSchema, defaultConfig,
 *    requiredScopes) alongside the `execute` function. The catalog
 *    endpoint introspects this metadata so the picker UI can render
 *    typed inputs and inline help text.
 *
 *    ```ts
 *    export default defineHook<Artifact, Config>({
 *      name: "jira-comment-on-complete",
 *      description: "Posts a comment on a Jira issue when a step completes.",
 *      phase: "after_step",
 *      requiredScopes: ["read:jira-work", "write:jira-work"],
 *      configSchema: {
 *        issueKey: { type: "string", required: true, description: "..." },
 *      },
 *      defaultConfig: { issueKey: "PROJ-123" },
 *      execute: async (ctx) => { ... },
 *    });
 *    ```
 *
 * In both cases the runtime value is a function (called by the runner
 * with a `HookContext`). When the metadata form is used, the metadata is
 * attached as a `metadata` property on the returned function so the
 * canonical registry can introspect it via host-side `vm` evaluation.
 * The runner does NOT inspect `metadata`; it only invokes the function —
 * the existing `globalThis.require` shim (updated in P4-G to unwrap
 * `{ execute }`) still works because the wrapped value remains callable.
 */
export function defineHook<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
>(
  fnOrDef:
    | ((
        ctx: HookContext<Artifact, Config>,
      ) => Promise<HookResult> | HookResult)
    | HookDefinition<Artifact, Config>,
): HookFunction<Artifact, Config> {
  if (typeof fnOrDef === "function") {
    // Legacy form — identity, no metadata attached.
    return fnOrDef as HookFunction<Artifact, Config>;
  }

  const { execute } = fnOrDef;
  const metadata: HookMetadata = {};
  if (fnOrDef.description !== undefined) metadata.description = fnOrDef.description;
  if (fnOrDef.phase !== undefined) metadata.phase = fnOrDef.phase;
  if (fnOrDef.requiredScopes !== undefined)
    metadata.requiredScopes = fnOrDef.requiredScopes;
  if (fnOrDef.configSchema !== undefined)
    metadata.configSchema = fnOrDef.configSchema;
  if (fnOrDef.defaultConfig !== undefined)
    metadata.defaultConfig = fnOrDef.defaultConfig;

  const wrapped = ((
    ctx: HookContext<Artifact, Config>,
  ): Promise<HookResult> | HookResult => execute(ctx)) as HookFunction<
    Artifact,
    Config
  >;
  wrapped.metadata = metadata;
  return wrapped;
}
