import type {
  ConfigLayer,
  ConfigLayerDetail,
  ConfigLayerItem,
  ConfigLayerFile,
  ConfigLayerRevision,
  AgentConfigLayerAttachment,
  ConflictCheckResult,
  MergePreviewResult,
  UserMcpCredential,
} from "@mnm/shared";
import { api } from "./client";

export const configLayersApi = {
  // Layer CRUD
  list: (companyId: string, opts?: { scope?: string; includeArchived?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.scope) params.set("scope", opts.scope);
    if (opts?.includeArchived) params.set("includeArchived", "true");
    const qs = params.toString();
    return api.get<ConfigLayer[]>(`/companies/${companyId}/config-layers${qs ? `?${qs}` : ""}`);
  },
  get: (layerId: string) => api.get<ConfigLayerDetail>(`/config-layers/${layerId}`),
  create: (companyId: string, input: Record<string, unknown>) =>
    api.post<ConfigLayer>(`/companies/${companyId}/config-layers`, input),
  update: (layerId: string, input: Record<string, unknown>) =>
    api.patch<ConfigLayer>(`/config-layers/${layerId}`, input),
  archive: (layerId: string) => api.delete<ConfigLayer>(`/config-layers/${layerId}`),
  revisions: (layerId: string) => api.get<ConfigLayerRevision[]>(`/config-layers/${layerId}/revisions`),

  // Item CRUD
  addItem: (layerId: string, input: Record<string, unknown>) =>
    api.post<ConfigLayerItem>(`/config-layers/${layerId}/items`, input),
  updateItem: (layerId: string, itemId: string, input: Record<string, unknown>) =>
    api.patch<ConfigLayerItem>(`/config-layers/${layerId}/items/${itemId}`, input),
  removeItem: (layerId: string, itemId: string) =>
    api.delete<void>(`/config-layers/${layerId}/items/${itemId}`),

  // Files
  addFile: (layerId: string, itemId: string, input: { path: string; content: string }) =>
    api.post<ConfigLayerFile>(`/config-layers/${layerId}/items/${itemId}/files`, input),
  removeFile: (layerId: string, itemId: string, fileId: string) =>
    api.delete<void>(`/config-layers/${layerId}/items/${itemId}/files/${fileId}`),

  // Agent Attachment
  listAgentLayers: (companyId: string, agentId: string) =>
    api.get<AgentConfigLayerAttachment[]>(`/companies/${companyId}/agents/${agentId}/config-layers`),
  attachToAgent: (companyId: string, agentId: string, input: { layerId: string; priority?: number }) =>
    api.post<{ ok: boolean; conflicts: unknown[] }>(`/companies/${companyId}/agents/${agentId}/config-layers`, input),
  detachFromAgent: (companyId: string, agentId: string, layerId: string) =>
    api.delete<void>(`/companies/${companyId}/agents/${agentId}/config-layers/${layerId}`),
  checkConflicts: (companyId: string, agentId: string, input: { layerId: string; priority?: number }) =>
    api.post<ConflictCheckResult>(`/companies/${companyId}/agents/${agentId}/config-layers/check`, input),
  mergePreview: (companyId: string, agentId: string) =>
    api.get<MergePreviewResult>(`/companies/${companyId}/agents/${agentId}/config-layers/preview`),

  // Promotion
  promote: (layerId: string) => api.post<ConfigLayer>(`/config-layers/${layerId}/promote`),
  approvePromotion: (layerId: string, input: { expectedContentHash: string }) =>
    api.post<ConfigLayer>(`/config-layers/${layerId}/promotion/approve`, input),
  rejectPromotion: (layerId: string, input: { reason: string }) =>
    api.post<ConfigLayer>(`/config-layers/${layerId}/promotion/reject`, input),

  // Credentials
  listCredentials: (companyId: string) =>
    api.get<UserMcpCredential[]>(`/companies/${companyId}/mcp-credentials`),
  revokeCredential: (credentialId: string) =>
    api.delete<void>(`/mcp-credentials/${credentialId}`),
};
