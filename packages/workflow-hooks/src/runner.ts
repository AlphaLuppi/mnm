import ivm from "isolated-vm";
import {
  HOOK_ERROR_CODES,
  type HookErrorCode,
} from "@mnm/governed-workflows";
import {
  CompiledCache,
  freezeDeep,
  installHelpers,
} from "@mnm/isolate-runtime";
import { compileHookSource } from "./compile-hook.js";
import { classifyHookError } from "./classify-hook-error.js";
import { hookResultSchema } from "./hook-result-schema.js";
import type {
  HookContext,
  HookResult,
  HookRunnerOptions,
  HostHelpers,
  ResolvedHook,
} from "./types.js";

/**
 * Defaults sized for hook helpers (HTTP / LLM) which are slower than gate
 * helpers. See `docs/superpowers/handoff-2026-05-02-T2-resume.md` §7 for
 * the rationale.
 */
const DEFAULT_HELPER_TIMEOUT_MS = 30_000;
const DEFAULT_OUTER_TIMEOUT_MS = 35_000;
const DEFAULT_MEMORY_LIMIT_MB = 256;
const DEFAULT_MAX_INJECT_BYTES = 64 * 1024;
const DEFAULT_RETRY_ON_SANDBOX_CRASH = true;

/**
 * DI surface for the runner. Tests inject a fresh `CompiledCache` (and
 * optionally an `attemptInvoke` stub for unit isolation). Production code
 * passes a process-wide cache from the service factory.
 */
export interface RunHookDeps {
  compiledCache?: CompiledCache;
  options?: HookRunnerOptions;
  /** Test-only seam — injected by unit tests to stub attemptInvoke. */
  attemptInvoke?: typeof attemptInvokeInternal;
}

/**
 * Synchronous failure shape returned by `runHook` when the hook never had
 * a chance to produce a `HookResult` (compile failure, sandbox crash,
 * timeout, schema invalid). Always carries an `error_code`. Mirrors the
 * `GateEvaluationResult` shape used by gate-runner.
 */
export interface HookEvaluationResult {
  ok: boolean;
  /** Pinned content sha, propagated from the resolver. */
  hook_git_sha: string;
  hook_source_path: string;
  hook_name: string;
  /** Phase the hook was running for (for audit / log). */
  phase: HookContext["phase"];
  /** Result if the hook returned a valid HookResult, otherwise undefined. */
  result?: HookResult;
  /** Error code if the runner short-circuited; absent on success. */
  error_code?: HookErrorCode;
  report: string;
  evaluated_at: string;
  duration_ms: number;
}

/**
 * Invoke a hook inside an `isolated-vm` isolate.
 *
 * Flow (parity with `runSingleGate`):
 *   1. Cache lookup (compiledCache) by `(sha, sourcePath)`. Miss →
 *      `compileHookSource`.
 *   2. Spawn a fresh `ivm.Isolate` with the configured memory limit.
 *   3. Install a `globalThis.require` shim that maps `defineHook` from
 *      both `@mnm/workflow-hooks` and `@mnm/governed-workflows` to the
 *      identity function. Other targets throw.
 *   4. Install `globalThis.module = { exports: {} }` + alias `exports`.
 *   5. Eval the compiled JS — populates `module.exports.default`.
 *   6. Pin a serialised `ctx` on `globalThis.ctx`. The runner deep-freezes
 *      the context BEFORE serialisation so any mutation attempt by the
 *      hook would surface as a TypeError inside the isolate.
 *   7. Wire async host helpers via `installHelpers` (timeout configured
 *      to 30 s, vs gates' 3 s).
 *   8. Invoke `module.exports.default(ctx)` with the outer timeout.
 *   9. Parse the return against `hookResultSchema`.
 *  10. Enforce `inject.context_md` size — `HOOK_INJECT_TOO_LARGE` if over.
 *  11. Always dispose the isolate in a finally block.
 *
 * Note on sandbox script execution: every `runIsolateScript` call below
 * goes through `ivm.Context` — sandboxed V8 code execution, NOT host-side
 * `eval()`. Same pattern as `@mnm/gate-runner/run-single-gate.ts`.
 *
 * Error → `HookErrorCode` mapping:
 *   - compile throws            → HOOK_EXCEPTION
 *   - isolate init throws       → HOOK_SANDBOX_CRASH
 *   - invoke timeout            → HOOK_TIMEOUT
 *   - invoke throws user-code   → HOOK_EXCEPTION
 *   - invoke disposes isolate   → HOOK_SANDBOX_CRASH (retry once)
 *   - return schema-invalid     → HOOK_INVALID_OUTPUT
 *   - inject > max bytes        → HOOK_INJECT_TOO_LARGE
 *
 * Retry semantics: identical to gate-runner. A single
 * `HOOK_SANDBOX_CRASH` is retried once with a brand-new isolate. A second
 * crash surfaces as final — fail-closed.
 */
