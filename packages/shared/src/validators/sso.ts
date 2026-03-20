import { z } from "zod";

// sso-s01-validator-create
export const createSsoConfigurationSchema = z.object({
  provider: z.enum(["saml", "oidc"]),
  displayName: z.string().min(1).max(200).trim().optional(),
  config: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(false),
  emailDomain: z.string().min(1).max(253).trim()
    .refine(
      (v) => /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(v),
      "Invalid email domain format",
    )
    .optional(),
  metadataUrl: z.string().url().max(2000).optional(),
  entityId: z.string().min(1).max(500).trim().optional(),
  certificate: z.string().min(1).max(10000).trim().optional(),
});

// sso-s01-validator-update
export const updateSsoConfigurationSchema = z.object({
  displayName: z.string().min(1).max(200).trim().optional(),
  config: z.record(z.unknown()).optional(),
  emailDomain: z.string().min(1).max(253).trim()
    .refine(
      (v) => /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(v),
      "Invalid email domain format",
    )
    .optional(),
  metadataUrl: z.string().url().max(2000).optional(),
  entityId: z.string().min(1).max(500).trim().optional(),
  certificate: z.string().min(1).max(10000).trim().optional(),
});

export type CreateSsoConfiguration = z.infer<typeof createSsoConfigurationSchema>;
export type UpdateSsoConfiguration = z.infer<typeof updateSsoConfigurationSchema>;

// sso-s02-validator-discover
export const ssoDiscoverSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

// sso-s02-validator-saml-config
export const ssoSamlConfigSchema = z.object({
  entityId: z.string().min(1).max(500).trim(),
  acsUrl: z.string().url().max(2000),
  metadataUrl: z.string().url().max(2000).optional(),
  certificate: z.string().min(1).max(10000).trim().optional(),
  signatureAlgorithm: z.string().min(1).max(100).trim().optional(),
});

// sso-s02-validator-oidc-config
export const ssoOidcConfigSchema = z.object({
  clientId: z.string().min(1).max(500).trim(),
  clientSecret: z.string().min(1).max(1000).trim(),
  discoveryUrl: z.string().url().max(2000),
  redirectUri: z.string().url().max(2000).optional(),
  scopes: z.array(z.string().min(1).max(100)).optional(),
});

export type SsoDiscover = z.infer<typeof ssoDiscoverSchema>;
export type SsoSamlConfigInput = z.infer<typeof ssoSamlConfigSchema>;
export type SsoOidcConfigInput = z.infer<typeof ssoOidcConfigSchema>;
