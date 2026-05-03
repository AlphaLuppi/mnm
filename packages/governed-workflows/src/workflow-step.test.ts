import { describe, expect, it } from "vitest";
import { workflowStepSchema } from "./workflow-step.js";

describe("workflowStepSchema", () => {
  it("parses a minimal step and defaults type/deps/prompt_context", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      agent: "greeter",
    });
    expect(parsed).toEqual({
      id: "greet",
      type: "agent",
      deps: [],
      agent: "greeter",
      prompt_context: {},
    });
  });

  it("parses a step with exit gates (single item)", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      deps: [],
      agent: "greeter",
      prompt_context: { name: "{{variables.name}}" },
      gates: {
        exit: [{ id: "greeting-ok", source: "./gates/greet-exit.gate.ts" }],
      },
    });
    expect(parsed.gates?.exit).toHaveLength(1);
    expect(parsed.prompt_context).toEqual({ name: "{{variables.name}}" });
  });

  it("parses a step with a nested parallel gate block", () => {
    const parsed = workflowStepSchema.parse({
      id: "shout",
      agent: "shouter",
      gates: {
        exit: [
          [
            { id: "uppercase-ok", source: "./gates/uppercase.gate.ts" },
            { id: "length-ok", source: "./gates/length.gate.ts" },
          ],
        ],
      },
    });
    const exit = parsed.gates?.exit;
    expect(exit).toBeDefined();
    expect(Array.isArray(exit?.[0])).toBe(true);
  });

  it("parses a step with both entry and exit gates", () => {
    const parsed = workflowStepSchema.parse({
      id: "publish",
      agent: "publisher",
      gates: {
        entry: [{ id: "env-ok", source: "./gates/env-ok.gate.ts" }],
        exit: [{ id: "deploy-ok", source: "./gates/deploy-ok.gate.ts" }],
      },
    });
    expect(parsed.gates?.entry).toHaveLength(1);
    expect(parsed.gates?.exit).toHaveLength(1);
  });

  it("accepts an unknown gate kind (extensibility)", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      agent: "greeter",
      gates: {
        "on-failure": [{ id: "notify", source: "./gates/notify.gate.ts" }],
      },
    });
    expect(parsed.gates?.["on-failure"]).toHaveLength(1);
  });

  it("rejects a step without id", () => {
    expect(() =>
      workflowStepSchema.parse({ agent: "greeter" }),
    ).toThrow();
  });

  it("rejects a step without agent (type defaults to agent)", () => {
    expect(() =>
      workflowStepSchema.parse({ id: "greet" }),
    ).toThrow();
  });

  it("rejects deps containing empty strings", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "greet",
        agent: "greeter",
        deps: [""],
      }),
    ).toThrow();
  });

  // ─── T5.1 — composite step type ────────────────────────────────────────────

  it("parses a composite step with valid uses and params", () => {
    const parsed = workflowStepSchema.parse({
      id: "design",
      type: "composite",
      uses: "workflows/design-functional@v1.2.3",
      params: { name: "{{variables.feature}}" },
    });
    expect(parsed.type).toBe("composite");
    expect(parsed.uses).toBe("workflows/design-functional@v1.2.3");
    expect(parsed.params).toEqual({ name: "{{variables.feature}}" });
  });

  it("accepts composite uses with branch ref (no v-prefix)", () => {
    const parsed = workflowStepSchema.parse({
      id: "build",
      type: "composite",
      uses: "workflows/build@main",
    });
    expect(parsed.uses).toBe("workflows/build@main");
  });

  it("accepts composite uses with sha-like ref", () => {
    const parsed = workflowStepSchema.parse({
      id: "deploy",
      type: "composite",
      uses: "workflows/deploy@abc123def4567890",
    });
    expect(parsed.uses).toBe("workflows/deploy@abc123def4567890");
  });

  it("rejects composite step without uses", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "design",
        type: "composite",
      }),
    ).toThrow(/uses/i);
  });

  it("rejects uses with wrong prefix (must be workflows/)", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "design",
        type: "composite",
        uses: "agents/design@v1",
      }),
    ).toThrow();
  });

  it("rejects uses without @<ref>", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "design",
        type: "composite",
        uses: "workflows/design",
      }),
    ).toThrow();
  });

  it("rejects uses with uppercase workflow name", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "design",
        type: "composite",
        uses: "workflows/DesignFn@v1",
      }),
    ).toThrow();
  });

  it("rejects agent step with uses", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "design",
        agent: "claude_code",
        uses: "workflows/x@v1",
      }),
    ).toThrow();
  });

  it("rejects agent step with params", () => {
    expect(() =>
      workflowStepSchema.parse({
        id: "design",
        agent: "claude_code",
        params: { foo: "bar" },
      }),
    ).toThrow();
  });
});
