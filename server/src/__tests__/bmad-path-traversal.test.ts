import { describe, expect, it } from "vitest";

describe("bmad path traversal validation", () => {
  function isPathSafe(filePath: string): boolean {
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return false;
    }
    return true;
  }

  it("rejects paths containing '..'", () => {
    expect(isPathSafe("../etc/passwd")).toBe(false);
    expect(isPathSafe("foo/../../bar")).toBe(false);
    expect(isPathSafe("..")).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(isPathSafe("/etc/passwd")).toBe(false);
    expect(isPathSafe("/foo/bar")).toBe(false);
  });

  it("accepts valid relative paths", () => {
    expect(isPathSafe("planning-artifacts/product-brief.md")).toBe(true);
    expect(isPathSafe("implementation-artifacts/1-1-story.md")).toBe(true);
  });
});
