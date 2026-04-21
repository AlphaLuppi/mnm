import { transform } from "esbuild";

export interface CompileGateResult {
  jsCode: string;
}

/**
 * Transform a `.gate.ts` source string into plain CommonJS JavaScript suitable
 * for evaluation inside an `isolated-vm` isolate.
 *
 * Intentionally uses `esbuild.transform` (single-file, no filesystem lookups)
 * rather than `esbuild.build`. Gates only import from
 * `@mnm/governed-workflows` which at runtime exports identity helpers — the
 * isolate supplies a shim via `globalThis.require` (see `runSingleGate`).
 *
 * On transform failure this raises an Error whose message prefixes
 * "compile failed" and includes the source path, so the caller can classify
 * it as `GATE_EXCEPTION` without leaking esbuild internals into the user-
 * facing report.
 */
export async function compileGateSource(
  source: string,
  gateSourcePath: string,
): Promise<CompileGateResult> {
  try {
    const result = await transform(source, {
      loader: "ts",
      format: "cjs",
      target: "es2022",
      sourcefile: gateSourcePath,
      legalComments: "none",
    });
    return { jsCode: result.code };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `compile failed for ${gateSourcePath}: ${message}`,
      { cause },
    );
  }
}
