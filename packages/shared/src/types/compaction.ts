import type { StageArtifact, PrePromptPayload } from "./orchestrator.js";

// comp-s01-strategy-const
export const COMPACTION_STRATEGIES = ["kill_relaunch", "reinjection"] as const;
export type CompactionStrategy = (typeof COMPACTION_STRATEGIES)[number];

// comp-s01-snapshot-statuses
export const COMPACTION_SNAPSHOT_STATUSES = [
  "pending",
  "processing",
  "resolved",
  "failed",
] as const;
export type CompactionSnapshotStatus = (typeof COMPACTION_SNAPSHOT_STATUSES)[number];

// comp-s01-snapshot-type
export interface CompactionSnapshot {
  id: string;
  companyId: string;
  workflowInstanceId: string;
  stageId: string;
  agentId: string;
  stageOrder: number;
  detectedAt: string; // ISO 8601
  detectionPattern: string; // pattern that triggered detection
  detectionMessage: string; // original message that matched
  previousArtifacts: StageArtifact[]; // from getStageArtifacts
  prePromptsInjected: PrePromptPayload | null;
  outputArtifactsSoFar: string[];
  strategy: CompactionStrategy;
  status: CompactionSnapshotStatus;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
}

// comp-s01-config-type
export interface CompactionWatcherConfig {
  enabled: boolean;
  cooldownMs: number; // min ms between detections per agent
  patterns: string[]; // regex patterns to detect compaction
}

// comp-s01-status-type
export interface CompactionWatcherStatus {
  active: boolean;
  activeSnapshotCount: number;
  startedAt: string | null;
  lastCheckAt: string | null;
  config: CompactionWatcherConfig;
}

// comp-s01-filters-type
export interface CompactionSnapshotFilters {
  stageId?: string;
  agentId?: string;
  status?: CompactionSnapshotStatus;
  limit?: number;
  offset?: number;
}
