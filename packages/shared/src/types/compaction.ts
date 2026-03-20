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
  // comp-s02-snapshot-relaunch-fields
  relaunchCount: number;
  maxRelaunchCount: number;
  metadata: Record<string, unknown>;
}

// comp-s02-type-kill-relaunch-result
export interface KillRelaunchResult {
  success: boolean;
  snapshotId: string;
  reason?: string; // "circuit_breaker" | "container_stop_failed" | "relaunch_failed"
  newInstanceId?: string;
  relaunchCount?: number;
  // comp-s03-reinjection-triggered
  reinjectionTriggered?: boolean;
}

// comp-s02-type-relaunch-history-entry
export interface RelaunchHistoryEntry {
  snapshotId: string;
  companyId: string;
  workflowInstanceId: string;
  stageId: string;
  agentId: string;
  stageOrder: number;
  strategy: CompactionStrategy;
  status: CompactionSnapshotStatus;
  relaunchCount: number;
  maxRelaunchCount: number;
  detectedAt: string;
  resolvedAt: string | null;
}

// comp-s02-relaunch-history-filters
export interface RelaunchHistoryFilters {
  agentId?: string;
  workflowInstanceId?: string;
  status?: CompactionSnapshotStatus;
  limit?: number;
  offset?: number;
}

// comp-s03-type-reinjection-result
export interface ReinjectionResult {
  success: boolean;
  snapshotId: string;
  reason?: string; // "snapshot_not_found" | "send_failed"
  promptLength: number;
}

// comp-s03-type-reinjection-history
export interface ReinjectionHistoryEntry {
  snapshotId: string;
  companyId: string;
  workflowInstanceId: string;
  stageId: string;
  agentId: string;
  stageOrder: number;
  strategy: CompactionStrategy;
  status: CompactionSnapshotStatus;
  reinjected: boolean;
  promptLength: number | null;
  detectedAt: string;
  resolvedAt: string | null;
}

// comp-s03-type-reinjection-filters
export interface ReinjectionHistoryFilters {
  agentId?: string;
  workflowInstanceId?: string;
  status?: CompactionSnapshotStatus;
  limit?: number;
  offset?: number;
}

// comp-s03-type-recovery-prompt
export interface RecoveryPrompt {
  workflowInstanceId: string;
  stageId: string;
  snapshotId: string;
  stageOrder: number;
  totalStages: number;
  sections: Array<{
    title: string;
    content: string;
  }>;
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