export async function runHook(
  resolved: ResolvedHook,
  ctx: HookContext,
  helpers: HostHelpers,
  deps: RunHookDeps = {},
): Promise<HookEvaluationResult> {
  const opts = deps.options ?? {};
  const helperTimeoutMs = opts.helperTimeoutMs ?? DEFAULT_HELPER_TIMEOUT_MS;
  const outerTimeoutMs = opts.outerTimeoutMs ?? DEFAULT_OUTER_TIMEOUT_MS;
  const memoryLimitMb = opts.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  const maxInjectBytes = opts.maxInjectBytes ?? DEFAULT_MAX_INJECT_BYTES;
  const retryOnSandboxCrash =
    opts.retryOnSandboxCrash ?? DEFAULT_RETRY_ON_SANDBOX_CRASH;

  const started = Date.now();
  const cache = deps.compiledCache ?? new CompiledCache();
  const jsCode = await resolveCompiledJs(resolved, cache);
  const attemptInvoke = deps.attemptInvoke ?? attemptInvokeInternal;

  const limits: RunnerLimits = {
    helperTimeoutMs,
    outerTimeoutMs,
    memoryLimitMb,
    maxInjectBytes,
  };

  let attempt = await attemptInvoke(
    jsCode,
    resolved,
    ctx,
    helpers,
    limits,
  );
  if (
    !attempt.ok &&
    attempt.errorCode === HOOK_ERROR_CODES.HOOK_SANDBOX_CRASH &&
    retryOnSandboxCrash
  ) {
    attempt = await attemptInvoke(jsCode, resolved, ctx, helpers, limits);
  }

  return stampResult(resolved, ctx, attempt, started);
}

async function resolveCompiledJs(
  resolved: ResolvedHook,
  cache: CompiledCache,
): Promise<string> {
  const cached = cache.get(resolved.sha, resolved.sourcePath);
  if (cached !== undefined) return cached;
  const { jsCode } = await compileHookSource(
    resolved.code,
    resolved.sourcePath,
  );
  cache.set(resolved.sha, resolved.sourcePath, jsCode);
  return jsCode;
}

interface AttemptResult {
  ok: boolean;
  result?: HookResult;
  errorCode?: HookErrorCode;
  report: string;
}

interface RunnerLimits {
  helperTimeoutMs: number;
  outerTimeoutMs: number;
  memoryLimitMb: number;
  maxInjectBytes: number;
}

/**
 * Helper that compiles + runs a script INSIDE the isolate (sandbox V8
 * execution, not host eval). Centralised so the security boundary is
 * obvious: every script that crosses into the sandbox passes through
 * `ivm.Isolate.compileScript()` + `Script.run(context)`.
 */
async function runIsolateScript(
  isolate: ivm.Isolate,
  context: ivm.Context,
  source: string,
  filename?: string,
): Promise<void> {
  const compiled = filename
    ? await isolate.compileScript(source, { filename })
    : await isolate.compileScript(source);
  await compiled.run(context);
}

