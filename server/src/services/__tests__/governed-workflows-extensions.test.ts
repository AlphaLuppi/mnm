import { describe, it, expect } from "vitest";
import { computeNextTag } from "../governed-workflows-extensions.js";

// ── U2.2: computeNextTag — semver bump helper ────────────────────────────────

describe("computeNextTag", () => {
  it("bumps patch from an existing v-prefixed tag", () => {
    expect(computeNextTag("hello-world", ["hello-world/v1.2.3"])).toBe("hello-world/v1.2.4");
  });

  it("returns v1.0.0 when no matching tags exist", () => {
    expect(computeNextTag("hello-world", [])).toBe("hello-world/v1.0.0");
  });

  it("ignores tags for other workflows", () => {
    expect(computeNextTag("foo", ["bar/v5.0.0"])).toBe("foo/v1.0.0");
  });

  it("picks the highest semver among multiple tags", () => {
    expect(
      computeNextTag("wf", ["wf/v1.0.0", "wf/v2.1.3", "wf/v1.9.9"]),
    ).toBe("wf/v2.1.4");
  });

  it("handles a tag with patch=0", () => {
    expect(computeNextTag("x", ["x/v3.0.0"])).toBe("x/v3.0.1");
  });
});
