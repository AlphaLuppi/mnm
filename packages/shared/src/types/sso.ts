// sso-s01-type-provider
export const SSO_PROVIDERS = ["saml", "oidc"] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

// sso-s01-type-status
export const SSO_CONFIG_STATUSES = ["draft", "verified", "error"] as const;
export type SsoConfigStatus = (typeof SSO_CONFIG_STATUSES)[number];

// sso-s01-type-config
export interface SsoConfiguration {
  id: string;
  companyId: string;
  provider: SsoProvider;
  displayName: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  emailDomain: string | null;
  metadataUrl: string | null;
  entityId: string | null;
  certificate: string | null;
  status: SsoConfigStatus;
  verifiedAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// sso-s01-type-create-input
export interface CreateSsoConfigurationInput {
  provider: SsoProvider;
  displayName?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
  emailDomain?: string;
  metadataUrl?: string;
  entityId?: string;
  certificate?: string;
}

// sso-s01-type-update-input
export interface UpdateSsoConfigurationInput {
  displayName?: string;
  config?: Record<string, unknown>;
  emailDomain?: string;
  metadataUrl?: string;
  entityId?: string;
  certificate?: string;
}
