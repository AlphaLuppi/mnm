import { describe, it, expect } from "vitest";
import gate from "../step-succeeded.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "wf", git_tag: "v1", params: {} },
    step: { id: "next", previous_artifacts: {} },
    config: {},
    kind: "entry",
    helpers: {},
    ...overrides,
  };
}

describe("step-succeeded canonical gate", () => {
  it("passes when the named step has a recorded artifact", async () => {
    const result = await gate(
      ctx({
        step: {
          id: "next",
          previous_artifacts: { "prd-draft": { files: {} } },
        },
        config: { step: "prd-draft" },
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.report).toContain("prd-draft");
  });

  it("passes even when the artifact is an empty object", async () => {
    const result = await gate(
      ctx({
        step: { id: "next", previous_artifacts: { "stepA": {} } },
        config: { step: "stepA" },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("fails with STEP_NOT_SUCCEEDED when the step id is absent", async () => {
    const result = await gate(
      ctx({
        step: {
          id: "next",
          previous_artifacts: { "other-step": {} },
        },
        config: { step: "prd-draft" },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("STEP_NOT_SUCCEEDED");
    expect(result.report).toContain("prd-draft");
    expect(result.hints?.[0]).toContain("prd-draft");
  });

  it("fails with STEP_NOT_SUCCEEDED when the value is explicitly undefined", async () => {
    const result = await gate(
      ctx({
        step: {
          id: "next",
          previous_artifacts: { "prd-draft": undefined as unknown as object },
        },
        config: { step: "prd-draft" },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("STEP_NOT_SUCCEEDED");
  });

  it("returns GATE_INVALID_CONFIG when step is missing", async () => {
    const result = await gate(ctx({ config: {} }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("returns GATE_INVALID_CONFIG when step is not a string", async () => {
    const result = await gate(ctx({ config: { step: 123 } }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });
});
