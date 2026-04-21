import { describe, expect, it } from "vitest";
import { gateBlockSchema } from "./gate-block.js";

describe("gateBlockSchema", () => {
  it("accepts a single sequential item", () => {
    const parsed = gateBlockSchema.parse([
      { id: "a", source: "./gates/a.gate.ts" },
    ]);
    expect(parsed).toHaveLength(1);
  });

  it("accepts an inner array as a parallel bag", () => {
    const parsed = gateBlockSchema.parse([
      [
        { id: "a", source: "./gates/a.gate.ts" },
        { id: "b", source: "./gates/b.gate.ts" },
      ],
    ]);
    expect(Array.isArray(parsed[0])).toBe(true);
  });

  it("accepts a mix of sequential and parallel entries", () => {
    const parsed = gateBlockSchema.parse([
      [
        { id: "a", source: "./gates/a.gate.ts" },
        { id: "b", source: "./gates/b.gate.ts" },
      ],
      { id: "c", source: "./gates/c.gate.ts" },
      [
        { id: "d", source: "./gates/d.gate.ts" },
        { id: "e", source: "./gates/e.gate.ts" },
      ],
    ]);
    expect(parsed).toHaveLength(3);
    expect(Array.isArray(parsed[0])).toBe(true);
    expect(Array.isArray(parsed[1])).toBe(false);
    expect(Array.isArray(parsed[2])).toBe(true);
  });

  it("accepts an empty block (zero gates = always pass)", () => {
    const parsed = gateBlockSchema.parse([]);
    expect(parsed).toEqual([]);
  });

  it("rejects nested-of-nested arrays", () => {
    expect(() =>
      gateBlockSchema.parse([[[{ id: "a", source: "./a.gate.ts" }]]]),
    ).toThrow();
  });

  it("rejects an empty parallel bag", () => {
    expect(() => gateBlockSchema.parse([[]])).toThrow();
  });

  it("rejects an invalid item inside a parallel bag", () => {
    expect(() =>
      gateBlockSchema.parse([[{ id: "a" /* missing source */ }]]),
    ).toThrow();
  });

  it("rejects a top-level non-array", () => {
    expect(() =>
      gateBlockSchema.parse({ id: "a", source: "./a.gate.ts" }),
    ).toThrow();
  });
});
