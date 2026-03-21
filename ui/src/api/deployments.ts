// DEPLOY-06: Deployment API client
import type { ArtifactDeployment, DeploymentCreateOptions, DeploymentStatus } from "@mnm/shared";
import { api } from "./client";

export interface DeploymentListFilters {
  issueId?: string;
  status?: DeploymentStatus;
}

function buildQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const deploymentsApi = {
  create: (companyId: string, options: DeploymentCreateOptions) =>
    api.post<ArtifactDeployment>(
      `/companies/${companyId}/deployments`,
      options,
    ),

  list: (companyId: string, filters: DeploymentListFilters = {}) =>
    api.get<{ deployments: ArtifactDeployment[] }>(
      `/companies/${companyId}/deployments${buildQuery(filters as Record<string, string | undefined>)}`,
    ),

  getById: (companyId: string, deploymentId: string) =>
    api.get<ArtifactDeployment>(
      `/companies/${companyId}/deployments/${deploymentId}`,
    ),

  getLogs: (companyId: string, deploymentId: string) =>
    api.get<{ log: string }>(
      `/companies/${companyId}/deployments/${deploymentId}/logs`,
    ),

  pin: (companyId: string, deploymentId: string) =>
    api.post<ArtifactDeployment>(
      `/companies/${companyId}/deployments/${deploymentId}/pin`,
      {},
    ),

  unpin: (companyId: string, deploymentId: string) =>
    api.post<ArtifactDeployment>(
      `/companies/${companyId}/deployments/${deploymentId}/unpin`,
      {},
    ),

  destroy: (companyId: string, deploymentId: string) =>
    api.delete<{ status: string }>(
      `/companies/${companyId}/deployments/${deploymentId}`,
    ),
};
