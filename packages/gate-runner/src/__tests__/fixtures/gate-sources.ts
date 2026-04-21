/**
 * Literal .gate.ts source strings used by the run-single-gate and
 * integration tests. Keeping them in one place (a) lets every test describe
 * behaviour by name instead of by copy-pasting the same 10 lines, and (b)
 * guarantees every test exercises the same `import { defineGate } from
 * "@mnm/governed-workflows"` bare specifier that the isolate shim has to
 * handle.
 */
export const PASSING = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a.greeting !== "string") {
    return { pass: false, report: "no greeting" };
  }
  return { pass: true, report: "ok: " + a.greeting };
});
`;

export const FAILING = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({
  pass: false,
  report: "always fail",
  error_code: "ALWAYS_FAIL",
  hints: ["try something else"],
}));
`;

export const THROWING = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => {
  throw new Error("boom from user gate");
});
`;

export const INFINITE_LOOP = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => {
  while (true) {}
});
`;

export const INVALID_OUTPUT_NON_OBJECT = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => "not an object");
`;

export const INVALID_OUTPUT_MISSING_PASS = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({ report: "ok" }));
`;

export const EXTRA_KEYS = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async () => ({
  pass: true,
  report: "ok",
  debug_note: "this should be rejected by strict mode",
}));
`;

export const CONFIG_ECHO = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => ({
  pass: true,
  report: "field=" + String(ctx.config.field) + ",kind=" + ctx.kind,
}));
`;

export const READS_PREVIOUS_ARTIFACT = `
import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const prev = ctx.step.previous_artifacts["greet"];
  if (!prev || typeof prev.greeting !== "string") {
    return { pass: false, report: "missing previous greet artifact" };
  }
  return { pass: true, report: "previous greeting: " + prev.greeting };
});
`;
