import { z } from "zod";
import { COMPACTION_SNAPSHOT_STATUSES } from "../types/compaction.js";

// comp-s01-validator-start
export const startCompactionWatcherSchema = z.object({
  enabled: z.boolean().optional(),
  cooldownMs: z.number().int().positive().optional(),
  patterns: z.array(z.string()).optional(),
});
export type StartCompactionWatcher = z.infer<typeof startCompactionWatcherSchema>;

// comp-s01-validator-snapshots
export const compactionSnapshotFiltersSchema = z.object({
  stageId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  status: z.enum(COMPACTION_SNAPSHOT_STATUSES).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type CompactionSnapshotFilters = z.infer<typeof compactionSnapshotFiltersSchema>;
