import { describe, it, expect } from "vitest";
import { compileGateSource } from "../compile-gate.js";

const GOOD_SOURCE = `
import { defineGate } from "@mnm/governed-workflows";
import type { GateContext } from "@mnm/governed-workflows";

export default defineGate(async (ctx: GateContext) => {
  const a = ctx.artifact as { greeting?: string } | undefined;
  if (!a || typeof a.greeting !== "string") {
    return { pass: false, report: "no greeting" };
  }
  return { pass: true, report: "ok: " + a.greeting };
});
`;

describe("compileGateSource", () => {
  it("strips TypeScript types and emits CJS", async () => {
    const { jsCode } = await compileGateSource(GOOD_SOURCE, "gates/x.gate.ts");
    expect(jsCode).not.toContain(": GateContext");
    expect(jsCode).not.toContain("as { greeting?: string }");
    expect(jsCode).toContain("module.exports");
  });

  it("preserves the require('@mnm/governed-workflows') call so the isolate shim can handle it", async () => {
    const { jsCode } = await compileGateSource(GOOD_SOURCE, "gates/x.gate.ts");
    expect(jsCode).toContain('require("@mnm/governed-workflows")');
  });

  it("throws GitProviderError-style error on syntactically invalid TS", async () => {
    await expect(
      compileGateSource("export default function( syntax error {", "gates/bad.gate.ts"),
    ).rejects.toThrow(/compile/i);
  });

  it("stamps the source file name for better error messages", async () => {
    try {
      await compileGateSource("export default function( {", "gates/bad.gate.ts");
      throw new Error("expected compile to throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("gates/bad.gate.ts");
    }
  });
});
