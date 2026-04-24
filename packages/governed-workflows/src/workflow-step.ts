import { z } from "zod";
import { gateBlockSchema } from "./gate-block.js";

/**
 * A single step in a workflow.json `steps` array. Gates is an open record
 * keyed by kind ("entry", "exit" in MVP; extensible to "on-failure",
 * "on-success", "mid", ... without schema migration). Unknown kinds are
 * accepted here — the orchestrator logs a warning and ignores them.
 */
export const workflowStepSchema = z.object({
  id: z.string().min(1).describe("Identifiant unique de l'étape, référencé dans deps et les logs"),
  deps: z.array(z.string().min(1)).default([]).describe("IDs des étapes qui doivent réussir avant de lancer celle-ci"),
  agent: z.string().min(1).describe("Nom de l'agent qui exécute cette étape (ex: claude_code, opencode)"),
  prompt_context: z.record(z.unknown()).default({}).describe("Contexte/prompt passé à l'agent sous forme d'objet structuré"),
  gates: z.record(z.string().min(1), gateBlockSchema).optional().describe("Gates indexées par kind (entry, exit) — valident l'état avant/après l'étape"),
  required_tools: z.array(z.string()).optional().describe("Outils MCP requis pour que l'étape puisse s'exécuter"),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
