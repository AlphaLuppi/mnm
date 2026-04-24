/**
 * Unit tests for the JSON Schema emitted from the zod workflow definition.
 * Asserts that zodToJsonSchema correctly captures field-level descriptions,
 * patterns, and structural shapes needed by the Monaco editor.
 */
import { describe, it, expect } from "vitest";
import { workflowJsonSchema } from "../workflow.jsonschema.js";

// zodToJsonSchema with `name` wraps in { $ref, definitions: { GovernedWorkflow: {...} } }
const rootDef = (workflowJsonSchema as Record<string, unknown>).definitions as Record<
  string,
  Record<string, unknown>
>;
const schema = rootDef?.GovernedWorkflow ?? workflowJsonSchema as Record<string, unknown>;
const props = schema.properties as Record<string, Record<string, unknown>>;
const stepItems = (props?.steps as Record<string, unknown>)?.items as Record<string, unknown>;
const stepProps = stepItems?.properties as Record<string, Record<string, unknown>>;

describe("workflowJsonSchema — structure", () => {
  it("is an object schema at root (or via $ref definition)", () => {
    expect(schema.type).toBe("object");
  });

  it("has required fields list including name, apiVersion, kind, steps", () => {
    const required = schema.required as string[];
    expect(required).toContain("name");
    expect(required).toContain("apiVersion");
    expect(required).toContain("kind");
    expect(required).toContain("steps");
  });
});

describe("workflowJsonSchema — name field", () => {
  it("has the correct pattern for name", () => {
    expect(props.name.pattern).toBe("^[a-z0-9][a-z0-9_-]*$");
  });

  it("has French description on name containing 'Nom unique'", () => {
    expect(props.name.description).toContain("Nom unique");
  });

  it("has minLength and maxLength on name", () => {
    expect(props.name.minLength).toBe(1);
    expect(props.name.maxLength).toBe(100);
  });
});

describe("workflowJsonSchema — steps field", () => {
  it("steps is an array type", () => {
    expect(props.steps.type).toBe("array");
  });

  it("steps.items is an object schema", () => {
    expect(stepItems?.type).toBe("object");
  });

  it("step.agent has a French description mentioning 'agent'", () => {
    expect(stepProps?.agent?.description).toContain("agent");
  });

  it("step.id has a French description", () => {
    expect(stepProps?.id?.description).toBeTruthy();
  });

  it("step.deps is an array type", () => {
    expect(stepProps?.deps?.type).toBe("array");
  });
});

describe("workflowJsonSchema — apiVersion + kind", () => {
  it("apiVersion has const mnm/v1", () => {
    expect(props.apiVersion.const).toBe("mnm/v1");
  });

  it("apiVersion has French description", () => {
    expect(props.apiVersion.description).toContain("mnm/v1");
  });

  it("kind has const GovernedWorkflow", () => {
    expect(props.kind.const).toBe("GovernedWorkflow");
  });
});

describe("workflowJsonSchema — re-exported from barrel", () => {
  it("can be imported from package index", async () => {
    const pkg = await import("../index.js");
    expect(pkg.workflowJsonSchema).toBeDefined();
    expect(typeof pkg.workflowJsonSchema).toBe("object");
  });
});
