import { describe, expect, it } from "vitest";
import { defineWorkflow } from "./define-workflow.js";

describe("defineWorkflow", () => {
  it("returns the parsed workflow with defaults applied", () => {
    const wf = defineWorkflow({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "test",
      steps: [{ id: "a", agent: "x" }],
    });
    expect(wf.name).toBe("test");
    expect(wf.variables).toEqual({});
    expect(wf.steps[0].deps).toEqual([]);
  });

  it("throws on missing apiVersion", () => {
    expect(() => defineWorkflow({ kind: "GovernedWorkflow" })).toThrow();
  });

  it("throws on unknown deps", () => {
    expect(() =>
      defineWorkflow({
        apiVersion: "mnm/v1",
        kind: "GovernedWorkflow",
        name: "test",
        steps: [{ id: "a", agent: "x", deps: ["nope"] }],
      }),
    ).toThrow(/unknown step 'nope'/);
  });
});
