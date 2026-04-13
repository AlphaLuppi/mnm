import type { WorkspaceContext, DriftReport } from "@mnm/shared";
import { api } from "./client";

export interface WorkspaceWorkflow {
  name: string;
  description: string;
  phase?: string;
  agentRole?: string;
}

export interface DiscoveredWorkspaceAgent {
  slug: string;
  commandName: string;
  personaName: string;
  title: string;
  description: string;
  icon: string | null;
  capabilities: string | null;
  role: string;
  workflows: string[];
}

export const workspaceContextApi = {
  getProject: (companyId: string, projectId: string) =>
    api.get<WorkspaceContext>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context`,
    ),
  getWorkflows: (companyId: string, projectId: string) =>
    api.get<{ workflows: WorkspaceWorkflow[] }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/workflows`,
    ),
  getAgents: (companyId: string, projectId: string) =>
    api.get<{ agents: DiscoveredWorkspaceAgent[] }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/agents`,
    ),
  importAgents: (
    companyId: string,
    projectId: string,
    slugs: string[],
    workspaceId: string | null | undefined,
  ) =>
    api.post<{ created: unknown[]; assignments: Record<string, string> }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/import-agents`,
      { slugs, workspaceId: workspaceId === undefined ? undefined : workspaceId },
    ),
  getFile: (companyId: string, projectId: string, filePath: string) =>
    api.getText(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/file?path=${encodeURIComponent(filePath)}`,
    ),
  driftCheck: (companyId: string, projectId: string, sourceDoc: string, targetDoc: string) =>
    api.post<DriftReport>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/drift-check`,
      { sourceDoc, targetDoc },
    ),
  getAssignments: (companyId: string, projectId: string) =>
    api.get<{ assignments: Record<string, string>; workspaceId: string | null }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/assignments`,
    ),
  saveAssignments: (companyId: string, projectId: string, assignments: Record<string, string>) =>
    api.post<{ ok: true }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/assignments`,
      { assignments },
    ),
  getCommand: (companyId: string, projectId: string, name: string) =>
    api.getText(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/workspace-context/command?name=${encodeURIComponent(name)}`,
    ),
};
