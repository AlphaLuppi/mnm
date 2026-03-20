import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { credentialProxyRules, companySecrets } from "@mnm/db";
import type {
  CredentialProxyRule,
  CredentialProxySecretMapping,
  CreateCredentialProxyRuleInput,
  UpdateCredentialProxyRuleInput,
} from "@mnm/shared";
import { notFound, conflict } from "../errors.js";

// cont-s02-rules-match
// Match a secret name against a pattern (exact, wildcard suffix, or global wildcard)
function matchesPattern(pattern: string, secretName: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return secretName.startsWith(prefix);
  }
  return pattern === secretName;
}

function formatRule(row: typeof credentialProxyRules.$inferSelect): CredentialProxyRule {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    secretPattern: row.secretPattern,
    allowedAgentRoles: row.allowedAgentRoles as string[],
    proxyEndpoint: row.proxyEndpoint,
    enabled: row.enabled,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function credentialProxyRulesService(db: Db) {
  // cont-s02-rules-list
  async function listRules(companyId: string): Promise<CredentialProxyRule[]> {
    const rows = await db
      .select()
      .from(credentialProxyRules)
      .where(eq(credentialProxyRules.companyId, companyId));
    return rows.map(formatRule);
  }

  // cont-s02-rules-get
  async function getRuleById(companyId: string, ruleId: string): Promise<CredentialProxyRule> {
    const [row] = await db
      .select()
      .from(credentialProxyRules)
      .where(
        and(
          eq(credentialProxyRules.id, ruleId),
          eq(credentialProxyRules.companyId, companyId),
        ),
      );
    if (!row) throw notFound("Credential proxy rule not found");
    return formatRule(row);
  }

  // cont-s02-rules-create
  async function createRule(
    companyId: string,
    input: CreateCredentialProxyRuleInput,
    actorId: string,
  ): Promise<CredentialProxyRule> {
    // Check unique name within company
    const existing = await db
      .select()
      .from(credentialProxyRules)
      .where(
        and(
          eq(credentialProxyRules.companyId, companyId),
          eq(credentialProxyRules.name, input.name),
        ),
      );
    if (existing.length > 0) {
      throw conflict(`Credential proxy rule with name "${input.name}" already exists`);
    }

    const [row] = await db
      .insert(credentialProxyRules)
      .values({
        companyId,
        name: input.name,
        secretPattern: input.secretPattern,
        allowedAgentRoles: input.allowedAgentRoles ?? ["*"],
        proxyEndpoint: input.proxyEndpoint ?? "http://credential-proxy:8090",
        enabled: input.enabled ?? true,
        createdByUserId: actorId,
      })
      .returning();

    return formatRule(row!);
  }

  // cont-s02-rules-update
  async function updateRule(
    companyId: string,
    ruleId: string,
    input: UpdateCredentialProxyRuleInput,
  ): Promise<CredentialProxyRule> {
    // Verify exists
    await getRuleById(companyId, ruleId);

    // Check name uniqueness if name is being changed
    if (input.name) {
      const existing = await db
        .select()
        .from(credentialProxyRules)
        .where(
          and(
            eq(credentialProxyRules.companyId, companyId),
            eq(credentialProxyRules.name, input.name),
            sql`${credentialProxyRules.id} != ${ruleId}`,
          ),
        );
      if (existing.length > 0) {
        throw conflict(`Credential proxy rule with name "${input.name}" already exists`);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.secretPattern !== undefined) updateData.secretPattern = input.secretPattern;
    if (input.allowedAgentRoles !== undefined) updateData.allowedAgentRoles = input.allowedAgentRoles;
    if (input.proxyEndpoint !== undefined) updateData.proxyEndpoint = input.proxyEndpoint;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const [updated] = await db
      .update(credentialProxyRules)
      .set(updateData)
      .where(
        and(
          eq(credentialProxyRules.id, ruleId),
          eq(credentialProxyRules.companyId, companyId),
        ),
      )
      .returning();

    return formatRule(updated!);
  }

  // cont-s02-rules-delete
  async function deleteRule(
    companyId: string,
    ruleId: string,
  ): Promise<CredentialProxyRule> {
    const rule = await getRuleById(companyId, ruleId);

    await db
      .delete(credentialProxyRules)
      .where(
        and(
          eq(credentialProxyRules.id, ruleId),
          eq(credentialProxyRules.companyId, companyId),
        ),
      );

    return rule;
  }

  // cont-s02-rules-match
  async function findMatchingRules(
    companyId: string,
    secretName: string,
  ): Promise<CredentialProxyRule[]> {
    const allRules = await db
      .select()
      .from(credentialProxyRules)
      .where(
        and(
          eq(credentialProxyRules.companyId, companyId),
          eq(credentialProxyRules.enabled, true),
        ),
      );

    return allRules
      .filter((rule) => matchesPattern(rule.secretPattern, secretName))
      .map(formatRule);
  }

  // cont-s02-rules-resolve
  async function resolveRulesForAgent(
    companyId: string,
    _agentId: string,
  ): Promise<CredentialProxySecretMapping[]> {
    // Get all enabled rules for the company
    const enabledRules = await db
      .select()
      .from(credentialProxyRules)
      .where(
        and(
          eq(credentialProxyRules.companyId, companyId),
          eq(credentialProxyRules.enabled, true),
        ),
      );

    // Get all company secrets to match against
    const secrets = await db
      .select()
      .from(companySecrets)
      .where(eq(companySecrets.companyId, companyId));

    const mappings: CredentialProxySecretMapping[] = [];

    for (const rule of enabledRules) {
      for (const secret of secrets) {
        if (matchesPattern(rule.secretPattern, secret.name)) {
          mappings.push({
            envKeyPlaceholder: secret.name,
            secretId: secret.id,
            secretName: secret.name,
            headerName: deriveHeaderName(secret.name),
            headerPrefix: deriveHeaderPrefix(secret.name),
            targetBaseUrl: rule.proxyEndpoint,
          });
        }
      }
    }

    return mappings;
  }

  return {
    listRules,
    getRuleById,
    createRule,
    updateRule,
    deleteRule,
    findMatchingRules,
    resolveRulesForAgent,
    matchesPattern,
  };
}

// Derive the HTTP header name from a secret name
function deriveHeaderName(secretName: string): string {
  const name = secretName.toLowerCase();
  if (name.includes("authorization") || name.includes("bearer")) return "Authorization";
  if (name.includes("anthropic") || name.includes("x-api-key") || name.includes("x_api_key")) return "x-api-key";
  return "Authorization";
}

// Derive the header prefix from a secret name
function deriveHeaderPrefix(secretName: string): string {
  const name = secretName.toLowerCase();
  if (name.includes("bearer") || name.includes("authorization")) return "Bearer ";
  return "";
}
