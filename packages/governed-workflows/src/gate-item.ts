import { z } from "zod";

/**
 * A single gate declaration in workflow.json. `source` is a path relative to
 * the workflow.json file; the server resolves it against the git fetch of the
 * workflow repo at the run's pinned sha. `config` (optional) is forwarded to
 * the gate function via `GateContext.config` for parameterised gates.
 */
export const gateItemSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});

export type GateItem = z.infer<typeof gateItemSchema>;
