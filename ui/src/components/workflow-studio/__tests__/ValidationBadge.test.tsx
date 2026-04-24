/**
 * ValidationBadge tests — pure helper only. The rendered component is a
 * thin wrapper over the Sheet primitive, which isn't worth driving through
 * a DOM here (no React Testing Library installed).
 */
import { describe, it, expect } from "vitest";
import { validateWorkflowJson } from "../ValidationBadge";

describe("validateWorkflowJson", () => {
  it("returns parse-error for undefined input", () => {
    const r = validateWorkflowJson(undefined);
    expect(r.kind).toBe("parse-error");
  });

  it("returns parse-error for malformed JSON", () => {
    const r = validateWorkflowJson("{not json");
    expect(r.kind).toBe("parse-error");
    if (r.kind === "parse-error") {
      expect(r.parseMessage.length).toBeGreaterThan(0);
    }
  });

  it("returns schema-error with path/message for an invalid workflow", () => {
    const invalid = JSON.stringify({
      // missing `name`, missing `kind`, invalid steps
      steps: [],
    });
    const r = validateWorkflowJson(invalid);
    expect(r.kind).toBe("schema-error");
    if (r.kind === "schema-error") {
      expect(r.issues.length).toBeGreaterThan(0);
      for (const issue of r.issues) {
        expect(typeof issue.path).toBe("string");
        expect(typeof issue.message).toBe("string");
      }
    }
  });

  it("returns ok for a minimal valid workflow", () => {
    const valid = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "demo",
      description: "",
      variables: {},
      steps: [
        {
          id: "step-1",
          deps: [],
          agent: "claude_code",
          prompt_context: {},
        },
      ],
    });
    const r = validateWorkflowJson(valid);
    expect(r.kind).toBe("ok");
  });

  it("rejects an empty string with parse-error", () => {
    const r = validateWorkflowJson("");
    expect(r.kind).toBe("parse-error");
  });
});
