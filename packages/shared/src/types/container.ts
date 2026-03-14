// Container instance statuses
export const CONTAINER_STATUSES = [
  "pending",    // Instance created in DB, Docker not yet called
  "creating",   // Docker container being created
  "running",    // Container started and executing
  "stopping",   // Graceful stop in progress (SIGTERM sent)
  "exited",     // Container exited normally (exitCode=0)
  "failed",     // Container exited with error (exitCode!=0, OOM, timeout)
  "stopped",    // Container manually stopped
] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];

// Predefined resource profiles
export const CONTAINER_PROFILE_PRESETS = {
  light:    { cpuMillicores: 500,  memoryMb: 256,  diskMb: 512,  timeoutSeconds: 1800 },
  standard: { cpuMillicores: 1000, memoryMb: 512,  diskMb: 1024, timeoutSeconds: 3600 },
  heavy:    { cpuMillicores: 2000, memoryMb: 1024, diskMb: 2048, timeoutSeconds: 7200 },
  gpu:      { cpuMillicores: 4000, memoryMb: 4096, diskMb: 4096, timeoutSeconds: 14400 },
} as const;
export type ContainerProfilePreset = keyof typeof CONTAINER_PROFILE_PRESETS;

// Container resource usage snapshot
export interface ContainerResourceUsage {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  pidsCount: number;
  timestamp: string; // ISO 8601
}

// Container launch options
export interface ContainerLaunchOptions {
  profileId?: string;         // Use specific profile (overrides agent default)
  dockerImage?: string;       // Override image (default from adapterConfig)
  environmentVars?: Record<string, string>; // Additional env vars
  timeout?: number;           // Override timeout in seconds
  labels?: Record<string, string>; // Docker labels
}

// Container launch result
export interface ContainerLaunchResult {
  instanceId: string;         // container_instances.id
  dockerContainerId: string;  // Docker container ID
  status: ContainerStatus;
  profileName: string;
  agentId: string;
  startedAt: string;
}

// Container info (for API responses)
export interface ContainerInfo {
  id: string;
  agentId: string;
  agentName: string;
  profileId: string;
  profileName: string;
  dockerContainerId: string | null;
  status: ContainerStatus;
  exitCode: number | null;
  error: string | null;
  resourceUsage: ContainerResourceUsage | null;
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
}

// Container stop options
export interface ContainerStopOptions {
  gracePeriodSeconds?: number; // Default 10s: SIGTERM, wait, then SIGKILL
  reason?: string;
}

// Live event types for containers
export const CONTAINER_EVENT_TYPES = [
  "container.created",
  "container.started",
  "container.completed",
  "container.failed",
  "container.timeout",
  "container.oom",
  "container.stopped",
  "container.resource_update",
] as const;
export type ContainerEventType = (typeof CONTAINER_EVENT_TYPES)[number];
