/**
 * Unit tests for GovernedWorkflowEditor — logic layer.
 *
 * Avoids React rendering (no jsdom canvas for Monaco). Tests the validation
 * helper and query-key contract that the page depends on.
 */
import { describe, it, expect } from "vitest";
import { workflowDefinitionSchema } from "@mnm/governed-workflows";
import { queryKeys } from "../../lib/queryKeys.js";

// Mirror of the validation helper in GovernedWorkflowEditor
interface ValidationError {
  path: string;
  message: string;
}

function validateDefinition(
  raw: string,
): { parsed: unknown | null; errors: ValidationError[] } {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return {
      parsed: null,
      errors: [{ path: "JSON", message: "JSON invalide — vérifiez la syntaxe." }],
    };
  }

  const result = workflowDefinitionSchema.safeParse(obj);
  if (result.success) {
    return { parsed: result.data, errors: [] };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
  return { parsed: null, errors };
}

describe("GovernedWorkflowEditor — validateDefinition", () => {
  it("returns errors for non-JSON input", () => {
    const { parsed, errors } = validateDefinition("not json");
    expect(parsed).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("JSON");
  });

  it("returns errors for JSON that fails schema", () => {
    const { parsed, errors } = validateDefinition(JSON.stringify({ bad: true }));
    expect(parsed).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns parsed definition for valid minimal workflow", () => {
    const valid = {
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "hello-world",
      steps: [
        {
          id: "step-1",
          agent: "my-agent",
        },
      ],
    };
    const { parsed, errors } = validateDefinition(JSON.stringify(valid));
    expect(errors).toHaveLength(0);
    expect(parsed).not.toBeNull();
  });

  it("saveValid is false when parsed is null", () => {
    const { parsed } = validateDefinition("bad json");
    const commitMessage = "my commit";
    const saveValid = parsed !== null && commitMessage.trim().length > 0;
    expect(saveValid).toBe(false);
  });

  it("saveValid is false when commitMessage is empty", () => {
    const valid = {
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "hello",
      steps: [{ id: "s1", agent: "my-agent" }],
    };
    const { parsed } = validateDefinition(JSON.stringify(valid));
    const commitMessage = "";
    const saveValid = parsed !== null && commitMessage.trim().length > 0;
    expect(saveValid).toBe(false);
  });
});

describe("GovernedWorkflowEditor — query key contract", () => {
  it("detail key includes companyId and name", () => {
    const key = queryKeys.governedWorkflows.detail("company-1", "my-wf");
    expect(key).toContain("company-1");
    expect(key).toContain("my-wf");
  });
});
