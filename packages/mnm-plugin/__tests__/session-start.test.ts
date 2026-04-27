import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSessionStart } from "../src/session-start.js";
import type { LastSession } from "../src/types.js";

describe("runSessionStart", () => {
  let root: string;
  let data: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mnm-plugin-root-"));
    data = mkdtempSync(join(tmpdir(), "mnm-plugin-data-"));
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "mnm", version: "1.2.3" }),
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(data, { recursive: true, force: true });
  });

  it("emits a first-run message when no state file exists", async () => {
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(out.hookSpecificOutput.additionalContext).toContain("First run");
    expect(out.hookSpecificOutput.additionalContext).toContain("1.2.3");
    expect(out.hookSpecificOutput.additionalContext).toContain("Set me up for MnM");
  });

  it("emits an empty steady-state context when state file is valid and version matches", async () => {
    const state: LastSession = {
      lastPluginVersion: "1.2.3",
    };
    writeFileSync(join(data, "last-session.json"), JSON.stringify(state));
    const out = await runSessionStart({ root, data });
    const ctx = out.hookSpecificOutput.additionalContext;
    // No fake counters: the cache cannot tell the truth about live DB state,
    // so the hook stays silent in steady state. Use list_governed_workflow_runs
    // to discover active runs.
    expect(ctx).toBe("");
  });

  it("ignores legacy counter fields without crashing (backward compat)", async () => {
    // Older caches written by previous plugin versions carry pendingRuns,
    // openIssues, syncedAt, agentNames, lastSyncedSha. The hook MUST treat
    // these as unknown extras and never surface them.
    const legacy = {
      lastSyncedSha: "abc",
      syncedAt: "2026-04-22T08:00:00.000Z",
      agentNames: ["mnm--greeter"],
      pendingRuns: 99,
      openIssues: 42,
      lastPluginVersion: "1.2.3",
    };
    writeFileSync(join(data, "last-session.json"), JSON.stringify(legacy));
    const out = await runSessionStart({ root, data });
    const ctx = out.hookSpecificOutput.additionalContext;
    expect(ctx).not.toContain("99");
    expect(ctx).not.toContain("42");
    expect(ctx).not.toMatch(/workflows? in progress/);
    expect(ctx).not.toMatch(/issues? pending/);
  });

  it("surfaces a plugin-update hint when manifest version is newer than lastPluginVersion", async () => {
    const state: LastSession = {
      lastPluginVersion: "1.0.0",
    };
    writeFileSync(join(data, "last-session.json"), JSON.stringify(state));
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.additionalContext).toContain("updated");
  });

  it("falls back to first-run message when state JSON is corrupted", async () => {
    writeFileSync(join(data, "last-session.json"), "{ not json");
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.additionalContext).toContain("First run");
  });

  it("returns empty context when manifest is unreadable (fail-open)", async () => {
    rmSync(join(root, ".claude-plugin"), { recursive: true, force: true });
    const out = await runSessionStart({ root, data });
    expect(out.hookSpecificOutput.additionalContext).toBe("");
  });
});
