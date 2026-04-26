import { describe, it, expect } from "vitest";
import { resolveResourcePath } from "../git-resource-path.js";

describe("resolveResourcePath", () => {
  it("returns <name>/<file> when paths is undefined (legacy root-layout)", () => {
    expect(
      resolveResourcePath({}, "agent", "senior-dev", "agent.md"),
    ).toBe("senior-dev/agent.md");
  });

  it("returns <name>/<file> when paths.<type> is empty string (split-repo, type at repo root)", () => {
    expect(
      resolveResourcePath({ paths: { agents: "" } }, "agent", "senior-dev", "agent.md"),
    ).toBe("senior-dev/agent.md");
  });

  it("returns <prefix>/<name>/<file> when paths.<type> is set", () => {
    expect(
      resolveResourcePath({ paths: { agents: "agents" } }, "agent", "senior-dev", "agent.md"),
    ).toBe("agents/senior-dev/agent.md");
  });

  it("uses workflows prefix when resourceType is workflow", () => {
    expect(
      resolveResourcePath(
        { paths: { agents: "agents", workflows: "workflows" } },
        "workflow",
        "feature-dev",
        "workflow.json",
      ),
    ).toBe("workflows/feature-dev/workflow.json");
  });

  it("rejects a paths prefix containing '..' to prevent traversal in LocalBareRepoProvider", () => {
    expect(() =>
      resolveResourcePath(
        { paths: { agents: "../../etc" } },
        "agent",
        "x",
        "y",
      ),
    ).toThrow(/traversal|invalid path/i);
  });

  it("rejects an absolute paths prefix", () => {
    expect(() =>
      resolveResourcePath({ paths: { agents: "/etc" } }, "agent", "x", "y"),
    ).toThrow(/absolute|invalid path/i);
  });

  // Round 2 — MAJOR M-1: reject `..` in name AND file too. The `paths` prefix
  // is the only attacker-controlled segment we previously checked, but a
  // malicious agent name (saved to DB via create_agent without a server-side
  // check) could re-introduce traversal: `agents/../etc/passwd/agent.md`.
  it("rejects a name containing '..'", () => {
    expect(() =>
      resolveResourcePath({ paths: { agents: "agents" } }, "agent", "../etc/passwd", "agent.md"),
    ).toThrow(/traversal|invalid path/i);
  });

  it("rejects a file containing '..'", () => {
    expect(() =>
      resolveResourcePath({ paths: { agents: "agents" } }, "agent", "senior-dev", "../../../passwd"),
    ).toThrow(/traversal|invalid path/i);
  });
});
