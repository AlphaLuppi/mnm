import { describe, it, expect } from "vitest";

describe("@mnm/git-provider scaffold", () => {
  it("package exports an index barrel", async () => {
    const mod = await import("../index.js");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
