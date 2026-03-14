import type { ContainerInfoFull, ContainerStatus, ContainerStopOptions } from "@mnm/shared";
import { api } from "./client";

export interface ContainerListFilters {
  status?: ContainerStatus;
  agentId?: string;
}

export interface DockerHealthResult {
  available: boolean;
  version: string | null;
  error: string | null;
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

export const containersApi = {
  list: (companyId: string, filters: ContainerListFilters = {}) =>
    api.get<{ containers: ContainerInfoFull[] }>(
      `/companies/${companyId}/containers${buildQuery(filters as Record<string, string | undefined>)}`,
    ),

  getById: (companyId: string, containerId: string) =>
    api.get<ContainerInfoFull>(
      `/companies/${companyId}/containers/${containerId}`,
    ),

  stop: (companyId: string, containerId: string, body?: ContainerStopOptions) =>
    api.post<{ status: string }>(
      `/companies/${companyId}/containers/${containerId}/stop`,
      body ?? {},
    ),

  destroy: (companyId: string, containerId: string) =>
    api.delete<{ status: string }>(
      `/companies/${companyId}/containers/${containerId}`,
    ),

  dockerHealth: (companyId: string) =>
    api.get<DockerHealthResult>(
      `/companies/${companyId}/containers/health`,
    ),
};
