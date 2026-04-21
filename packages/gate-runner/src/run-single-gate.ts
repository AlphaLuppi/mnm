import ivm from "isolated-vm";
import {
  GATE_ERROR_CODES,
  gateOutputSchema,
  type GateOutput,
} from "@mnm/governed-workflows";
import { compileGateSource } from "./compile-gate.js";
import { CompiledCache } from "./compiled-cache.js";
import { classifyIsolateError } from "./classify-isolate-error.js";
import type {
  GateEvaluationResult,
  RunnerOptions,
  RunSingleGateArgs,
} from "./types.js";

/**
 * Dependencies injected into `runSingleGate`. Exposing them this way keeps
 * the function testable (fresh `CompiledCache` per test) and lets T5 / T6
 * wire in process-wide singletons without changing the signature.
 */
export interface RunSingleGateDeps {
  compiledCache: CompiledCache;
  options?: RunnerOptions;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_MB = 256;
const DEFAULT_RETRY_ON_SANDBOX_CRASH = true;

/**
 * Evaluate a single gate inside an `isolated-vm` isolate.
 *
 * Flow:
 *   1. Cache lookup (compiledCache) by (gitSha, gateSourcePath). Miss →
 *      `compileGateSource`.
 *   2. Spawn a fresh `ivm.Isolate` with the configured memory limit.
 *   3. Install a `globalThis.require` shim that maps
 *      `"@mnm/governed-workflows"` to a minimal `{ defineGate: fn => fn }`.
 *      Any other require target throws to surface misuse.
 *   4. Install `globalThis.module = { exports: {} }` + alias `exports`.
 *   5. Eval the compiled JS inside the isolate — populates
 *      `module.exports.default` with the gate function.
 *   6. Invoke `module.exports.default(ctx)` with the configured timeout.
 *   7. Parse the return value against `gateOutputSchema`.
 *   8. Always dispose the isolate in a finally block.
 *
 * Error → `GateErrorCode` mapping:
 *   - compile throws            → GATE_EXCEPTION (esbuild failure)
 *   - isolate init throws       → GATE_SANDBOX_CRASH
 *   - invoke timeout            → GATE_TIMEOUT (via classifyIsolateError)
 *   - invoke throws user-code   → GATE_EXCEPTION
 *   - invoke disposes isolate   → GATE_SANDBOX_CRASH (retry once, see below)
 *   - return schema-invalid     → GATE_INVALID_OUTPUT
 *
 * Retry semantics: if `retryOnSandboxCrash` is true (default), a single
 * `GATE_SANDBOX_CRASH` is retried once with a brand-new isolate. A second
 * crash surfaces as the final result — fail-closed.
 */
export async function runSingleGate(
  args: RunSingleGateArgs,
  deps: RunSingleGateDeps,
): Promise<GateEvaluationResult> {
  const timeoutMs = deps.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const memoryLimitMb = deps.options?.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const retryOnSandboxCrash =
    deps.options?.retryOnSandboxCrash ?? DEFAULT_RETRY_ON_SANDBOX_CRASH;

  const started = Date.now();
  const jsCode = await resolveCompiledJs(args, deps.compiledCache);

  let attempt = await attemptEval(jsCode, args, { timeoutMs, memoryLimitMb });
  if (
    !attempt.pass &&
    attempt.error_code === GATE_ERROR_CODES.GATE_SANDBOX_CRASH &&
    retryOnSandboxCrash
  ) {
    attempt = await attemptEval(jsCode, args, { timeoutMs, memoryLimitMb });
  }

  return stampResult(args, attempt, started);
}

async function resolveCompiledJs(
  args: RunSingleGateArgs,
  cache: CompiledCache,
): Promise<string> {
  const cached = cache.get(args.gitSha, args.gateSourcePath);
  if (cached !== undefined) return cached;
  const { jsCode } = await compileGateSource(args.source, args.gateSourcePath);
  cache.set(args.gitSha, args.gateSourcePath, jsCode);
  return jsCode;
}

interface AttemptResult {
  pass: boolean;
  report: string;
  error_code?: string;
  hints?: string[];
}

async function attemptEval(
  jsCode: string,
  args: RunSingleGateArgs,
  limits: { timeoutMs: number; memoryLimitMb: number },
): Promise<AttemptResult> {
  let isolate: ivm.Isolate | undefined;
  try {
    isolate = new ivm.Isolate({ memoryLimit: limits.memoryLimitMb });
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    // Bootstrap: stub require() + module/exports so the CJS bundle from
    // esbuild can install its default export on module.exports.default.
    const bootstrap = `
      globalThis.module = { exports: {} };
      globalThis.exports = globalThis.module.exports;
      globalThis.require = function (id) {
        if (id === "@mnm/governed-workflows") {
          return { defineGate: function (fn) { return fn; } };
        }
        throw new Error("require() not available in gate sandbox: " + id);
      };
    `;
    await (await isolate.compileScript(bootstrap)).run(context);

    // Evaluate the gate body. This populates module.exports.default.
    await (await isolate.compileScript(jsCode, {
      filename: args.gateSourcePath,
    })).run(context);

    // Invoker: pulls the default export, calls it with the supplied ctx,
    // and stringifies the return so we can copy it across the isolate
    // boundary without wrapping every nested value.
    const invokerSource = `
      globalThis.__invoke = async function (ctxJson) {
        const ctx = JSON.parse(ctxJson);
        const fn = globalThis.module && globalThis.module.exports && globalThis.module.exports.default;
        if (typeof fn !== "function") {
          throw new Error("gate source did not set module.exports.default to a function");
        }
        const result = await fn(ctx);
        return JSON.stringify(result === undefined ? null : result);
      };
    `;
    await (await isolate.compileScript(invokerSource)).run(context);

    const invoke = await jail.get("__invoke", { reference: true });
    const ctxJson = JSON.stringify(serializableContext(args));
    const returnedJson = (await invoke.apply(null, [ctxJson], {
      result: { promise: true, copy: true },
      timeout: limits.timeoutMs,
    })) as string;

    return validateOutput(returnedJson);
  } catch (cause) {
    const { errorCode, report } = classifyIsolateError(cause);
    return { pass: false, report, error_code: errorCode };
  } finally {
    if (isolate && !isolate.isDisposed) {
      try {
        isolate.dispose();
      } catch {
        // Already disposed by the runtime; swallow — any such error is
        // already captured by the catch above or is benign.
      }
    }
  }
}

function validateOutput(returnedJson: string): AttemptResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(returnedJson);
  } catch (cause) {
    return {
      pass: false,
      report: `Gate return could not be parsed as JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      error_code: GATE_ERROR_CODES.GATE_INVALID_OUTPUT,
    };
  }
  const schemaResult = gateOutputSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return {
      pass: false,
      report: `Gate output did not match schema: ${schemaResult.error.issues
        .map((i) => i.message)
        .join("; ")}`,
      error_code: GATE_ERROR_CODES.GATE_INVALID_OUTPUT,
    };
  }
  const out: GateOutput = schemaResult.data;
  return {
    pass: out.pass,
    report: out.report,
    error_code: out.error_code,
    hints: out.hints,
  };
}

function serializableContext(args: RunSingleGateArgs): unknown {
  // Strip non-serializable surfaces. `helpers` is `{}` in MVP (see
  // plan Task 4 + spec §6). Keep the same shape as GateContext so author
  // code reads identical properties.
  return {
    artifact: args.context.artifact,
    run: args.context.run,
    step: args.context.step,
    config: args.context.config,
    kind: args.kind,
    helpers: {},
  };
}

function stampResult(
  args: RunSingleGateArgs,
  attempt: AttemptResult,
  startedEpochMs: number,
): GateEvaluationResult {
  const evaluated_at = new Date().toISOString();
  const duration_ms = Date.now() - startedEpochMs;
  return {
    gate_id_in_json: args.gateItem.id,
    gate_git_sha: args.gitSha,
    gate_source_path: args.gateSourcePath,
    kind: args.kind,
    pass: attempt.pass,
    report: attempt.report,
    ...(attempt.error_code !== undefined ? { error_code: attempt.error_code } : {}),
    ...(attempt.hints !== undefined ? { hints: attempt.hints } : {}),
    evaluated_at,
    duration_ms,
  };
}
