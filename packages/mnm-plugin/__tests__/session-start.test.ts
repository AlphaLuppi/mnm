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

  it("emits a dashboard when state file is valid", async () => {
    const state: LastSession = {
      lastSyncedSha: "abc",
      syncedAt: "2026-04-22T08:00:00.000Z",
      agentNames: ["mnm--greeter", "mnm--shouter"],
      pendingRuns: 2,
      openIssues: 1,
      lastPluginVersion: "1.2.3",
    };
    writeFileSync(join(data, "last-session.json"), JSON.stringify(state));
    const out = await runSessionStart({ root, data });
    const ctx = out.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("2 workflows");
    expect(ctx).toContain("1 issue");
    expect(ctx).toContain("1.2.3");
  });

  it("surfaces a plugin-update hint when manifest version is newer than lastPluginVersion", async () => {
    const state: LastSession = {
      lastSyncedSha: "abc",
      syncedAt: "2026-04-22T08:00:00.000Z",
      agentNames: [],
      pendingRuns: 0,
      openIssues: 0,
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
