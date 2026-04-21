import { describe, it, expect } from "vitest";

describe("@mnm/gate-runner scaffold", () => {
  it("package exports an index barrel", async () => {
    const mod = await import("../index.js");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("isolated-vm native addon loads and evaluates sync", async () => {
    const ivm = await import("isolated-vm");
    const iso = new ivm.default.Isolate({ memoryLimit: 32 });
    const ctx = iso.createContextSync();
    expect(ctx.evalSync("40 + 2")).toBe(42);
    iso.dispose();
  });
});
