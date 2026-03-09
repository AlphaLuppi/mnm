import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock simple-git and DB modules before import
vi.mock("simple-git", () => ({
  default: () => ({
    checkIsRepo: vi.fn().mockResolvedValue(true),
    branch: vi.fn().mockResolvedValue({ current: "main" }),
    log: vi.fn().mockResolvedValue({ latest: { hash: "abc123" }, all: [] }),
    getRemotes: vi.fn().mockResolvedValue([]),
    status: vi.fn().mockResolvedValue({ staged: [], modified: [], deleted: [], not_added: [] }),
    diffSummary: vi.fn().mockResolvedValue({ files: [{ file: "prd.md" }] }),
    diff: vi.fn().mockResolvedValue("@@ -1,1 +1,2 @@\n-old\n+new\n+added"),
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ all: () => [], get: () => undefined }), all: () => [] }) }),
    insert: () => ({ values: () => ({ run: vi.fn() }) }),
    update: () => ({ set: () => ({ where: () => ({ run: vi.fn() }) }) }),
  }),
}));

vi.mock("@/lib/core/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { detectChanges } from "@/lib/git/change-detector";

describe("detectChanges", () => {
  it("returns empty array when no important files", async () => {
    const changes = await detectChanges([], "aaa", "bbb");
    expect(changes).toHaveLength(0);
  });

  it("returns empty array when SHAs are the same", async () => {
    const changes = await detectChanges(["prd.md"], "aaa", "aaa");
    expect(changes).toHaveLength(0);
  });

  it("detects changes in important files", async () => {
    const changes = await detectChanges(["prd.md"], "aaa", "bbb");
    expect(changes).toHaveLength(1);
    expect(changes[0].filePath).toBe("prd.md");
    expect(changes[0].oldCommitSha).toBe("aaa");
    expect(changes[0].newCommitSha).toBe("bbb");
  });

  it("skips non-important files", async () => {
    const changes = await detectChanges(["other.md"], "aaa", "bbb");
    expect(changes).toHaveLength(0);
  });
});
