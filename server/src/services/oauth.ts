import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@mnm/db";
import { configLayerItems } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { credentialService } from "./credential.js";
import { badRequest } from "../errors.js";

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return randomBytes(16).toString("base64url");
}

// ─── In-memory state store ────────────────────────────────────────────────────

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PkceState {
  userId: string;
  companyId: string;
  itemId: string;
  callbackUrl: string;
  codeVerifier: string;
  createdAt: number;
}

const pendingStates = new Map<string, PkceState>();

// Periodic cleanup of expired states (run every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, state] of pendingStates.entries()) {
    if (now - state.createdAt > STATE_TTL_MS) {
      pendingStates.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
// Prevent the interval from keeping the process alive on shutdown
if (typeof cleanupTimer === "object" && cleanupTimer !== null && "unref" in cleanupTimer) {
  (cleanupTimer as { unref(): void }).unref();
}

// ─── OAuth config shape (stored in config_layer_items.config_json.oauth) ─────

interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export function oauthService(db: Db) {
  const credSvc = credentialService(db);

  /**
   * Initiate the OAuth2 PKCE flow for an MCP server item.
   * Returns the authorization URL to redirect the user to.
   */
  async function initiateAuthorize(
    userId: string,
    companyId: string,
    itemId: string,
    callbackUrl: string,
  ): Promise<string> {
    // Load the MCP item from DB to get its oauth config
    const item = await db
      .select({
        id: configLayerItems.id,
        itemType: configLayerItems.itemType,
        configJson: configLayerItems.configJson,
        companyId: configLayerItems.companyId,
      })
      .from(configLayerItems)
      .where(
        and(
          eq(configLayerItems.id, itemId),
          eq(configLayerItems.companyId, companyId),
          eq(configLayerItems.itemType, "mcp"),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!item) {
      throw badRequest(`MCP item not found: ${itemId}`);
    }

    const cfg = item.configJson as Record<string, unknown>;
    const oauth = cfg.oauth as OAuthConfig | undefined;

    if (!oauth?.authorizationUrl || !oauth?.clientId) {
      throw badRequest(`MCP item ${itemId} does not have OAuth config (authorizationUrl + clientId required)`);
    }

    // Generate PKCE pair
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store state
    pendingStates.set(state, {
      userId,
      companyId,
      itemId,
      callbackUrl,
      codeVerifier,
      createdAt: Date.now(),
    });

    // Build authorization URL
    const url = new URL(oauth.authorizationUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", oauth.clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (oauth.scope) url.searchParams.set("scope", oauth.scope);
    if (oauth.audience) url.searchParams.set("audience", oauth.audience);

    logger.debug({ userId, companyId, itemId }, "[oauth] initiated authorize flow");

    return url.toString();
  }

  /**
   * Handle the OAuth2 callback — verify state, exchange code for tokens,
   * store the credential, and return identifying info for the caller.
   */
  async function handleCallback(
    state: string,
    code: string,
    callbackUrl: string,
  ): Promise<{ userId: string; companyId: string; itemId: string }> {
    const pkce = pendingStates.get(state);
    if (!pkce) {
      throw badRequest("Invalid or expired OAuth state");
    }

    // Check TTL
    if (Date.now() - pkce.createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
      throw badRequest("OAuth state has expired — please try connecting again");
    }

    // Consume the state (one-time use)
    pendingStates.delete(state);

    const { userId, companyId, itemId, codeVerifier } = pkce;

    // Load the MCP item to get the token URL and client credentials
    const item = await db
      .select({ configJson: configLayerItems.configJson })
      .from(configLayerItems)
      .where(
        and(
          eq(configLayerItems.id, itemId),
          eq(configLayerItems.companyId, companyId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!item) {
      throw badRequest(`MCP item not found after OAuth callback: ${itemId}`);
    }

    const cfg = item.configJson as Record<string, unknown>;
    const oauth = cfg.oauth as OAuthConfig | undefined;

    if (!oauth?.tokenUrl || !oauth?.clientId) {
      throw badRequest(`MCP item ${itemId} missing tokenUrl or clientId for token exchange`);
    }

    // Exchange authorization code for tokens
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: oauth.clientId,
      code_verifier: codeVerifier,
    });
    if (oauth.clientSecret) {
      body.set("client_secret", oauth.clientSecret);
    }

    let tokenResponse: Record<string, unknown>;
    try {
      const res = await fetch(oauth.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token exchange failed (${res.status}): ${text}`);
      }

      tokenResponse = (await res.json()) as Record<string, unknown>;
    } catch (err) {
      logger.error({ err, userId, companyId, itemId }, "[oauth] token exchange failed");
      throw badRequest(`OAuth token exchange failed: ${(err as Error).message}`);
    }

    // Calculate expiry from expires_in if provided
    let expiresAt: Date | undefined;
    if (typeof tokenResponse.expires_in === "number") {
      expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    } else if (typeof tokenResponse.expires_in === "string") {
      const secs = parseInt(tokenResponse.expires_in, 10);
      if (!isNaN(secs)) expiresAt = new Date(Date.now() + secs * 1000);
    }

    // Store the credential (encrypted)
    await credSvc.storeCredential(
      userId,
      companyId,
      itemId,
      "oauth2",
      tokenResponse,
      expiresAt,
    );

    logger.info({ userId, companyId, itemId }, "[oauth] OAuth flow completed — credential stored");

    return { userId, companyId, itemId };
  }

  return {
    initiateAuthorize,
    handleCallback,
    // Expose for testing
    _pendingStatesSize: () => pendingStates.size,
  };
}
