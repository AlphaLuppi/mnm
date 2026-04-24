// Error codes
export {
  GATE_ERROR_CODES,
  WORKFLOW_ERROR_CODES,
  type GateErrorCode,
  type WorkflowErrorCode,
} from "./errors.js";

// Gate schemas + types
export { gateItemSchema, type GateItem } from "./gate-item.js";
export { gateBlockSchema, type GateBlock } from "./gate-block.js";
export { gateOutputSchema, type GateOutput } from "./gate-output.js";
export type { GateContext } from "./gate-context.js";

// Workflow schemas + types
export { workflowStepSchema, type WorkflowStep } from "./workflow-step.js";
export {
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "./workflow.js";

// JSON Schema (for Monaco editor autocomplete + live validation)
export { workflowJsonSchema } from "./workflow.jsonschema.js";

// Authoring helpers
export { defineGate } from "./define-gate.js";
export { defineWorkflow } from "./define-workflow.js";
