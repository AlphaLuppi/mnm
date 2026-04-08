import type {
  CONFIG_LAYER_ITEM_TYPES,
  CONFIG_LAYER_SCOPES,
  CONFIG_LAYER_VISIBILITIES,
  CONFIG_LAYER_SOURCE_TYPES,
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_STATUSES,
  CREDENTIAL_TYPES,
} from "../validators/config-layer.js";

// ─── Scalar type aliases ──────────────────────────────────────────────────────

export type ConfigLayerItemType = (typeof CONFIG_LAYER_ITEM_TYPES)[number];
export type ConfigLayerScope = (typeof CONFIG_LAYER_SCOPES)[number];
export type ConfigLayerVisibility = (typeof CONFIG_LAYER_VISIBILITIES)[number];
export type ConfigLayerSourceType = (typeof CONFIG_LAYER_SOURCE_TYPES)[number];
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];
// Backward-compat aliases
export type McpCredentialProvider = CredentialProvider;
export type McpCredentialStatus = CredentialStatus;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

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

// ─── Credentials ─────────────────────────────────────────────────────────────

export interface UserCredential {
  id: string;
  userId: string;
  companyId: string;
  itemId: string;
  provider: CredentialProvider;
  status: CredentialStatus;
  statusMessage: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

// Backward-compat alias
export type UserMcpCredential = UserCredential;

// ─── Resolved Git Provider ────────────────────────────────────────────────────

export interface ResolvedGitProvider {
  name: string;
  host: string;
  providerType: string;
  token?: string; // decrypte au runtime, JAMAIS persiste
}

// ─── Resolved Credential ─────────────────────────────────────────────────────

export interface ResolvedCredential {
  name: string;
  credentialType: string;
  /** Env var name → decrypted value, injected at runtime */
  env?: Record<string, string>;
}