async function attemptInvokeInternal(
  jsCode: string,
  resolved: ResolvedHook,
  ctx: HookContext,
  helpers: HostHelpers,
  limits: RunnerLimits,
): Promise<AttemptResult> {
  let isolate: ivm.Isolate | undefined;
  try {
    isolate = new ivm.Isolate({ memoryLimit: limits.memoryLimitMb });
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    // Bootstrap: stub require() + module/exports so the CJS bundle from
    // esbuild can install its default export on module.exports.default.
    // Both `@mnm/workflow-hooks` and `@mnm/governed-workflows` resolve to
    // the same identity helper — authors may import either.
    await runIsolateScript(
      isolate,
      context,
      `
      globalThis.module = { exports: {} };
      globalThis.exports = globalThis.module.exports;
      globalThis.require = function (id) {
        if (id === "@mnm/workflow-hooks" || id === "@mnm/governed-workflows") {
          return {
            defineHook: function (fnOrDef) {
              if (typeof fnOrDef === "function") return fnOrDef;
              if (
                fnOrDef &&
                typeof fnOrDef === "object" &&
                typeof fnOrDef.execute === "function"
              ) {
                return fnOrDef.execute;
              }
              throw new Error(
                "defineHook: expected a function or { execute } object"
              );
            },
          };
        }
        throw new Error("require() not available in hook sandbox: " + id);
      };
    `,
    );

    // Evaluate the hook body. This populates module.exports.default.
    await runIsolateScript(isolate, context, jsCode, resolved.sourcePath);

    // Build the serialisable ctx. `helpers: {}` here — the actual proxies
    // are installed below by `installHelpers`. Deep-freeze the host-side
    // graph BEFORE the JSON round-trip so any subsequent host code holds
    // an immutable reference. The serialised copy crosses the boundary
    // structurally — JSON.parse inside the isolate creates a fresh
    // graph independent of the host.
    const serialisable = serializableContext(ctx);
    freezeDeep(serialisable);
    const ctxJson = JSON.stringify(serialisable);
    await runIsolateScript(
      isolate,
      context,
      `globalThis.ctx = JSON.parse(${JSON.stringify(ctxJson)});`,
    );

    // Wire async host helpers (HTTP / LLM / fetchHandoff). The helpers
    // map intentionally has NO `credential` entry — host-only by
    // design (decision-log §4.4). An isolate that probes
    // `ctx.helpers.credential` reads `undefined`.
    const helperFns: Record<string, (...args: unknown[]) => Promise<unknown>> =
      {
        http: (req: unknown) => helpers.http(req as never),
        llm: (req: unknown) => helpers.llm(req as never),
        fetchHandoff: (args: unknown) => helpers.fetchHandoff(args as never),
      };
    await installHelpers(context, jail, helperFns, {
      helperTimeoutMs: limits.helperTimeoutMs,
    });

    // Invoker: pulls the default export, calls it with the ctx already on
    // globalThis (set above), and stringifies the return so we can copy
    // it across the isolate boundary without wrapping every nested
    // value.
    await runIsolateScript(
      isolate,
      context,
      `
      globalThis.__invoke = async function () {
        const fn = globalThis.module && globalThis.module.exports && globalThis.module.exports.default;
        if (typeof fn !== "function") {
          throw new Error("hook source did not set module.exports.default to a function");
        }
        const result = await fn(globalThis.ctx);
        return JSON.stringify(result === undefined ? null : result);
      };
    `,
    );

    const invoke = await jail.get("__invoke", { reference: true });

    // Outer wall-clock timeout — wraps the inner ivm timeout from the
    // host side. Sized 1 s longer than the ivm timeout so the inner
    // (ivm) timeout always wins the race in the normal path; the host
    // setTimeout exists only to recover from an ivm Promise that never
    // resolves (extreme edge case). The host handle is cleared in a
    // finally block so it can never fire after the race is won and
    // produce an unhandled rejection.
    const ivmTimeoutMs = limits.outerTimeoutMs;
    const outerTimeoutMs = ivmTimeoutMs + 1000;
    const invokePromise = invoke.apply(null, [], {
      result: { promise: true, copy: true },
      timeout: ivmTimeoutMs,
    }) as Promise<string>;

    let outerHandle: ReturnType<typeof setTimeout> | undefined;
    const outerTimeout = new Promise<never>((_, reject) => {
      outerHandle = setTimeout(
        () => reject(new Error("Outer hook timeout")),
        outerTimeoutMs,
      );
    });
    let returnedJson: string;
    try {
      returnedJson = await Promise.race([invokePromise, outerTimeout]);
    } finally {
      if (outerHandle !== undefined) clearTimeout(outerHandle);
    }

    return validateOutput(returnedJson, limits.maxInjectBytes);
  } catch (cause) {
    const { errorCode, report } = classifyHookError(cause);
    return { ok: false, errorCode, report };
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

function validateOutput(
  returnedJson: string,
  maxInjectBytes: number,
): AttemptResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(returnedJson);
  } catch (cause) {
    return {
      ok: false,
      errorCode: HOOK_ERROR_CODES.HOOK_INVALID_OUTPUT,
      report: `Hook return could not be parsed as JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    };
  }
  const schemaResult = hookResultSchema.safeParse(parsed);
  if (!schemaResult.success) {
    return {
      ok: false,
      errorCode: HOOK_ERROR_CODES.HOOK_INVALID_OUTPUT,
      report: `Hook output did not match schema: ${schemaResult.error.issues
        .map((i) => i.message)
        .join("; ")}`,
    };
  }

  const result = schemaResult.data;

  // Enforce inject size — uses Buffer.byteLength to count UTF-8 bytes
  // (not JS string length, which would over-count surrogate pairs).
  // `?? ""` defends against a hook returning `inject: { context_md:
  // null }` after passing the schema (Buffer.byteLength throws on
  // non-string inputs, which would surface as HOOK_EXCEPTION rather
  // than the cleaner HOOK_INVALID_OUTPUT). Empty string yields 0
  // bytes — well below the cap.
  if (result.inject) {
    const bytes = Buffer.byteLength(result.inject.context_md ?? "", "utf8");
    if (bytes > maxInjectBytes) {
      return {
        ok: false,
        errorCode: HOOK_ERROR_CODES.HOOK_INJECT_TOO_LARGE,
        report: `Hook inject.context_md is ${bytes} bytes, max ${maxInjectBytes}`,
      };
    }
  }

  return {
    ok: result.ok,
    result,
    report:
      result.report ??
      (result.ok ? "Hook returned ok" : "Hook returned not-ok without report"),
  };
}

function serializableContext(ctx: HookContext): unknown {
  // Strip non-serialisable surfaces. `helpers: {}` matches the gate-runner
  // pattern — the proxies are wired by `installHelpers` after this seed.
  return {
    artifact: ctx.artifact,
    run: ctx.run,
    step: ctx.step,
    config: ctx.config,
    phase: ctx.phase,
    helpers: {},
  };
}

function stampResult(
  resolved: ResolvedHook,
  ctx: HookContext,
  attempt: AttemptResult,
  startedEpochMs: number,
): HookEvaluationResult {
  const evaluated_at = new Date().toISOString();
  const duration_ms = Date.now() - startedEpochMs;
  const base: HookEvaluationResult = {
    ok: attempt.ok,
    hook_git_sha: resolved.sha,
    hook_source_path: resolved.sourcePath,
    hook_name: resolved.name,
    phase: ctx.phase,
    report: attempt.report,
    evaluated_at,
    duration_ms,
  };
  if (attempt.result !== undefined) base.result = attempt.result;
  if (attempt.errorCode !== undefined) base.error_code = attempt.errorCode;
  return base;
}
