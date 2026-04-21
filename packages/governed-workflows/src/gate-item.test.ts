import { describe, expect, it } from "vitest";
import { gateItemSchema } from "./gate-item.js";

describe("gateItemSchema", () => {
  it("accepts a minimal item", () => {
    const parsed = gateItemSchema.parse({
      id: "greeting-ok",
      source: "./gates/greet-exit.gate.ts",
    });
    expect(parsed.id).toBe("greeting-ok");
    expect(parsed.source).toBe("./gates/greet-exit.gate.ts");
    expect(parsed.config).toBeUndefined();
  });

  it("accepts a parameterised item via config", () => {
    const parsed = gateItemSchema.parse({
      id: "has-greeting",
      source: "./gates/has-field.gate.ts",
      config: { field: "greeting", type: "string" },
    });
    expect(parsed.config).toEqual({ field: "greeting", type: "string" });
  });

  it("rejects an item without id", () => {
    expect(() =>
      gateItemSchema.parse({ source: "./gates/x.gate.ts" }),
    ).toThrow();
  });

  it("rejects an empty id", () => {
    expect(() =>
      gateItemSchema.parse({ id: "", source: "./gates/x.gate.ts" }),
    ).toThrow();
  });

  it("rejects an item without source", () => {
    expect(() => gateItemSchema.parse({ id: "x" })).toThrow();
  });

  it("rejects an empty source", () => {
    expect(() =>
      gateItemSchema.parse({ id: "x", source: "" }),
    ).toThrow();
  });
});
