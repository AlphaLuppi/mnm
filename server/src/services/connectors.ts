import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  oauthConnectors,
  connectorTokens,
  userApiKeys,
  oauthConnectorsAudit,
} from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { encryptSecret, decryptSecret } from "./secret-crypto.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectorType = "oauth2" | "api_key";

export interface CreateConnectorInput {
  providerSlug: string;
  displayName: string;
  type: ConnectorType;
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

export interface UpdateConnectorInput {
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

export interface UserTokenResult {
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
  type: ConnectorType;
}

export class ConnectorError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "ConnectorError";
  }
}

// ─── Service factory ──────────────────────────────────────────────────────────

export function connectorService(db: Db) {
  // ─── URL validation (defense-in-depth, server-side) ────────────────────────
  function validateOAuthUrl(url: string, fieldName: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw badRequest(`Invalid URL for ${fieldName}: ${url}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw badRequest(`URL ${fieldName} must use http(s)`);
    }
    // Block private/loopback IPs explicitly to prevent SSRF
    const host = parsed.hostname;
    const privateRanges = [
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/i,
    ];
    if (process.env.NODE_ENV === "production") {
      // In dev, localhost is allowed for testing.
      // In prod, refuse private networks.
      for (const re of privateRanges) {
        if (re.test(host)) {
          throw badRequest(`URL ${fieldName} cannot target a private/loopback address: ${host}`);
        }
      }
    }
  }

  function validateConnectorShape(input: CreateConnectorInput): void {
    if (input.type === "oauth2") {
      if (!input.authorizationUrl) throw badRequest("authorizationUrl required for oauth2 connector");
      if (!input.tokenUrl) throw badRequest("tokenUrl required for oauth2 connector");
      if (!input.clientId) throw badRequest("clientId required for oauth2 connector");
      if (!input.clientSecret) throw badRequest("clientSecret required for oauth2 connector");
      validateOAuthUrl(input.authorizationUrl, "authorization_url");
      validateOAuthUrl(input.tokenUrl, "token_url");
      if (input.userinfoUrl) validateOAuthUrl(input.userinfoUrl, "userinfo_url");
    } else if (input.type === "api_key") {
      if (!input.apiKeyLabel) throw badRequest("apiKeyLabel required for api_key connector");
    } else {
      throw badRequest(`Unknown connector type: ${input.type}`);
    }
  }

  // ─── Audit helper (fire-and-forget on hot path, awaited otherwise) ─────────
  async function recordAudit(args: {
    companyId: string;
    connectorId: string | null;
    actorUserId: string | null;
    action:
      | "connector_created"
      | "connector_updated"
      | "connector_deleted"
      | "connector_enabled"
      | "connector_disabled"
      | "user_connected"
      | "user_disconnected"
      | "user_refresh_failed"
      | "user_token_revoked"
      | "token_used"
      | "redirect_after_rejected";
    diffJson?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.insert(oauthConnectorsAudit).values({
        companyId: args.companyId,
        connectorId: args.connectorId,
        actorUserId: args.actorUserId,
        action: args.action,
        diffJson: args.diffJson ?? {},
      });
    } catch (err) {
      logger.warn({ err, args: { ...args, diffJson: undefined } }, "[connectors] audit insert failed (non-fatal)");
    }
  }

  // Sample 1/100 fire-and-forget — not awaited in hot path of getUserToken
  function maybeAuditTokenUsed(companyId: string, connectorId: string, userId: string): void {
    if (Math.random() >= 0.01) return;
    void recordAudit({
      companyId,
      connectorId,
      actorUserId: userId,
      action: "token_used",
    });
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async function listConnectors(companyId: string) {
    return db
      .select({
        id: oauthConnectors.id,
        providerSlug: oauthConnectors.providerSlug,
        displayName: oauthConnectors.displayName,
        type: oauthConnectors.type,
        scopes: oauthConnectors.scopes,
        enabled: oauthConnectors.enabled,
        clientId: oauthConnectors.clientId,
        // never return secret material to callers
        clientSecretConfigured: sql<boolean>`(${oauthConnectors.clientSecretCiphertext} IS NOT NULL)`,
        apiKeyLabel: oauthConnectors.apiKeyLabel,
        refreshSupported: oauthConnectors.refreshSupported,
        authorizationUrl: oauthConnectors.authorizationUrl,
        tokenUrl: oauthConnectors.tokenUrl,
        userinfoUrl: oauthConnectors.userinfoUrl,
        redirectUri: oauthConnectors.redirectUri,
        createdAt: oauthConnectors.createdAt,
        updatedAt: oauthConnectors.updatedAt,
      })
      .from(oauthConnectors)
      .where(eq(oauthConnectors.companyId, companyId));
  }

  async function getConnectorById(id: string, companyId: string) {
    const [row] = await db
      .select()
      .from(oauthConnectors)
      .where(and(eq(oauthConnectors.id, id), eq(oauthConnectors.companyId, companyId)));
    if (!row) throw notFound(`Connector not found: ${id}`);
    return row;
  }

  async function getActiveConnectorBySlug(companyId: string, providerSlug: string) {
    const [row] = await db
      .select()
      .from(oauthConnectors)
      .where(
        and(
          eq(oauthConnectors.companyId, companyId),
          eq(oauthConnectors.providerSlug, providerSlug),
          eq(oauthConnectors.enabled, true),
        ),
      );
    return row ?? null;
  }

  async function createConnector(
    companyId: string,
    actorUserId: string,
    input: CreateConnectorInput,
  ) {
    validateConnectorShape(input);

    const existingConnector = await db
      .select({ id: oauthConnectors.id })
      .from(oauthConnectors)
      .where(
        and(
          eq(oauthConnectors.companyId, companyId),
          eq(oauthConnectors.providerSlug, input.providerSlug),
        ),
      );
    if (existingConnector.length > 0) {
      throw conflict(`Connector with slug '${input.providerSlug}' already exists for this company`);
    }

    const encryptedSecret =
      input.type === "oauth2" && input.clientSecret
        ? encryptSecret(input.clientSecret)
        : null;

    const [created] = await db
      .insert(oauthConnectors)
      .values({
        companyId,
        providerSlug: input.providerSlug,
        displayName: input.displayName,
        type: input.type,
        authorizationUrl: input.authorizationUrl ?? null,
        tokenUrl: input.tokenUrl ?? null,
        userinfoUrl: input.userinfoUrl ?? null,
        scopes: input.scopes ?? [],
        redirectUri: input.redirectUri ?? null,
        clientId: input.clientId ?? null,
        clientSecretIv: encryptedSecret?.iv ?? null,
        clientSecretCiphertext: encryptedSecret?.ciphertext ?? null,
        clientSecretTag: encryptedSecret?.tag ?? null,
        refreshSupported: input.refreshSupported ?? true,
        apiKeyLabel: input.apiKeyLabel ?? null,
        enabled: input.enabled ?? true,
        createdByUserId: actorUserId,
      })
      .returning();

    await recordAudit({
      companyId,
      connectorId: created.id,
      actorUserId,
      action: "connector_created",
      diffJson: {
        providerSlug: created.providerSlug,
        type: created.type,
        scopes: created.scopes,
      },
    });

    return created;
  }

  async function updateConnector(
    id: string,
    companyId: string,
    actorUserId: string,
    input: UpdateConnectorInput,
  ) {
    const existing = await getConnectorById(id, companyId);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.authorizationUrl !== undefined) {
      if (input.authorizationUrl) validateOAuthUrl(input.authorizationUrl, "authorization_url");
      patch.authorizationUrl = input.authorizationUrl;
    }
    if (input.tokenUrl !== undefined) {
      if (input.tokenUrl) validateOAuthUrl(input.tokenUrl, "token_url");
      patch.tokenUrl = input.tokenUrl;
    }
    if (input.userinfoUrl !== undefined) {
      if (input.userinfoUrl) validateOAuthUrl(input.userinfoUrl, "userinfo_url");
      patch.userinfoUrl = input.userinfoUrl;
    }
    if (input.scopes !== undefined) patch.scopes = input.scopes;
    if (input.redirectUri !== undefined) patch.redirectUri = input.redirectUri;
    if (input.clientId !== undefined) patch.clientId = input.clientId;
    if (input.clientSecret !== undefined && input.clientSecret !== null) {
      const enc = encryptSecret(input.clientSecret);
      patch.clientSecretIv = enc.iv;
      patch.clientSecretCiphertext = enc.ciphertext;
      patch.clientSecretTag = enc.tag;
    }
    if (input.refreshSupported !== undefined) patch.refreshSupported = input.refreshSupported;
    if (input.apiKeyLabel !== undefined) patch.apiKeyLabel = input.apiKeyLabel;
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    const [updated] = await db
      .update(oauthConnectors)
      .set(patch)
      .where(and(eq(oauthConnectors.id, id), eq(oauthConnectors.companyId, companyId)))
      .returning();

    await recordAudit({
      companyId,
      connectorId: id,
      actorUserId,
      action: input.enabled === true && !existing.enabled
        ? "connector_enabled"
        : input.enabled === false && existing.enabled
          ? "connector_disabled"
          : "connector_updated",
      diffJson: {
        // never store secret material in audit
        changedFields: Object.keys(patch).filter((k) => !k.startsWith("clientSecret")),
      },
    });

    return updated;
  }

  async function deleteConnector(id: string, companyId: string, actorUserId: string) {
    const existing = await getConnectorById(id, companyId);
    await db
      .delete(oauthConnectors)
      .where(and(eq(oauthConnectors.id, id), eq(oauthConnectors.companyId, companyId)));
    await recordAudit({
      companyId,
      connectorId: null, // deleted, FK SET NULL
      actorUserId,
      action: "connector_deleted",
      diffJson: { providerSlug: existing.providerSlug, type: existing.type },
    });
  }

  // ─── Cross-tenant guard (C2) ───────────────────────────────────────────────

  async function assertUserInCompany(userId: string, companyId: string): Promise<void> {
    const result = await db.execute(
      sql`SELECT 1 FROM company_memberships
          WHERE principal_type = 'user'
            AND principal_id = ${userId}
            AND company_id = ${companyId}::uuid
            AND status = 'active'
          LIMIT 1`,
    );
    if ((result as unknown as { length: number }).length === 0) {
      throw new ConnectorError(
        "CONNECTOR_USER_NOT_IN_COMPANY",
        `User ${userId} is not an active member of company ${companyId}`,
      );
    }
  }

  // ─── User token storage (oauth2) ────────────────────────────────────────────

  async function getConnectorTokenRow(userId: string, connectorId: string) {
    const [row] = await db
      .select()
      .from(connectorTokens)
      .where(
        and(
          eq(connectorTokens.userId, userId),
          eq(connectorTokens.connectorId, connectorId),
        ),
      );
    return row ?? null;
  }

  async function upsertConnectorToken(args: {
    companyId: string;
    userId: string;
    connectorId: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date | null;
    scopesGranted: string[];
  }) {
    const accessEnc = encryptSecret(args.accessToken);
    const refreshEnc = args.refreshToken ? encryptSecret(args.refreshToken) : null;

    return db
      .insert(connectorTokens)
      .values({
        companyId: args.companyId,
        userId: args.userId,
        connectorId: args.connectorId,
        accessTokenIv: accessEnc.iv,
        accessTokenCiphertext: accessEnc.ciphertext,
        accessTokenTag: accessEnc.tag,
        refreshTokenIv: refreshEnc?.iv ?? null,
        refreshTokenCiphertext: refreshEnc?.ciphertext ?? null,
        refreshTokenTag: refreshEnc?.tag ?? null,
        expiresAt: args.expiresAt,
        scopesGranted: args.scopesGranted,
      })
      .onConflictDoUpdate({
        target: [connectorTokens.userId, connectorTokens.connectorId],
        set: {
          accessTokenIv: accessEnc.iv,
          accessTokenCiphertext: accessEnc.ciphertext,
          accessTokenTag: accessEnc.tag,
          refreshTokenIv: refreshEnc?.iv ?? null,
          refreshTokenCiphertext: refreshEnc?.ciphertext ?? null,
          refreshTokenTag: refreshEnc?.tag ?? null,
          expiresAt: args.expiresAt,
          scopesGranted: args.scopesGranted,
          updatedAt: new Date(),
        },
      })
      .returning();
  }

  // ─── OAuth refresh ──────────────────────────────────────────────────────────

  async function refreshOAuthTokenInner(
    connector: typeof oauthConnectors.$inferSelect,
    tokenRow: typeof connectorTokens.$inferSelect,
  ): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
  } | null> {
    if (!tokenRow.refreshTokenIv || !tokenRow.refreshTokenCiphertext || !tokenRow.refreshTokenTag) {
      return null;
    }
    if (!connector.tokenUrl || !connector.clientId) return null;
    if (!connector.clientSecretIv || !connector.clientSecretCiphertext || !connector.clientSecretTag) {
      return null;
    }

    const refreshToken = decryptSecret({
      iv: tokenRow.refreshTokenIv,
      ciphertext: tokenRow.refreshTokenCiphertext,
      tag: tokenRow.refreshTokenTag,
    });
    const clientSecret = decryptSecret({
      iv: connector.clientSecretIv,
      ciphertext: connector.clientSecretCiphertext,
      tag: connector.clientSecretTag,
    });

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: connector.clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(connector.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (response.status === 401 || response.status === 400) {
      // token revoked / expired refresh on provider side
      return null;
    }
    if (!response.ok) {
      throw new ConnectorError(
        "CONNECTOR_REFRESH_FAILED",
        `Refresh failed with status ${response.status}`,
      );
    }

    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!json.access_token) {
      throw new ConnectorError("CONNECTOR_REFRESH_FAILED", "Provider returned no access_token");
    }

    return {
      accessToken: json.access_token,
      // some providers rotate refresh_token (Microsoft, Google) — keep new one if present
      refreshToken: json.refresh_token ?? null,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  }

  // ─── User API key storage (api_key) ─────────────────────────────────────────

  async function setUserApiKey(args: {
    userId: string;
    connectorId: string;
    key: string;
    companyId: string;
  }): Promise<void> {
    await assertUserInCompany(args.userId, args.companyId);

    // verify connector belongs to company and is api_key type
    const connector = await getConnectorById(args.connectorId, args.companyId);
    if (connector.type !== "api_key") {
      throw badRequest(
        `Connector ${connector.providerSlug} is not an api_key connector (type=${connector.type})`,
      );
    }

    const encrypted = encryptSecret(args.key);
    await db
      .insert(userApiKeys)
      .values({
        companyId: args.companyId,
        userId: args.userId,
        connectorId: args.connectorId,
        keyIv: encrypted.iv,
        keyCiphertext: encrypted.ciphertext,
        keyTag: encrypted.tag,
      })
      .onConflictDoUpdate({
        target: [userApiKeys.userId, userApiKeys.connectorId],
        set: {
          keyIv: encrypted.iv,
          keyCiphertext: encrypted.ciphertext,
          keyTag: encrypted.tag,
          updatedAt: new Date(),
        },
      });

    await recordAudit({
      companyId: args.companyId,
      connectorId: args.connectorId,
      actorUserId: args.userId,
      action: "user_connected",
      diffJson: { method: "api_key" },
    });
  }

  async function deleteUserApiKey(args: {
    userId: string;
    connectorId: string;
    companyId: string;
  }): Promise<void> {
    await assertUserInCompany(args.userId, args.companyId);
    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, args.userId),
          eq(userApiKeys.connectorId, args.connectorId),
          eq(userApiKeys.companyId, args.companyId),
        ),
      );
    await recordAudit({
      companyId: args.companyId,
      connectorId: args.connectorId,
      actorUserId: args.userId,
      action: "user_disconnected",
      diffJson: { method: "api_key" },
    });
  }

  async function getUserApiKey(userId: string, connectorId: string, companyId: string) {
    const [row] = await db
      .select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.connectorId, connectorId),
          eq(userApiKeys.companyId, companyId),
        ),
      );
    return row ?? null;
  }

  async function disconnectUser(args: {
    userId: string;
    connectorId: string;
    companyId: string;
  }): Promise<void> {
    await assertUserInCompany(args.userId, args.companyId);

    const connector = await getConnectorById(args.connectorId, args.companyId);
    if (connector.type === "api_key") {
      await deleteUserApiKey(args);
      return;
    }

    await db
      .delete(connectorTokens)
      .where(
        and(
          eq(connectorTokens.userId, args.userId),
          eq(connectorTokens.connectorId, args.connectorId),
          eq(connectorTokens.companyId, args.companyId),
        ),
      );
    await recordAudit({
      companyId: args.companyId,
      connectorId: args.connectorId,
      actorUserId: args.userId,
      action: "user_disconnected",
      diffJson: { method: "oauth2" },
    });
  }

  // ─── getUserToken — central helper (HOST-ONLY, decision-log §4.4) ──────────

  /**
   * Resolves the active access token for `userId` on `providerSlug` within
   * `companyId`. Refreshes if expired (under advisory lock to prevent races).
   *
   * SECURITY:
   *  - C2 cross-tenant guard: throws CONNECTOR_USER_NOT_IN_COMPANY if userId
   *    is not an active member of companyId. MANDATORY before any token lookup.
   *  - HOST-ONLY: this function NEVER crosses an isolate boundary. The
   *    returned token must not be sent to gate-runner / hooks / sandboxes —
   *    use helpers.http({provider:"x"}) which injects Authorization on the
   *    host side instead.
   *  - B1 refresh race: pg_advisory_xact_lock prevents concurrent refreshes
   *    of the same token; re-read inside lock to handle concurrent callers.
   *  - Audit `token_used` is sampled 1/100 fire-and-forget (not awaited).
   */
  async function getUserToken(
    userId: string,
    providerSlug: string,
    companyId: string,
  ): Promise<UserTokenResult> {
    // C2 cross-tenant guard — MANDATORY before any token lookup
    await assertUserInCompany(userId, companyId);

    const connector = await getActiveConnectorBySlug(companyId, providerSlug);
    if (!connector) {
      throw new ConnectorError(
        "CONNECTOR_NOT_CONFIGURED",
        `No enabled connector with slug '${providerSlug}' for company`,
      );
    }

    if (connector.type === "api_key") {
      const apiKey = await getUserApiKey(userId, connector.id, companyId);
      if (!apiKey) {
        throw new ConnectorError(
          "CONNECTOR_USER_NOT_CONNECTED",
          `User has not configured an API key for ${providerSlug}`,
        );
      }
      const decrypted = decryptSecret({
        iv: apiKey.keyIv,
        ciphertext: apiKey.keyCiphertext,
        tag: apiKey.keyTag,
      });
      maybeAuditTokenUsed(companyId, connector.id, userId);
      // Update last_used_at (fire-and-forget, no await)
      void db
        .update(userApiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(userApiKeys.id, apiKey.id))
        .catch((err) => logger.warn({ err }, "[connectors] failed to update last_used_at on user_api_keys"));
      return {
        accessToken: decrypted,
        expiresAt: null,
        scopes: [],
        type: "api_key",
      };
    }

    // oauth2 path
    const tokenRow = await getConnectorTokenRow(userId, connector.id);
    if (!tokenRow) {
      throw new ConnectorError(
        "CONNECTOR_USER_NOT_CONNECTED",
        `User has not connected ${providerSlug}`,
      );
    }

    const isExpired =
      tokenRow.expiresAt !== null && tokenRow.expiresAt.getTime() <= Date.now();

    if (isExpired) {
      if (
        !tokenRow.refreshTokenIv ||
        !tokenRow.refreshTokenCiphertext ||
        !tokenRow.refreshTokenTag
      ) {
        throw new ConnectorError(
          "CONNECTOR_TOKEN_EXPIRED_NO_REFRESH",
          "Token expired and no refresh_token available — user must reconnect",
        );
      }

      // B1 advisory lock — pattern from governed-workflows.ts:687
      const refreshed = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${"mnm:oauth_refresh:" + tokenRow.id}))`,
        );

        // Re-read inside lock — another concurrent caller may have refreshed
        const [fresh] = await tx
          .select()
          .from(connectorTokens)
          .where(eq(connectorTokens.id, tokenRow.id));
        if (!fresh) return null;
        if (fresh.expiresAt !== null && fresh.expiresAt.getTime() > Date.now()) {
          return fresh;
        }

        const refreshResult = await refreshOAuthTokenInner(connector, fresh);
        if (!refreshResult) {
          // refresh failed — provider returned 401 (token revoked)
          await tx
            .update(connectorTokens)
            .set({ lastRefreshFailedAt: new Date(), updatedAt: new Date() })
            .where(eq(connectorTokens.id, fresh.id));
          return null;
        }

        const accessEnc = encryptSecret(refreshResult.accessToken);
        const refreshEnc = refreshResult.refreshToken ? encryptSecret(refreshResult.refreshToken) : null;

        const [updated] = await tx
          .update(connectorTokens)
          .set({
            accessTokenIv: accessEnc.iv,
            accessTokenCiphertext: accessEnc.ciphertext,
            accessTokenTag: accessEnc.tag,
            ...(refreshEnc
              ? {
                  refreshTokenIv: refreshEnc.iv,
                  refreshTokenCiphertext: refreshEnc.ciphertext,
                  refreshTokenTag: refreshEnc.tag,
                }
              : {}),
            expiresAt: refreshResult.expiresAt,
            lastRefreshAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(connectorTokens.id, fresh.id))
          .returning();
        return updated;
      });

      if (!refreshed) {
        // fire-and-forget audit, then throw
        void recordAudit({
          companyId,
          connectorId: connector.id,
          actorUserId: userId,
          action: "user_token_revoked",
        });
        throw new ConnectorError(
          "CONNECTOR_TOKEN_REVOKED",
          "Token revoked — user must reconnect",
        );
      }

      maybeAuditTokenUsed(companyId, connector.id, userId);
      const decrypted = decryptSecret({
        iv: refreshed.accessTokenIv,
        ciphertext: refreshed.accessTokenCiphertext,
        tag: refreshed.accessTokenTag,
      });
      return {
        accessToken: decrypted,
        expiresAt: refreshed.expiresAt,
        scopes: refreshed.scopesGranted,
        type: "oauth2",
      };
    }

    // Token still valid
    maybeAuditTokenUsed(companyId, connector.id, userId);
    void db
      .update(connectorTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(connectorTokens.id, tokenRow.id))
      .catch((err) => logger.warn({ err }, "[connectors] failed to update last_used_at on connector_tokens"));
    const decrypted = decryptSecret({
      iv: tokenRow.accessTokenIv,
      ciphertext: tokenRow.accessTokenCiphertext,
      tag: tokenRow.accessTokenTag,
    });
    return {
      accessToken: decrypted,
      expiresAt: tokenRow.expiresAt,
      scopes: tokenRow.scopesGranted,
      type: "oauth2",
    };
  }

  return {
    // CRUD
    listConnectors,
    getConnectorById,
    getActiveConnectorBySlug,
    createConnector,
    updateConnector,
    deleteConnector,
    // user tokens
    getUserToken,
    upsertConnectorToken,
    disconnectUser,
    // api keys
    setUserApiKey,
    deleteUserApiKey,
    getUserApiKey,
    // helpers exposed for routes / OAuth callback
    assertUserInCompany,
    recordAudit,
  };
}

export type ConnectorService = ReturnType<typeof connectorService>;
