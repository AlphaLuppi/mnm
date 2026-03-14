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
