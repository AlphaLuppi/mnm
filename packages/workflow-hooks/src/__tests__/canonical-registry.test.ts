import { describe, it, expect } from "vitest";
import {
  loadCanonical,
  listCanonicalHooks,
  getCanonicalMetadata,
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

  // ─── P4-G: catalog metadata extraction ──────────────────────────────────
  // Verifies that authors using the new `defineHook({ ...metadata, execute })`
  // form surface description / phase / configSchema / defaultConfig /
  // requiredScopes through the registry, and that the catalog endpoint
  // can hydrate the picker UI without re-parsing the hook source.

  it("getCanonicalMetadata returns null for unknown hook", () => {
    expect(getCanonicalMetadata("does-not-exist")).toBeNull();
  });

  it("getCanonicalMetadata surfaces description / phase / configSchema / defaultConfig / requiredScopes", () => {
    const meta = getCanonicalMetadata("jira-comment-on-complete");
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe("jira-comment-on-complete");
    expect(meta!.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(meta!.phase).toBe("after_step");
    expect(typeof meta!.description).toBe("string");
    expect(meta!.description!.length).toBeGreaterThan(20);
    expect(meta!.requiredScopes).toEqual([
      "read:jira-work",
      "write:jira-work",
    ]);
    expect(meta!.configSchema).toBeDefined();
    expect(meta!.configSchema!.issueKey?.type).toBe("string");
    expect(meta!.defaultConfig).toBeDefined();
    expect(meta!.defaultConfig!.issueKey).toBe("PROJ-123");
  });

  it("listCanonicalHooks embeds metadata for every entry", () => {
    const list = listCanonicalHooks();
    expect(list).toHaveLength(4);
    for (const entry of list) {
      expect(entry.name).toBeTruthy();
      expect(entry.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(entry.description).toBeTruthy();
      expect([
        "before_run",
        "before_step",
        "after_step",
        "after_run",
      ]).toContain(entry.phase);
      expect(entry.configSchema).toBeDefined();
      expect(entry.defaultConfig).toBeDefined();
    }
  });

  it("clickup-import-task is correctly tagged as before_step with string[] taskIds", () => {
    const meta = getCanonicalMetadata("clickup-import-task");
    expect(meta!.phase).toBe("before_step");
    expect(meta!.configSchema!.taskIds?.type).toBe("string[]");
    expect(meta!.configSchema!.includeComments?.type).toBe("boolean");
  });
});
