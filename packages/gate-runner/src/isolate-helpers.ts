import ivm from "isolated-vm";

/**
 * Bridge async host helpers into a V8 isolate. For each helper `foo`:
 *  - The host function is wrapped in an `ivm.Reference` (new reference per
 *    install; do not share across isolates).
 *  - A single `__mnm_call_helper(name, args)` global is set on the isolate,
 *    which receives the helper name + args (both `copy:true`) and dispatches
 *    to the right host function. This avoids per-helper Reference leakage:
 *    the isolate only ever sees one dispatcher.
 *  - A small JS prelude is evaluated inside the isolate that creates a
 *    `ctx.helpers.<name> = async (...args) => { ... }` proxy for each name.
 *    `ctx` is assumed to already exist on `globalThis` (the runner's ctx
 *    injection step creates it — see `run-single-gate.ts`). The fallback
 *    `globalThis.ctx = {}` lets unit tests seed helpers without pre-populating
 *    ctx; the real run-single-gate.ts path always sets ctx first.
 *
 * Timeout: each helper invocation has its own inner timeout (3 s) enforced
 * by a wall-clock `Promise.race` in the dispatcher. The outer gate timeout
 * (RunnerOptions.timeoutMs, default 5 s) still wraps the whole gate call, so
 * a fast helper leaves room for gate logic, while a hung helper still
 * terminates well inside the outer budget.
 *
 * Marshalling: args are passed to the dispatcher `copy:true` (deep clone).
 * Return values come back `copy:true`. Exceptions propagate as plain Error
 * objects — the isolated-vm bridge stringifies them on the host side.
 *
 * Marshalling note: args are passed to the dispatcher `copy:true` (deep
 * clone via isolated-vm's structured-clone). Values that isolated-vm's
 * copy rejects (functions, some complex objects) surface as clone errors
 * in the isolate; values it accepts (including circular references via
 * `[Circular]` markers) pass through. The bridge does NOT enforce
 * additional JSON-serialisability — that would over-constrain gate
 * authors. Callers who need stricter validation should do it host-side
 * before invoking the helper.
 *
 * Failure modes (all mapped by `classifyIsolateError` in the runner):
 *  - Host throws -> rejected promise inside isolate -> propagates to gate
 *    code as a thrown Error with the host message.
 *  - Host exceeds 3 s -> wall-clock timeout fires -> same path.
 *  - Arg is not cloneable by ivm (e.g. function) -> clone error in the
 *    isolate before the host function runs -> surfaces as a gate exception.
 */
export async function installHelpers(
  context: ivm.Context,
  jail: ivm.Reference<Record<string, unknown>>,
  helpers: Record<string, (...args: any[]) => Promise<any>>,
): Promise<void> {
  const dispatcher = async (name: string, args: unknown[]): Promise<unknown> => {
    const fn = helpers[name];
    if (!fn) {
      throw new Error(`Unknown gate helper: ${name}`);
    }
    // Enforce 3 s wall-clock timeout independently of the isolate CPU budget.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Helper call timed out.")), 3000),
    );
    return await Promise.race([fn(...args), timeoutPromise]);
  };

  // Pass the dispatcher reference into the isolate under a non-colliding
  // name. Prefix `__mnm_` so authors can't accidentally shadow it.
  await jail.set(
    "__mnm_call_helper",
    new ivm.Reference(dispatcher),
  );

  // Build the JS prelude that creates `ctx.helpers.<name>` proxies. Each
  // proxy forwards to the dispatcher with a 3 s timeout. `copy:true` on
  // both sides ensures no references cross the sandbox boundary.
  const names = Object.keys(helpers);
  const prelude = `
    if (typeof ctx === "undefined") {
      globalThis.ctx = {};
    }
    ctx.helpers = ctx.helpers || {};
    ${names
      .map(
        (n) => `
    ctx.helpers[${JSON.stringify(n)}] = async (...args) => {
      return await __mnm_call_helper.apply(
        null,
        [${JSON.stringify(n)}, args],
        { arguments: { copy: true }, result: { promise: true, copy: true }, timeout: 3000 }
      );
    };`,
      )
      .join("")}
  `;

  await context.eval(prelude);
}
