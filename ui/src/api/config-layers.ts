import { api } from "./client";

// ---- Types ----

export type LayerScope = "company" | "shared" | "private";

export type ConfigLayerItem = {
  id: string;
  layerId: string;
  itemType: "mcp" | "skill" | "hook" | "setting";
  name: string;
  value: unknown;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type ConfigLayer = {
  id: string;
  companyId: string;
  name: string;
  scope: LayerScope;
  enforced: boolean;
  pendingReview: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ConfigLayerItem[];
};

export type MergePreviewItem = {
  itemId: string;
  layerId: string;
  layerName: string;
  itemType: "mcp" | "skill" | "hook" | "setting";
  name: string;
  value: unknown;
  priority: number;
};

export type MergePreview = {
  agentId: string;
  items: MergePreviewItem[];
  layerSources: Array<{
    layerId: string;
    layerName: string;
    scope: LayerScope;
    enforced: boolean;
    itemCount: number;
  }>;
};

export type ConflictType = "enforced_conflict" | "priority_conflict" | "override_conflict";

export type ConflictItem = {
  conflictType: ConflictType;
  name: string;
  itemType: "mcp" | "skill" | "hook" | "setting";
  existingLayerId: string;
  existingLayerName: string;
  newLayerId: string;
  newLayerName: string;
};

export type ConflictCheckResult = {
  hasEnforcedConflicts: boolean;
  conflicts: ConflictItem[];
};

export type McpCredentialStatus = "connected" | "expired" | "error" | "disconnected";

export type McpCredential = {
  itemId: string;
  status: McpCredentialStatus;
  connectedAt: string | null;
  expiresAt: string | null;
};

export type CreateLayerInput = {
  name: string;
  scope: LayerScope;
};

// ---- API ----

export const configLayersApi = {
  // Layer CRUD
  list: (companyId: string, scope?: LayerScope) =>
    api.get<ConfigLayer[]>(
      `/companies/${companyId}/config-layers${scope ? `?scope=${scope}` : ""}`,
    ),

  get: (companyId: string, layerId: string) =>
    api.get<ConfigLayer>(`/companies/${companyId}/config-layers/${layerId}`),

  create: (companyId: string, input: CreateLayerInput) =>
    api.post<ConfigLayer>(`/companies/${companyId}/config-layers`, input),

  update: (companyId: string, layerId: string, input: Partial<CreateLayerInput & { enforced: boolean; pendingReview: boolean }>) =>
    api.patch<ConfigLayer>(`/companies/${companyId}/config-layers/${layerId}`, input),

  archive: (companyId: string, layerId: string) =>
    api.post<ConfigLayer>(`/companies/${companyId}/config-layers/${layerId}/archive`, {}),

  // Agent layer attachments
  listForAgent: (companyId: string, agentId: string) =>
    api.get<ConfigLayer[]>(`/companies/${companyId}/agents/${agentId}/config-layers`),

  attachToAgent: (companyId: string, agentId: string, layerId: string) =>
    api.post<void>(`/companies/${companyId}/agents/${agentId}/config-layers/${layerId}`, {}),

  detachFromAgent: (companyId: string, agentId: string, layerId: string) =>
    api.delete<void>(`/companies/${companyId}/agents/${agentId}/config-layers/${layerId}`),

  // Conflict check before attachment
  checkConflicts: (companyId: string, agentId: string, layerId: string) =>
    api.get<ConflictCheckResult>(
      `/companies/${companyId}/agents/${agentId}/config-layers/${layerId}/conflicts`,
    ),

  // Merge preview (what config will the agent actually get)
  mergePreview: (companyId: string, agentId: string) =>
    api.get<MergePreview>(`/companies/${companyId}/agents/${agentId}/config-layers/preview`),

  // MCP OAuth credentials
  getCredential: (companyId: string, itemId: string) =>
    api.get<McpCredential>(`/companies/${companyId}/config-layers/items/${itemId}/credential`),

  revokeCredential: (companyId: string, itemId: string) =>
    api.delete<void>(`/companies/${companyId}/config-layers/items/${itemId}/credential`),
};
