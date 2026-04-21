import { describe, expect, it } from "vitest";
import { gateOutputSchema } from "./gate-output.js";

describe("gateOutputSchema", () => {
  it("accepts a minimal pass verdict", () => {
    const parsed = gateOutputSchema.parse({
      pass: true,
      report: "greeting ok",
    });
    expect(parsed).toEqual({ pass: true, report: "greeting ok" });
  });

  it("accepts a fail verdict with error_code and hints", () => {
    const parsed = gateOutputSchema.parse({
      pass: false,
      report: "missing greeting",
      error_code: "MISSING_GREETING",
      hints: ["Return {greeting: 'Hello, <name>!'} from the sub-agent"],
    });
    expect(parsed.pass).toBe(false);
    expect(parsed.hints).toHaveLength(1);
    expect(parsed.error_code).toBe("MISSING_GREETING");
  });

  it("rejects output without report", () => {
    expect(() => gateOutputSchema.parse({ pass: true })).toThrow();
  });

  it("rejects pass that is not boolean", () => {
    expect(() =>
      gateOutputSchema.parse({ pass: "yes", report: "nope" }),
    ).toThrow();
  });

  it("rejects empty report", () => {
    expect(() =>
      gateOutputSchema.parse({ pass: true, report: "" }),
    ).toThrow();
  });

  it("rejects hints containing empty strings", () => {
    expect(() =>
      gateOutputSchema.parse({
        pass: false,
        report: "fail",
        hints: [""],
      }),
    ).toThrow();
  });
});

describe("gateOutputSchema strict mode", () => {
  it("rejects unknown keys alongside valid fields", () => {
    const result = gateOutputSchema.safeParse({
      pass: true,
      report: "ok",
      sneaky_extra: "bad",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("still accepts the documented optional fields", () => {
    const result = gateOutputSchema.safeParse({
      pass: false,
      report: "missing greeting",
      error_code: "MISSING_GREETING",
      hints: ["Return {greeting} from the greeter sub-agent"],
    });
    expect(result.success).toBe(true);
  });
});
