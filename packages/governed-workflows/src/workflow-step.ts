import { z } from "zod";
import { gateBlockSchema } from "./gate-block.js";
import { hookBlockSchema } from "./hook-ref.js";
import { stepAssignmentSchema } from "./assignment.js";

/**
 * A single step in a workflow.json `steps` array. Gates is an open record
 * keyed by kind ("entry", "exit" in MVP; extensible to "on-failure",
 * "on-success", "mid", ... without schema migration). Unknown kinds are
 * accepted here — the orchestrator logs a warning and ignores them.
 *
 * `hooks` (T2.6) is the optional per-step hook configuration:
 *   - `before` runs before the step's entry gates (phase: before_step)
 *   - `after` runs after the step's exit gates pass and the artifact is
 *     committed (phase: after_step)
 * Hooks declared in workflow.json are step-LOCAL — instance-level
 * "enforced" hooks declared in workflow_hooks_config DB merge with
 * these at run time (T2.6 service `resolveHooksForStep`).
 */
export const workflowStepSchema = z.object({
  id: z.string().min(1).describe("Identifiant unique de l'étape, référencé dans deps et les logs"),
  deps: z.array(z.string().min(1)).default([]).describe("IDs des étapes qui doivent réussir avant de lancer celle-ci"),
  agent: z.string().min(1).describe("Nom de l'agent qui exécute cette étape (ex: claude_code, opencode)"),
  prompt_context: z.record(z.unknown()).default({}).describe("Contexte/prompt passé à l'agent sous forme d'objet structuré"),
  gates: z.record(z.string().min(1), gateBlockSchema).optional().describe("Gates indexées par kind (entry, exit) — valident l'état avant/après l'étape"),
  hooks: hookBlockSchema.optional().describe("Hooks { before, after } pour ce step — exécutés autour des gates entry/exit"),
  assignment: stepAssignmentSchema.optional().describe("Assignment principals (T3.2) — tags (AND), roles (OR), principals (explicit)"),
  required_tools: z.array(z.string()).optional().describe("Outils MCP requis pour que l'étape puisse s'exécuter"),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
