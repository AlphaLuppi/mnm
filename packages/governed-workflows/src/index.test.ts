import { describe, expect, it } from "vitest";
import * as pkg from "./index.js";

describe("public barrel", () => {
  it("exposes the expected runtime exports", () => {
    const exported = Object.keys(pkg).sort();
    expect(exported).toEqual([
      "GATE_ERROR_CODES",
      "WORKFLOW_ERROR_CODES",
      "defineGate",
      "defineWorkflow",
      "gateBlockSchema",
      "gateItemSchema",
      "gateOutputSchema",
      "workflowDefinitionSchema",
      "workflowStepSchema",
    ]);
  });

  it("runtime helpers are callable", () => {
    expect(typeof pkg.defineGate).toBe("function");
    expect(typeof pkg.defineWorkflow).toBe("function");
    expect(pkg.GATE_ERROR_CODES.GATE_TIMEOUT).toBe("GATE_TIMEOUT");
  });
});
