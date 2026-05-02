import { transform } from "esbuild";

export interface CompileHookResult {
  jsCode: string;
}

/**
 * Transform a `.hook.ts` source string into plain CommonJS JavaScript
 * suitable for evaluation inside an `isolated-vm` isolate. Mirrors
 * `compileGateSource` in `@mnm/gate-runner`.
 *
 * Hooks are single-file: they import `defineHook` from
 * `@mnm/workflow-hooks` (or `@mnm/governed-workflows` for the re-export
 * path), and the isolate supplies a `globalThis.require` shim that
 * resolves both module ids to `{ defineHook: fn => fn }`.
 *
 * On transform failure this raises an Error whose message prefixes
 * "compile failed" and includes the source path, so the caller can
 * classify it as `HOOK_EXCEPTION` without leaking esbuild internals into
 * the user-facing report.
 */
export async function compileHookSource(
  source: string,
  hookSourcePath: string,
): Promise<CompileHookResult> {
  try {
    const result = await transform(source, {
      loader: "ts",
      format: "cjs",
      target: "es2022",
      sourcefile: hookSourcePath,
      legalComments: "none",
    });
    return { jsCode: result.code };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`compile failed for ${hookSourcePath}: ${message}`, {
      cause,
    });
  }
}
