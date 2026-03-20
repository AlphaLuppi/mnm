// cont-s02-type-rule
export interface CredentialProxyRule {
  id: string;
  companyId: string;
  name: string;
  secretPattern: string;
  allowedAgentRoles: string[];
  proxyEndpoint: string;
  enabled: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// cont-s02-type-config
export interface CredentialProxyConfig {
  enabled: boolean;
  port: number;
  instanceId: string;
  agentId: string;
  companyId: string;
  secretMappings: CredentialProxySecretMapping[];
}

// cont-s02-type-mapping
export interface CredentialProxySecretMapping {
  envKeyPlaceholder: string;   // "ANTHROPIC_API_KEY"
  secretId: string;            // UUID
  secretName: string;          // "anthropic-api-key"
  headerName: string;          // "x-api-key"
  headerPrefix: string;        // "" or "Bearer "
  targetBaseUrl: string;       // "https://api.anthropic.com"
}

// cont-s02-type-proxy-status
export interface CredentialProxyStatus {
  instanceId: string;
  port: number;
  active: boolean;
  requestCount: number;
  lastRequestAt: string | null;
  secretsResolved: number;
  secretsDenied: number;
}

// cont-s02-type-access-event
export interface CredentialProxyAccessEvent {
  instanceId: string;
  agentId: string;
  companyId: string;
  secretName: string;
  action: "accessed" | "denied" | "error";
  reason?: string;
  timestamp: string;
}

// cont-s02-type-create-input
export interface CreateCredentialProxyRuleInput {
  name: string;
  secretPattern: string;
  allowedAgentRoles?: string[];
  proxyEndpoint?: string;
  enabled?: boolean;
}

// cont-s02-type-update-input
export interface UpdateCredentialProxyRuleInput {
  name?: string;
  secretPattern?: string;
  allowedAgentRoles?: string[];
  proxyEndpoint?: string;
  enabled?: boolean;
}

// cont-s02-type-test-result
export interface CredentialProxyTestResult {
  matched: boolean;
  rule: CredentialProxyRule | null;
  secretFound: boolean;
  secretName: string;
  reason?: string;
}
