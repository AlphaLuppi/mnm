import { describe, it, expect } from "vitest";
import gate from "../artifact-exists.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "wf", git_tag: "v1", params: {} },
    step: { id: "s", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

describe("artifact-exists canonical gate", () => {
  it("passes when path is listed in artifact.files", async () => {
    const result = await gate(
      ctx({
        artifact: { files: { "docs/prd.md": { bytes: 1200 } } },
        config: { path: "docs/prd.md" },
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.report).toContain("docs/prd.md");
    expect(result.report).toContain("1200");
  });

  it("passes when path is listed in artifact.paths", async () => {
    const result = await gate(
      ctx({
        artifact: { paths: ["docs/prd.md", "docs/spec.md"] },
        config: { path: "docs/spec.md" },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("enforces min_bytes and fails with ARTIFACT_TOO_SMALL", async () => {
    const result = await gate(
      ctx({
        artifact: { files: { "docs/prd.md": { bytes: 100 } } },
        config: { path: "docs/prd.md", min_bytes: 500 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("ARTIFACT_TOO_SMALL");
    expect(result.report).toContain("100");
    expect(result.report).toContain("500");
  });

  it("passes when min_bytes is satisfied", async () => {
    const result = await gate(
      ctx({
        artifact: { files: { "docs/prd.md": { bytes: 600 } } },
        config: { path: "docs/prd.md", min_bytes: 500 },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("falls back to previous_artifacts when current artifact lacks the path", async () => {
    const result = await gate(
      ctx({
        artifact: { files: {} },
        step: {
          id: "s",
          previous_artifacts: {
            "prd-draft": { files: { "docs/prd.md": { bytes: 800 } } },
          },
        },
        config: { path: "docs/prd.md" },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("fails with ARTIFACT_MISSING when path is nowhere", async () => {
    const result = await gate(
      ctx({
        artifact: { files: { "other.md": { bytes: 10 } } },
        config: { path: "docs/prd.md" },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("ARTIFACT_MISSING");
  });

  it("returns GATE_INVALID_CONFIG when path is missing", async () => {
    const result = await gate(ctx({ config: {} }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("returns GATE_INVALID_CONFIG when path is not a string", async () => {
    const result = await gate(ctx({ config: { path: 42 } }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });
});
