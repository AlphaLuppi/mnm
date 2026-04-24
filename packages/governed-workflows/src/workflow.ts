import { z } from "zod";
import { workflowStepSchema } from "./workflow-step.js";

const variableDefSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object"]).describe("Type de la variable d'entrée"),
  required: z.boolean().optional().describe("Si true, la variable est obligatoire à l'exécution"),
});

/**
 * Full workflow document (content of `workflow.json` in a workflow repo).
 * Validates both shape (zod object schema) and cross-step invariants
 * (duplicate ids, unknown deps) via `superRefine`.
 */
export const workflowDefinitionSchema = z
  .object({
    apiVersion: z.literal("mnm/v1").describe("Version du format, actuellement fixe à mnm/v1"),
    kind: z.literal("GovernedWorkflow").describe("Type de document, doit être GovernedWorkflow"),
    name: z.string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "Workflow name must start with lowercase alphanumeric and contain only lowercase letters, digits, hyphens, and underscores")
      .describe("Nom unique du workflow (kebab-case, alphanumérique)"),
    description: z.string().optional().describe("Description courte affichée dans la liste des workflows"),
    variables: z.record(z.string().min(1), variableDefSchema).default({}).describe("Variables d'entrée disponibles dans les prompt_context des étapes"),
    steps: z.array(workflowStepSchema).min(1).describe("Séquence d'étapes exécutées par le workflow (au moins une)"),
  })
  .superRefine((wf, ctx) => {
    const seen = new Set<string>();
    for (const step of wf.steps) {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate step id: ${step.id}`,
          path: ["steps"],
        });
      }
      seen.add(step.id);
    }
    for (const step of wf.steps) {
      for (const dep of step.deps) {
        if (!seen.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `step '${step.id}' depends on unknown step '${dep}'`,
            path: ["steps"],
          });
        }
      }
    }
  });

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
