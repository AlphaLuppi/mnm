import { api } from "./client";

// CONNECTORS-PLATFORM Sprint 2 — Task 6/7 UI client. Wraps the 10 endpoints
// shipped in `server/src/routes/connectors.ts` (T5).

export type ConnectorType = "oauth2" | "api_key";
export type ConnectorStatus = "connected" | "disconnected" | "expired" | "revoked";

export interface ConnectorTemplate {
  slug: string;
  displayName: string;
  type: ConnectorType;
  tagline: string;
  icon: string;
  scopes?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  refreshSupported?: boolean;
  apiKeyLabel?: string;
  docsUrl?: string;
}

export interface Connector {
  id: string;
  providerSlug: string;
  displayName: string;
  type: ConnectorType;
  scopes: string[] | null;
  enabled: boolean;
  clientId: string | null;
  clientSecretConfigured: boolean;
  apiKeyLabel: string | null;
  refreshSupported: boolean;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  userinfoUrl: string | null;
  redirectUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorAuditEntry {
  id: string;
  companyId: string;
  connectorId: string | null;
  actorUserId: string | null;
  action: string;
  diffJson: Record<string, unknown>;
  createdAt: string;
}

export interface MyConnectedAccount {
  id: string;
  providerSlug: string;
  displayName: string;
  type: ConnectorType;
  enabled: boolean;
  scopes: string[] | null;
  apiKeyLabel: string | null;
  status: ConnectorStatus;
  scopesGranted: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface CreateConnectorPayload {
  templateSlug?: string;
  providerSlug?: string;
  displayName?: string;
  type?: ConnectorType;
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  userinfoUrl?: string | null;
  scopes?: string[];
  redirectUri?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  refreshSupported?: boolean;
  apiKeyLabel?: string | null;
  enabled?: boolean;
}

export interface UpdateConnectorPayload {
  displayName?: string;
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  userinfoUrl?: string | null;
  scopes?: string[];
  redirectUri?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  refreshSupported?: boolean;
  apiKeyLabel?: string | null;
  enabled?: boolean;
}

export const connectorsApi = {
  // Admin
  list: (companyId: string) =>
    api.get<{ connectors: Connector[] }>(`/companies/${companyId}/connectors`),
  templates: (companyId: string) =>
    api.get<{ templates: ConnectorTemplate[] }>(
      `/companies/${companyId}/connectors/templates`,
    ),
  create: (companyId: string, payload: CreateConnectorPayload) =>
    api.post<Connector>(`/companies/${companyId}/connectors`, payload),
  update: (companyId: string, id: string, payload: UpdateConnectorPayload) =>
    api.patch<Connector>(
      `/companies/${companyId}/connectors/${encodeURIComponent(id)}`,
      payload,
    ),
  remove: (companyId: string, id: string) =>
    api.delete<void>(`/companies/${companyId}/connectors/${encodeURIComponent(id)}`),
  audit: (companyId: string, id: string, limit = 50) =>
    api.get<{ audit: ConnectorAuditEntry[] }>(
      `/companies/${companyId}/connectors/${encodeURIComponent(id)}/audit?limit=${limit}`,
    ),

  // User self-service
  myAccounts: (companyId: string) =>
    api.get<{ accounts: MyConnectedAccount[] }>(
      `/companies/${companyId}/me/connected-accounts`,
    ),
  startConnect: (companyId: string, connectorId: string, redirectAfter?: string) =>
    api.post<{ authorizeUrl: string }>(
      `/companies/${companyId}/me/connect/${encodeURIComponent(connectorId)}`,
      { redirectAfter },
    ),
  setApiKey: (companyId: string, connectorId: string, key: string) =>
    api.post<void>(
      `/companies/${companyId}/me/api-key/${encodeURIComponent(connectorId)}`,
      { key },
    ),
  disconnect: (companyId: string, connectorId: string) =>
    api.delete<void>(
      `/companies/${companyId}/me/connected-accounts/${encodeURIComponent(connectorId)}`,
    ),
};
