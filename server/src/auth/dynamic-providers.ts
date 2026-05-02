import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { oauthConnectors } from "@mnm/db";
import { decryptSecret } from "../services/secret-crypto.js";
import { logger } from "../middleware/logger.js";

/**
 * BetterAuth Generic OAuth provider config shape.
 * (We type it loosely here because BetterAuth's plugin API uses untyped
 * record values internally — `socialProviders[slug] = genericOAuth(config)`.)
 */
export interface DynamicOAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  redirectURI?: string;
}

export type DynamicProvidersMap = Record<string, DynamicOAuthProviderConfig>;

/**
 * Lookup all enabled type=oauth2 connectors for a given company and return
 * them as a `socialProviders` map suitable for BetterAuth Generic OAuth.
 *
 * V0 single-process / single-tenant: callers pass the active companyId.
 * V1 (out of scope): per-request resolver + LISTEN/NOTIFY hot-reload.
 *
 * The returned map intentionally decrypts client_secret via the shared
 * `secret-crypto` helper. The host process keeps these in memory only —
 * they are NEVER serialised back to clients.
 */
export async function resolveDynamicProviders(
  db: Db,
  companyId: string,
): Promise<DynamicProvidersMap> {
  const rows = await db
    .select()
    .from(oauthConnectors)
    .where(
      and(
        eq(oauthConnectors.companyId, companyId),
        eq(oauthConnectors.enabled, true),
        eq(oauthConnectors.type, "oauth2"),
      ),
    );

  const result: DynamicProvidersMap = {};
  for (const row of rows) {
    if (
      !row.authorizationUrl ||
      !row.tokenUrl ||
      !row.clientId ||
      !row.clientSecretIv ||
      !row.clientSecretCiphertext ||
      !row.clientSecretTag
    ) {
      logger.warn(
        { connectorId: row.id, providerSlug: row.providerSlug },
        "[dynamic-providers] connector mis-configured (missing required fields), skipping",
      );
      continue;
    }
    let clientSecret: string;
    try {
      clientSecret = decryptSecret({
        iv: row.clientSecretIv,
        ciphertext: row.clientSecretCiphertext,
        tag: row.clientSecretTag,
      });
    } catch (err) {
      logger.error(
        { err, connectorId: row.id, providerSlug: row.providerSlug },
        "[dynamic-providers] client_secret decrypt failed (KEY rotated? data corruption?)",
      );
      continue;
    }
    result[row.providerSlug] = {
      clientId: row.clientId,
      clientSecret,
      authorizationUrl: row.authorizationUrl,
      tokenUrl: row.tokenUrl,
      userInfoUrl: row.userinfoUrl ?? undefined,
      scopes: row.scopes ?? [],
      redirectURI: row.redirectUri ?? undefined,
    };
  }
  return result;
}

/**
 * Merge dynamic DB-managed providers with env-var-based providers.
 * **DB wins** when slugs collide (T3.5 backward compat: `gitlab`/`microsoft`
 * env vars are fallback only — the DB connector takes precedence).
 *
 * Used in createBetterAuthInstance to assemble the final socialProviders map.
 */
export function mergeProviderConfigs<T>(
  envProviders: Record<string, T>,
  dbProviders: Record<string, T>,
): Record<string, T> {
  return { ...envProviders, ...dbProviders };
}
