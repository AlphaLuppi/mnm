// POD-01: Per-User Sandbox types (renamed from pod.ts)

export const SANDBOX_STATUSES = [
  "provisioning",
  "running",
  "idle",
  "hibernated",
  "failed",
  "destroyed",
] as const;
export type SandboxStatus = (typeof SANDBOX_STATUSES)[number];

export const SANDBOX_CLAUDE_AUTH_STATUSES = [
  "unknown",
  "authenticated",
  "expired",
] as const;
export type SandboxClaudeAuthStatus = (typeof SANDBOX_CLAUDE_AUTH_STATUSES)[number];

export interface UserSandbox {
  id: string;
  userId: string;
  userName?: string;
  companyId: string;
  dockerContainerId: string | null;
  dockerImage: string;
  status: SandboxStatus;
  volumeName: string | null;
  workspaceVolume: string | null;
  cpuMillicores: number;
  memoryMb: number;
  claudeAuthStatus: SandboxClaudeAuthStatus;
  lastActiveAt: string | null; // ISO 8601
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxProvisionOptions {
  image?: string;
  cpuMillicores?: number;
  memoryMb?: number;
}

// Backward-compatible aliases
export type PodStatus = SandboxStatus;
export type PodClaudeAuthStatus = SandboxClaudeAuthStatus;
export type UserPod = UserSandbox;
export type PodProvisionOptions = SandboxProvisionOptions;
export const POD_STATUSES = SANDBOX_STATUSES;
export const POD_CLAUDE_AUTH_STATUSES = SANDBOX_CLAUDE_AUTH_STATUSES;
