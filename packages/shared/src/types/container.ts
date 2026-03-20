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
  mountPaths?: string[];      // cont-s03: Paths to mount (validated against allowlist)
}

// Container launch result
export interface ContainerLaunchResult {
  instanceId: string;         // container_instances.id
  dockerContainerId: string;  // Docker container ID
  status: ContainerStatus;
  profileName: string;
  agentId: string;
  startedAt: string;
  // cont-s02-type-launch-result-ext
  credentialProxyPort: number | null;   // Port of the proxy if active
  credentialProxyUrl: string | null;    // Full URL of the proxy
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

// ---- CONT-S05: New types ----

// cont-s05-type-network-mode
// Container network mode (isolation level)
export const CONTAINER_NETWORK_MODES = [
  "isolated",          // No network access (--network none)
  "company-bridge",    // Company-scoped Docker bridge network
  "host-restricted",   // Host network with iptables restrictions
] as const;
export type ContainerNetworkMode = (typeof CONTAINER_NETWORK_MODES)[number];

// cont-s05-type-health-status
// Container health check status
export const CONTAINER_HEALTH_CHECK_STATUSES = [
  "healthy",    // Health check passed
  "unhealthy",  // Health check failed
  "unknown",    // No health check performed yet
] as const;
export type ContainerHealthCheckStatus = (typeof CONTAINER_HEALTH_CHECK_STATUSES)[number];

// cont-s05-type-profile-info
// Extended profile info (for API responses, includes new fields)
export interface ContainerProfileInfo {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  dockerImage: string | null;
  cpuMillicores: number;
  memoryMb: number;
  diskMb: number;
  timeoutSeconds: number;
  gpuEnabled: boolean;
  mountAllowlist: string[];
  allowedMountPaths: string[];
  networkPolicy: string;
  networkMode: string;
  credentialProxyEnabled: boolean;
  maxContainers: number;
  maxDiskIops: number | null;
  labels: Record<string, string>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// cont-s05-type-info-full
// Extended container info (for API responses, includes new fields)
export interface ContainerInfoFull extends ContainerInfo {
  networkId: string | null;
  credentialProxyPort: number | null;
  mountedPaths: string[] | null;
  healthCheckStatus: ContainerHealthCheckStatus;
  restartCount: number;
  lastHealthCheckAt: string | null;
  labels: Record<string, string> | null;
  logStreamUrl: string | null;
}

// ---- CONT-S04: Network isolation types ----

// cont-s04-type-network-info
// Information about a Docker network managed by MnM
export interface NetworkInfo {
  id: string;               // Docker network ID
  name: string;             // Network name (e.g., mnm-company-{companyId})
  companyId: string;        // Company that owns this network
  driver: string;           // Network driver (bridge, host, none)
  containerCount: number;   // Number of containers attached
  createdAt: string;        // ISO 8601
}

// cont-s04-type-network-cleanup-result
// Result of cleaning up orphan networks
export interface NetworkCleanupResult {
  removed: string[];        // Network IDs that were removed
  errors: string[];         // Network IDs that failed to remove
}

// cont-s05-type-profile-update
// Profile update payload
export interface ContainerProfileUpdate {
  name?: string;
  description?: string | null;
  dockerImage?: string | null;
  cpuMillicores?: number;
  memoryMb?: number;
  diskMb?: number;
  timeoutSeconds?: number;
  gpuEnabled?: boolean;
  mountAllowlist?: string[];
  allowedMountPaths?: string[];
  networkPolicy?: string;
  networkMode?: ContainerNetworkMode;
  credentialProxyEnabled?: boolean;
  maxContainers?: number;
  maxDiskIops?: number | null;
  labels?: Record<string, string>;
  isDefault?: boolean;
}
