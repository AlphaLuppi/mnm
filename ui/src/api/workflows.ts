import { api } from "./client";

export interface WorkflowTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  stages: Array<{
    order: number;
    name: string;
    description?: string;
    agentRole?: string;
    autoTransition: boolean;
    acceptanceCriteria?: string[];
  }>;
  isDefault: boolean;
  createdFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInstance {
  id: string;
  companyId: string;
  templateId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  stages?: StageInstance[];
}

export interface StageInstance {
  id: string;
  companyId: string;
  workflowInstanceId: string;
  stageOrder: number;
  name: string;
  description: string | null;
  agentRole: string | null;
  agentId: string | null;
  status: string;
  autoTransition: string;
  acceptanceCriteria: string[] | null;
  activeRunId: string | null;
  inputArtifacts: string[] | null;
  outputArtifacts: string[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const workflowTemplatesApi = {
  list: (companyId: string) =>
    api.get<WorkflowTemplate[]>(`/companies/${companyId}/workflow-templates`),
  get: (companyId: string, id: string) =>
    api.get<WorkflowTemplate>(`/companies/${companyId}/workflow-templates/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<WorkflowTemplate>(`/companies/${companyId}/workflow-templates`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) =>
    api.patch<WorkflowTemplate>(`/companies/${companyId}/workflow-templates/${id}`, data),
  remove: (companyId: string, id: string) =>
    api.delete<void>(`/companies/${companyId}/workflow-templates/${id}`),
  ensureBmad: (companyId: string) =>
    api.post<WorkflowTemplate>(`/companies/${companyId}/workflow-templates/ensure-bmad`, {}),
};

export const workflowsApi = {
  list: (companyId: string, filters?: { status?: string; projectId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    const qs = params.toString();
    return api.get<WorkflowInstance[]>(
      `/companies/${companyId}/workflows${qs ? `?${qs}` : ""}`,
    );
  },
  get: (companyId: string, id: string) =>
    api.get<WorkflowInstance>(`/companies/${companyId}/workflows/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<WorkflowInstance>(`/companies/${companyId}/workflows`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) =>
    api.patch<WorkflowInstance>(`/companies/${companyId}/workflows/${id}`, data),
  remove: (companyId: string, id: string) =>
    api.delete<void>(`/companies/${companyId}/workflows/${id}`),
};

export const stagesApi = {
  get: (companyId: string, id: string) => api.get<StageInstance>(`/companies/${companyId}/stages/${id}`),
  transition: (companyId: string, id: string, data: { status: string; agentId?: string; outputArtifacts?: string[] }) =>
    api.post<StageInstance>(`/companies/${companyId}/stages/${id}/transition`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) =>
    api.patch<StageInstance>(`/companies/${companyId}/stages/${id}`, data),
};
