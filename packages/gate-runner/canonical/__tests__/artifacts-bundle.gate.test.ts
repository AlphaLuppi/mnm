import { describe, it, expect } from "vitest";
import gate from "../artifacts-bundle.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "wf", git_tag: "v1", params: {} },
    step: { id: "s", previous_artifacts: {} },
    config: {},
    kind: "entry",
    helpers: {},
    ...overrides,
  };
}

describe("artifacts-bundle canonical gate", () => {
  it("passes when every required path is found across previous_artifacts", async () => {
    const result = await gate(
      ctx({
        step: {
          id: "build",
          previous_artifacts: {
            "prd-draft": { files: { "docs/prd.md": {} } },
            "design": {
              paths: ["docs/proto.fig", "docs/ux-guidelines.md"],
            },
          },
        },
        config: {
          required_paths: [
            "docs/prd.md",
            "docs/proto.fig",
            "docs/ux-guidelines.md",
          ],
        },
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.report).toContain("3");
  });

  it("fails with ARTIFACTS_BUNDLE_INCOMPLETE on first missing path", async () => {
    const result = await gate(
      ctx({
        step: {
          id: "build",
          previous_artifacts: {
            "prd-draft": { files: { "docs/prd.md": {} } },
          },
        },
        config: {
          required_paths: ["docs/prd.md", "docs/proto.fig"],
          hint: "Run the design step first",
        },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("ARTIFACTS_BUNDLE_INCOMPLETE");
    expect(result.report).toContain("docs/proto.fig");
    expect(result.hints).toEqual(["Run the design step first"]);
  });

  it("omits hints[] when no hint is configured", async () => {
    const result = await gate(
      ctx({
        config: { required_paths: ["missing.md"] },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.hints).toBeUndefined();
  });

  it("also looks in ctx.artifact", async () => {
    const result = await gate(
      ctx({
        kind: "exit",
        artifact: { paths: ["docs/prd.md"] },
        config: { required_paths: ["docs/prd.md"] },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("returns GATE_INVALID_CONFIG when required_paths is missing", async () => {
    const result = await gate(ctx({ config: {} }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("returns GATE_INVALID_CONFIG when required_paths is empty", async () => {
    const result = await gate(ctx({ config: { required_paths: [] } }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("returns GATE_INVALID_CONFIG when entries are non-strings", async () => {
    const result = await gate(
      ctx({ config: { required_paths: ["ok.md", 42] } }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });
});
