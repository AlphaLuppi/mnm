import {
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "./workflow.js";

/**
 * Authoring helper for workflow.json files (via TS transpile) or for tests.
 * Parses + validates the input and returns a typed `WorkflowDefinition`.
 *
 * In production, the server parses workflow.json directly via
 * `workflowDefinitionSchema` at fetch time — `defineWorkflow` is only a
 * convenience for authoring + testing.
 */
export function defineWorkflow(def: unknown): WorkflowDefinition {
  return workflowDefinitionSchema.parse(def);
}
