import { z } from "zod";

// cont-s02-validator-create-rule
export const createCredentialProxyRuleSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  secretPattern: z.string().min(1).max(200).trim()
    .refine(
      (v) => /^[A-Za-z0-9_*-]+$/.test(v),
      "Secret pattern must contain only alphanumeric, underscore, hyphen, or wildcard (*)"
    ),
  allowedAgentRoles: z.array(z.string().min(1).max(50)).min(1).default(["*"]),
  proxyEndpoint: z.string().url().max(500).optional(),
  enabled: z.boolean().optional().default(true),
});

// cont-s02-validator-update-rule
export const updateCredentialProxyRuleSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  secretPattern: z.string().min(1).max(200).trim()
    .refine(
      (v) => /^[A-Za-z0-9_*-]+$/.test(v),
      "Secret pattern must contain only alphanumeric, underscore, hyphen, or wildcard (*)"
    )
    .optional(),
  allowedAgentRoles: z.array(z.string().min(1).max(50)).min(1).optional(),
  proxyEndpoint: z.string().url().max(500).optional(),
  enabled: z.boolean().optional(),
});

// cont-s02-validator-test-rule
export const testCredentialProxyRuleSchema = z.object({
  secretName: z.string().min(1).max(200).trim(),
  agentId: z.string().uuid().optional(),
});

export type CreateCredentialProxyRule = z.infer<typeof createCredentialProxyRuleSchema>;
export type UpdateCredentialProxyRule = z.infer<typeof updateCredentialProxyRuleSchema>;
export type TestCredentialProxyRule = z.infer<typeof testCredentialProxyRuleSchema>;
