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
