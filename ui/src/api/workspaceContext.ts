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

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export const workspaceContextApi = {
  getProject: (projectId: string, companyId?: string) =>
    api.get<WorkspaceContext>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context`, companyId),
    ),
  getWorkflows: (projectId: string, companyId?: string) =>
    api.get<{ workflows: WorkspaceWorkflow[] }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/workflows`, companyId),
    ),
  getAgents: (projectId: string, companyId?: string) =>
    api.get<{ agents: DiscoveredWorkspaceAgent[] }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/agents`, companyId),
    ),
  importAgents: (
    projectId: string,
    slugs: string[],
    workspaceId: string | null | undefined,
    companyId?: string,
  ) =>
    api.post<{ created: unknown[]; assignments: Record<string, string> }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/import-agents`, companyId),
      { slugs, workspaceId: workspaceId === undefined ? undefined : workspaceId },
    ),
  getFile: (projectId: string, filePath: string, companyId?: string) =>
    api.getText(
      withCompanyScope(
        `/projects/${encodeURIComponent(projectId)}/workspace-context/file?path=${encodeURIComponent(filePath)}`,
        companyId,
      ),
    ),
  driftCheck: (projectId: string, sourceDoc: string, targetDoc: string, companyId?: string) =>
    api.post<DriftReport>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/drift-check`, companyId),
      { sourceDoc, targetDoc },
    ),
  getAssignments: (projectId: string, companyId?: string) =>
    api.get<{ assignments: Record<string, string>; workspaceId: string | null }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/assignments`, companyId),
    ),
  saveAssignments: (projectId: string, assignments: Record<string, string>, companyId?: string) =>
    api.post<{ ok: true }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/assignments`, companyId),
      { assignments },
    ),
  getCommand: (projectId: string, name: string, companyId?: string) =>
    api.getText(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/workspace-context/command?name=${encodeURIComponent(name)}`, companyId),
    ),
};
