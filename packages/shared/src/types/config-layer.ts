import type {
  CONFIG_LAYER_ITEM_TYPES,
  CONFIG_LAYER_SCOPES,
  CONFIG_LAYER_VISIBILITIES,
  CONFIG_LAYER_SOURCE_TYPES,
  MCP_CREDENTIAL_PROVIDERS,
  MCP_CREDENTIAL_STATUSES,
} from "../validators/config-layer.js";

// ─── Scalar type aliases ──────────────────────────────────────────────────────

export type ConfigLayerItemType = (typeof CONFIG_LAYER_ITEM_TYPES)[number];
export type ConfigLayerScope = (typeof CONFIG_LAYER_SCOPES)[number];
export type ConfigLayerVisibility = (typeof CONFIG_LAYER_VISIBILITIES)[number];
export type ConfigLayerSourceType = (typeof CONFIG_LAYER_SOURCE_TYPES)[number];
export type McpCredentialProvider = (typeof MCP_CREDENTIAL_PROVIDERS)[number];
export type McpCredentialStatus = (typeof MCP_CREDENTIAL_STATUSES)[number];

// ─── Core entity interfaces ───────────────────────────────────────────────────

export interface ConfigLayer {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  icon: string | null;
  scope: ConfigLayerScope;
  enforced: boolean;
  visibility: ConfigLayerVisibility;
  createdByUserId: string | null;
  promotionStatus: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigLayerItem {
  id: string;
  layerId: string;
  companyId: string;
  itemType: ConfigLayerItemType;
  name: string;
  displayName: string | null;
  description: string | null;
  configJson: Record<string, unknown>;
  sourceType: ConfigLayerSourceType;
  sourceUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigLayerFile {
  id: string;
  layerId: string;
  companyId: string;
  path: string;
  content: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Composite / detail types ─────────────────────────────────────────────────

export interface ConfigLayerDetail extends ConfigLayer {
  items: ConfigLayerItem[];
}

export interface AgentConfigLayerAttachment {
  agentId: string;
  layerId: string;
  priority: number;
  attachedBy: string | null;
  attachedAt: string;
  layer: ConfigLayer;
}

// ─── Revision / audit ─────────────────────────────────────────────────────────

export interface ConfigLayerRevision {
  id: string;
  layerId: string;
  version: number;
  changedKeys: string[];
  afterSnapshot: Record<string, unknown>;
  changedBy: string | null;
  changeSource: string;
  changeMessage: string | null;
  createdAt: string;
}

// ─── Conflict resolution ──────────────────────────────────────────────────────

export type ConflictSeverity =
  | "enforced_conflict"
  | "priority_conflict"
  | "override_conflict";

export interface ConfigLayerConflict {
  itemType: ConfigLayerItemType;
  name: string;
  severity: ConflictSeverity;
  existingLayerId: string;
  existingLayerName: string;
  existingPriority: number;
  candidatePriority: number;
}

export interface ConflictCheckResult {
  conflicts: ConfigLayerConflict[];
  canAttach: boolean;
}

// ─── Merge preview ────────────────────────────────────────────────────────────

export interface MergedConfigItem {
  id: string;
  itemType: ConfigLayerItemType;
  name: string;
  configJson: Record<string, unknown>;
  priority: number;
  layerId: string;
}

export interface MergePreviewResult {
  items: MergedConfigItem[];
  layerSources: Array<{ layerId: string; layerName: string; priority: number }>;
}

// ─── MCP credentials ──────────────────────────────────────────────────────────

export interface UserMcpCredential {
  id: string;
  userId: string;
  companyId: string;
  itemId: string;
  provider: McpCredentialProvider;
  status: McpCredentialStatus;
  statusMessage: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}
