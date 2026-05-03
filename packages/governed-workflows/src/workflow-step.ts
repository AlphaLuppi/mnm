import { z } from "zod";
import { gateBlockSchema } from "./gate-block.js";
import { hookBlockSchema } from "./hook-ref.js";
import { stepAssignmentSchema } from "./assignment.js";

/**
 * Regex for the `uses:` reference of a composite step.
 * Format: `workflows/<name>@<ref>` where:
 *   - <name> is kebab/snake alphanumeric (matches workflow name regex)
 *   - <ref> is a git ref (tag, branch, sha) — alphanumeric + `_.-/`
 *
 * Example: `workflows/feature-dev@v1.2.3`, `workflows/design@main`,
 *          `workflows/build@abc123def`.
 */
export const COMPOSITE_USES_REGEX = /^workflows\/[a-z0-9][a-z0-9_-]*@[a-zA-Z0-9_.\-/]+$/;

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
 *
 * `type` (T5.1, default `"agent"`):
 *   - `"agent"` — leaf step executed by an agent runtime (Claude Code, MCP, …).
 *     `agent` field is required, `uses` and `params` are forbidden.
 *   - `"composite"` — meta step that launches a sub-run of another workflow.
 *     `uses: workflows/<name>@<ref>` is required, `agent` is optional and
 *     ignored at execution. `params` are passed as the sub-run's input
 *     variables.
 *
 * Backward compatibility: existing workflows have no `type` field. Zod
 * `.default("agent")` keeps them parsing identically.
 */
export const workflowStepSchema = z.object({
  id: z.string().min(1).describe("Identifiant unique de l'étape, référencé dans deps et les logs"),
  type: z.enum(["agent", "composite"]).default("agent").describe("Type d'étape : 'agent' (exécution leaf) ou 'composite' (lance un sous-workflow via uses)"),
  deps: z.array(z.string().min(1)).default([]).describe("IDs des étapes qui doivent réussir avant de lancer celle-ci"),
  agent: z.string().min(1).optional().describe("Nom de l'agent qui exécute cette étape (requis pour type=agent)"),
  uses: z.string().regex(COMPOSITE_USES_REGEX, "uses must match `workflows/<name>@<ref>`").optional().describe("Référence du sous-workflow à lancer (requis pour type=composite). Format: workflows/<name>@<ref>"),
  params: z.record(z.unknown()).optional().describe("Variables d'entrée passées au sous-workflow (composite uniquement)"),
  prompt_context: z.record(z.unknown()).default({}).describe("Contexte/prompt passé à l'agent sous forme d'objet structuré"),
  gates: z.record(z.string().min(1), gateBlockSchema).optional().describe("Gates indexées par kind (entry, exit) — valident l'état avant/après l'étape"),
  hooks: hookBlockSchema.optional().describe("Hooks { before, after } pour ce step — exécutés autour des gates entry/exit"),
  assignment: stepAssignmentSchema.optional().describe("Assignment principals (T3.2) — tags (AND), roles (OR), principals (explicit)"),
  required_tools: z.array(z.string()).optional().describe("Outils MCP requis pour que l'étape puisse s'exécuter"),
}).superRefine((step, ctx) => {
  if (step.type === "composite") {
    if (!step.uses) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "step type=composite requires `uses: workflows/<name>@<ref>`",
        path: ["uses"],
      });
    }
  } else {
    // type === "agent"
    if (!step.agent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "step type=agent requires `agent`",
        path: ["agent"],
      });
    }
    if (step.uses) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`uses` is only allowed when type=composite",
        path: ["uses"],
      });
    }
    if (step.params) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`params` is only allowed when type=composite",
        path: ["params"],
      });
    }
  }
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
