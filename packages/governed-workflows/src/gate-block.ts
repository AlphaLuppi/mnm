import { z } from "zod";
import { gateItemSchema } from "./gate-item.js";

/**
 * A GateBlock is an array where each entry is either:
 *   - a single GateItem (sequential step)
 *   - an array of GateItems (run in parallel, fail-fast)
 *
 * Nesting is strictly 1 level: arrays of arrays of arrays are rejected.
 * This bounds the DAG by construction (no cycles possible).
 */
export const gateBlockSchema = z.array(
  z.union([gateItemSchema, z.array(gateItemSchema).min(1)]),
);

export type GateBlock = z.infer<typeof gateBlockSchema>;
