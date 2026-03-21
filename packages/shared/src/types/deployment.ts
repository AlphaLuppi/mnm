// DEPLOY-01: Artifact Deployment types

export const DEPLOYMENT_STATUSES = [
  "building",
  "running",
  "failed",
  "expired",
  "destroyed",
] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const DEPLOYMENT_PROJECT_TYPES = [
  "static",
  "node",
  "python",
  "unknown",
] as const;
export type DeploymentProjectType = (typeof DEPLOYMENT_PROJECT_TYPES)[number];

export interface ArtifactDeployment {
  id: string;
  companyId: string;
  userId: string;
  userName?: string;
  issueId: string | null;
  issueTitle?: string | null;
  runId: string | null;
  agentId: string | null;
  agentName?: string | null;
  projectId: string | null;
  name: string;
  status: DeploymentStatus;
  projectType: DeploymentProjectType;
  dockerContainerId: string | null;
  port: number | null;
  sourcePath: string;
  buildLog: string | null;
  ttlSeconds: number;
  pinned: boolean;
  shareToken: string | null;
  url: string | null;
  expiresAt: string | null; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentCreateOptions {
  sourcePath: string;
  name?: string;
  issueId?: string;
  runId?: string;
  agentId?: string;
  projectId?: string;
  ttlSeconds?: number;
}
