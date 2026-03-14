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

// sso-s02-type-login-initiation
export interface SsoLoginInitiation {
  provider: SsoProvider;
  companyId: string;
  loginUrl: string;
  state?: string;
}

// sso-s02-type-discover-result
export interface SsoDiscoverResult {
  provider: SsoProvider | null;
  companyId?: string;
  loginUrl?: string;
}

// sso-s02-type-auth-result
export interface SsoAuthResult {
  userId: string;
  email: string;
  name: string | null;
  isNewUser: boolean;
  companyId: string;
  provider: SsoProvider;
}

// sso-s02-type-saml-config
export interface SsoSamlConfig {
  entityId: string;
  acsUrl: string;
  metadataUrl?: string;
  certificate?: string;
  signatureAlgorithm?: string;
}

// sso-s02-type-oidc-config
export interface SsoOidcConfig {
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  redirectUri: string;
  scopes?: string[];
}

// sso-s02-type-metadata-sync
export interface SsoMetadataSyncResult {
  entityId: string | null;
  certificate: string | null;
  endpoints: Record<string, string>;
}
