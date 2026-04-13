import type { Project, ProjectWorkspace } from "@mnm/shared";
import { api } from "./client";

export const projectsApi = {
  list: (companyId: string) => api.get<Project[]>(`/companies/${companyId}/projects`),
  get: (companyId: string, id: string) =>
    api.get<Project>(`/companies/${companyId}/projects/${encodeURIComponent(id)}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Project>(`/companies/${companyId}/projects`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) =>
    api.patch<Project>(`/companies/${companyId}/projects/${encodeURIComponent(id)}`, data),
  listWorkspaces: (companyId: string, projectId: string) =>
    api.get<ProjectWorkspace[]>(`/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspaces`),
  createWorkspace: (companyId: string, projectId: string, data: Record<string, unknown>) =>
    api.post<ProjectWorkspace>(`/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspaces`, data),
  updateWorkspace: (companyId: string, projectId: string, workspaceId: string, data: Record<string, unknown>) =>
    api.patch<ProjectWorkspace>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspaces/${encodeURIComponent(workspaceId)}`,
      data,
    ),
  removeWorkspace: (companyId: string, projectId: string, workspaceId: string) =>
    api.delete<ProjectWorkspace>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspaces/${encodeURIComponent(workspaceId)}`,
    ),
  remove: (companyId: string, id: string) =>
    api.delete<Project>(`/companies/${companyId}/projects/${encodeURIComponent(id)}`),
  onboard: (companyId: string, projectId: string, data: { agentId?: string }) =>
    api.post<{ issueId: string; identifier: string | null }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/onboard`,
      data,
    ),
};
