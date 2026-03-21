// POD-01: Per-User Pod types

export const POD_STATUSES = [
  "provisioning",
  "running",
  "idle",
  "hibernated",
  "failed",
  "destroyed",
] as const;
export type PodStatus = (typeof POD_STATUSES)[number];

export const POD_CLAUDE_AUTH_STATUSES = [
  "unknown",
  "authenticated",
  "expired",
] as const;
export type PodClaudeAuthStatus = (typeof POD_CLAUDE_AUTH_STATUSES)[number];

export interface UserPod {
  id: string;
  userId: string;
  userName?: string;
  companyId: string;
  dockerContainerId: string | null;
  dockerImage: string;
  status: PodStatus;
  volumeName: string | null;
  workspaceVolume: string | null;
  cpuMillicores: number;
  memoryMb: number;
  claudeAuthStatus: PodClaudeAuthStatus;
  lastActiveAt: string | null; // ISO 8601
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PodProvisionOptions {
  image?: string;
  cpuMillicores?: number;
  memoryMb?: number;
}
