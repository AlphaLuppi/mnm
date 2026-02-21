export type TaskType =
  | "rescan-workflows"
  | "rescan-specs"
  | "scan-drift"
  | "scan-cross-doc-drift"
  | "discover-project"
  | "git-scan-commits";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskLogEntry {
  message: string;
  timestamp: number;
  level?: "info" | "warn" | "error";
}

export interface TaskEntry {
  id: string;
  type: TaskType;
  label: string;
  status: TaskStatus;
  progress?: string;
  result?: unknown;
  error?: string;
  logs: TaskLogEntry[];
  startedAt: number;
  completedAt?: number;
}

export interface TaskRunnerState {
  tasks: TaskEntry[];
  running: number;
}
