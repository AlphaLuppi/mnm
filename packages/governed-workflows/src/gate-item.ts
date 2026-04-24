import { z } from "zod";

/**
 * A single gate declaration in workflow.json. `source` is a path relative to
 * the workflow.json file; the server resolves it against the git fetch of the
 * workflow repo at the run's pinned sha. `config` (optional) is forwarded to
 * the gate function via `GateContext.config` for parameterised gates.
 */
export const gateItemSchema = z.object({
  id: z.string().min(1).describe("Identifiant unique de la gate dans ce bloc (référencé dans les logs)"),
  source: z.string().min(1).describe("Chemin relatif vers le script gate (ex: gates/lint.gate.ts)"),
  config: z.record(z.unknown()).optional().describe("Configuration optionnelle transmise à la gate via GateContext.config"),
});

export type GateItem = z.infer<typeof gateItemSchema>;
