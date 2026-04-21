import type { GateContext } from "./gate-context.js";
import type { GateOutput } from "./gate-output.js";

/**
 * Authoring helper for `.gate.ts` files in workflow repos.
 *
 * At runtime it is a pure identity function — TypeScript uses it to infer
 * the shape of the gate's artifact + config without the author having to
 * annotate `GateContext` explicitly. The actual output validation happens
 * server-side in the gate runner (T4).
 *
 * @example
 *   import { defineGate } from "@mnm/governed-workflows";
 *
 *   export default defineGate<{ greeting: string }>(async (ctx) => {
 *     if (!ctx.artifact?.greeting) {
 *       return { pass: false, report: "missing greeting" };
 *     }
 *     return { pass: true, report: "ok" };
 *   });
 */
export function defineGate<
  Artifact = unknown,
  Config extends Record<string, unknown> = Record<string, unknown>,
>(
  fn: (ctx: GateContext<Artifact, Config>) => Promise<GateOutput> | GateOutput,
): (ctx: GateContext<Artifact, Config>) => Promise<GateOutput> | GateOutput {
  return fn;
}
