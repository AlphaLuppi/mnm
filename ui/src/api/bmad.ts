import type { BmadProject, DriftReport } from "@mnm/shared";
import { api } from "./client";

export interface BmadWorkflow {
  name: string;
  description: string;
  phase?: string;
  agentRole?: string;
}

export interface DiscoveredBmadAgent {
  slug: string;
  commandName: string;
  personaName: string;
  title: string;
  description: string;
  icon: string | null;
  capabilities: string | null;
  role: string;
}

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export const bmadApi = {
  getProject: (projectId: string, companyId?: string) =>
    api.get<BmadProject>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad`, companyId),
    ),
  getWorkflows: (projectId: string, companyId?: string) =>
    api.get<{ workflows: BmadWorkflow[] }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/workflows`, companyId),
    ),
  getAgents: (projectId: string, companyId?: string) =>
    api.get<{ agents: DiscoveredBmadAgent[] }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/agents`, companyId),
    ),
  importAgents: (projectId: string, slugs: string[], companyId?: string) =>
    api.post<{ created: unknown[] }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/import-agents`, companyId),
      { slugs },
    ),
  getFile: (projectId: string, filePath: string, companyId?: string) =>
    api.getText(
      withCompanyScope(
        `/projects/${encodeURIComponent(projectId)}/bmad/file?path=${encodeURIComponent(filePath)}`,
        companyId,
      ),
    ),
  driftCheck: (projectId: string, sourceDoc: string, targetDoc: string, companyId?: string) =>
    api.post<DriftReport>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/drift-check`, companyId),
      { sourceDoc, targetDoc },
    ),
  getAssignments: (projectId: string, companyId?: string) =>
    api.get<{ assignments: Record<string, string>; workspaceId: string | null }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/assignments`, companyId),
    ),
  saveAssignments: (projectId: string, assignments: Record<string, string>, companyId?: string) =>
    api.post<{ ok: true }>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/assignments`, companyId),
      { assignments },
    ),
  getCommand: (projectId: string, name: string, companyId?: string) =>
    api.getText(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad/command?name=${encodeURIComponent(name)}`, companyId),
    ),
};
