import { z } from "zod";

/**
 * Verdict returned by a gate function. Validated server-side by the runner
 * after each gate invocation. A missing/invalid output is reported to the
 * client as `GATE_INVALID_OUTPUT`.
 */
export const gateOutputSchema = z.object({
  pass: z.boolean(),
  report: z.string().min(1),
  error_code: z.string().min(1).optional(),
  hints: z.array(z.string().min(1)).optional(),
});

export type GateOutput = z.infer<typeof gateOutputSchema>;
