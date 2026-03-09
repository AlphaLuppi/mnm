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
  get: (id: string) => api.get<WorkflowTemplate>(`/workflow-templates/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<WorkflowTemplate>(`/companies/${companyId}/workflow-templates`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<WorkflowTemplate>(`/workflow-templates/${id}`, data),
  remove: (id: string) => api.delete<void>(`/workflow-templates/${id}`),
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
  get: (id: string) => api.get<WorkflowInstance>(`/workflows/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<WorkflowInstance>(`/companies/${companyId}/workflows`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<WorkflowInstance>(`/workflows/${id}`, data),
  remove: (id: string) => api.delete<void>(`/workflows/${id}`),
};

export const stagesApi = {
  get: (id: string) => api.get<StageInstance>(`/stages/${id}`),
  transition: (id: string, data: { status: string; agentId?: string; outputArtifacts?: string[] }) =>
    api.post<StageInstance>(`/stages/${id}/transition`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<StageInstance>(`/stages/${id}`, data),
};
