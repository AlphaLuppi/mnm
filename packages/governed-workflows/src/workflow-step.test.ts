import { describe, expect, it } from "vitest";
import { workflowStepSchema } from "./workflow-step.js";

describe("workflowStepSchema", () => {
  it("parses a minimal step and defaults deps + prompt_context", () => {
    const parsed = workflowStepSchema.parse({
      id: "greet",
      agent: "greeter",
    });
    expect(parsed).toEqual({
      id: "greet",
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

  it("rejects a step without agent", () => {
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
});
