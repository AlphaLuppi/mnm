import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema } from "./workflow.js";

const minimalWorkflow = {
  apiVersion: "mnm/v1",
  kind: "GovernedWorkflow",
  name: "hello-world",
  steps: [{ id: "greet", agent: "greeter" }],
};

describe("workflowDefinitionSchema", () => {
  it("parses a minimal workflow", () => {
    const parsed = workflowDefinitionSchema.parse(minimalWorkflow);
    expect(parsed.name).toBe("hello-world");
    expect(parsed.variables).toEqual({});
    expect(parsed.steps).toHaveLength(1);
  });

  it("parses variables with required + optional typings", () => {
    const parsed = workflowDefinitionSchema.parse({
      ...minimalWorkflow,
      variables: {
        name: { type: "string", required: true },
        debug: { type: "boolean" },
      },
    });
    expect(parsed.variables.name).toEqual({ type: "string", required: true });
    expect(parsed.variables.debug).toEqual({ type: "boolean" });
  });

  it("rejects wrong apiVersion", () => {
    expect(() =>
      workflowDefinitionSchema.parse({ ...minimalWorkflow, apiVersion: "v0" }),
    ).toThrow();
  });

  it("rejects wrong kind", () => {
    expect(() =>
      workflowDefinitionSchema.parse({ ...minimalWorkflow, kind: "Pipeline" }),
    ).toThrow();
  });

  it("rejects duplicate step ids", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        ...minimalWorkflow,
        steps: [
          { id: "greet", agent: "greeter" },
          { id: "greet", agent: "shouter" },
        ],
      }),
    ).toThrow(/duplicate step id: greet/);
  });

  it("rejects a step depending on an unknown step", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        ...minimalWorkflow,
        steps: [
          {
            id: "shout",
            agent: "shouter",
            deps: ["nonexistent"],
          },
        ],
      }),
    ).toThrow(/unknown step 'nonexistent'/);
  });

  it("rejects an empty steps array", () => {
    expect(() =>
      workflowDefinitionSchema.parse({ ...minimalWorkflow, steps: [] }),
    ).toThrow();
  });

  it("rejects an unknown variable type", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        ...minimalWorkflow,
        variables: { x: { type: "date" } },
      }),
    ).toThrow();
  });

  it("accepts valid forward dependency (shout depends on greet)", () => {
    const parsed = workflowDefinitionSchema.parse({
      ...minimalWorkflow,
      steps: [
        { id: "greet", agent: "greeter" },
        { id: "shout", agent: "shouter", deps: ["greet"] },
      ],
    });
    expect(parsed.steps[1].deps).toEqual(["greet"]);
  });
});
