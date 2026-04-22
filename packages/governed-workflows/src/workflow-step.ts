import { z } from "zod";
import { gateBlockSchema } from "./gate-block.js";

/**
 * A single step in a workflow.json `steps` array. Gates is an open record
 * keyed by kind ("entry", "exit" in MVP; extensible to "on-failure",
 * "on-success", "mid", ... without schema migration). Unknown kinds are
 * accepted here — the orchestrator logs a warning and ignores them.
 */
export const workflowStepSchema = z.object({
  id: z.string().min(1),
  deps: z.array(z.string().min(1)).default([]),
  agent: z.string().min(1),
  prompt_context: z.record(z.unknown()).default({}),
  gates: z.record(z.string().min(1), gateBlockSchema).optional(),
  required_tools: z.array(z.string()).optional(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
