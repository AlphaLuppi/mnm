import { describe, it, expect } from "vitest";
import {
  loadCanonical,
  listCanonicalHooks,
} from "../canonical-registry.js";

describe("canonical-registry", () => {
  it("returns null for unknown hook names", () => {
    expect(loadCanonical("does-not-exist")).toBeNull();
  });

  it("loads jira-comment-on-complete from disk", () => {
    const entry = loadCanonical("jira-comment-on-complete");
    expect(entry).not.toBeNull();
    expect(entry?.code).toContain("defineHook");
    expect(entry?.code).toContain("jira-comment-on-complete");
    expect(entry?.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("loads all 4 canonical hooks", () => {
    expect(loadCanonical("jira-comment-on-complete")).not.toBeNull();
    expect(loadCanonical("jira-create-issue-on-complete")).not.toBeNull();
    expect(loadCanonical("clickup-import-task")).not.toBeNull();
    expect(loadCanonical("clickup-create-task-on-complete")).not.toBeNull();
  });

  it("returns the same sha on repeated calls (immutable)", () => {
    const a = loadCanonical("clickup-import-task");
    const b = loadCanonical("clickup-import-task");
    expect(a?.sha).toBe(b?.sha);
  });

  it("listCanonicalHooks returns all 4 sorted alphabetically with shas", () => {
    const list = listCanonicalHooks();
    expect(list.map((h) => h.name)).toEqual([
      "clickup-create-task-on-complete",
      "clickup-import-task",
      "jira-comment-on-complete",
      "jira-create-issue-on-complete",
    ]);
    for (const entry of list) {
      expect(entry.sha).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});
