import { zodToJsonSchema } from "zod-to-json-schema";
import { workflowDefinitionSchema } from "./workflow.js";

/**
 * JSON Schema derived from the authoritative zod `workflowDefinitionSchema`.
 * Used by the Monaco editor to provide inline validation, autocomplete, and
 * hover tooltips when editing workflow definition JSON.
 *
 * `$refStrategy: "none"` inlines all sub-schemas so Monaco can resolve them
 * without a network request.
 */
export const workflowJsonSchema = zodToJsonSchema(workflowDefinitionSchema, {
  name: "GovernedWorkflow",
  $refStrategy: "none",
});
