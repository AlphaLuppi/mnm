import express, { Router, type Request, type Response } from "express";
import { createHmac, createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Db } from "@mnm/db";
import { companyMemberships } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import { OAuthStore } from "./oauth-store.js";
import { accessService } from "../../services/access.js";
import type { BetterAuthSessionResult } from "../../auth/better-auth.js";
import { getMcpJwtSecret, MCP_TOKEN_AUDIENCE } from "./mcp-auth-config.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
import { auditService } from "../../services/audit.js";

// ── Rate limiters for OAuth endpoints ──────────────────────────────────────

const oauthRegisterLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });
const oauthTokenLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });
const oauthAuthorizeGetLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });
const oauthAuthorizePostLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
const oauthConsentDataLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });

// ── Types ───────────────────────────────────────────────────────────────────

export interface McpOAuthRouterDeps {
  db: Db;
  resolveSession: (req: Request) => Promise<BetterAuthSessionResult | null>;
  getPublicUrl: () => string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signAccessToken(claims: Record<string, unknown>): string {
  const secret = getMcpJwtSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

// ── PKCE verification ───────────────────────────────────────────────────────

function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Resolve user's companyId ────────────────────────────────────────────────

async function getUserCompanyId(db: Db, userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ companyId: companyMemberships.companyId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
        eq(companyMemberships.status, "active"),
      ),
    )
    .limit(1);
  return membership?.companyId ?? null;
}

// ── CSRF token store ───────────────────────────────────────────────────────

const CSRF_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CsrfEntry {
  expiresAt: number;
  userId: string;
  clientId: string;
}
const csrfTokens = new Map<string, CsrfEntry>();

function createCsrfToken(userId: string, clientId: string): string {
  const token = randomUUID();
  csrfTokens.set(token, { expiresAt: Date.now() + CSRF_TTL_MS, userId, clientId });
  return token;
}

function consumeCsrfToken(token: string, userId: string, clientId: string): boolean {
  const entry = csrfTokens.get(token);
  if (!entry) return false;
  csrfTokens.delete(token);
  if (Date.now() > entry.expiresAt) return false;
  if (entry.userId !== userId || entry.clientId !== clientId) return false;
  return true;
}

// ── Router ──────────────────────────────────────────────────────────────────

let cleanupStarted = false;

export function createMcpOAuthRouter(deps: McpOAuthRouterDeps): Router {
  const router = Router();
  const { db, resolveSession, getPublicUrl } = deps;
  const store = new OAuthStore(db);

  // ── Anti-clickjacking headers for all OAuth routes ─────────────────
  router.use((req, res, next) => {
    res.set("X-Frame-Options", "DENY");
    res.set("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });

  // Periodic cleanup every 15 minutes (started once)
  if (!cleanupStarted) {
    cleanupStarted = true;
    setInterval(() => {
      void store.cleanup();
      const now = Date.now();
      for (const [token, entry] of csrfTokens) {
        if (now > entry.expiresAt) csrfTokens.delete(token);
      }
    }, 15 * 60 * 1000).unref();
  }

  // ── 1. Protected Resource Metadata (RFC 9728) ────────────────────────

  router.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
    const host = getPublicUrl();
    res.json({
      resource: `${host}/mcp`,
      authorization_servers: [`${host}/`],
      scopes_supported: ["mcp:read", "mcp:write", "mcp:admin"],
    });
  });

  // ── 2. Authorization Server Metadata (RFC 8414) ──────────────────────

  router.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
    const host = getPublicUrl();
    res.json({
      issuer: `${host}/`,
      authorization_endpoint: `${host}/oauth/authorize`,
      token_endpoint: `${host}/oauth/token`,
      registration_endpoint: `${host}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  // ── 3. Dynamic Client Registration (RFC 7591) ───────────────────────

  router.post("/oauth/register", oauthRegisterLimiter, async (req: Request, res: Response) => {
    const { client_name, redirect_uris, grant_types } = req.body ?? {};

    if (!client_name || typeof client_name !== "string") {
      res.status(400).json({ error: "invalid_client_metadata", error_description: "client_name is required" });
      return;
    }

    const uris: string[] = Array.isArray(redirect_uris) ? redirect_uris : [];
    if (uris.length === 0) {
      res.status(400).json({ error: "invalid_client_metadata", error_description: "redirect_uris is required" });
      return;
    }

    for (const uri of uris) {
      try {
        const parsed = new URL(uri);
        if (parsed.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
          res.status(400).json({ error: "invalid_client_metadata", error_description: "http: redirect_uris allowed only for localhost" });
          return;
        }
        if (!["https:", "http:"].includes(parsed.protocol)) {
          res.status(400).json({ error: "invalid_client_metadata", error_description: "redirect_uris must use https: or http: scheme" });
          return;
        }
      } catch {
        res.status(400).json({ error: "invalid_client_metadata", error_description: "Invalid redirect_uri format" });
        return;
      }
    }

    const grants: string[] = Array.isArray(grant_types)
      ? grant_types
      : ["authorization_code", "refresh_token"];

    const client = await store.registerClient(client_name, uris, grants);

    auditService(db).emit({
      companyId: "system",
      actorId: "anonymous",
      actorType: "system",
      action: "oauth.client.registered",
      targetType: "oauth_client",
      targetId: client.clientId,
      metadata: { clientName: client.clientName, redirectUris: client.redirectUris },
      severity: "info",
    }).catch(() => {});

    res.status(201).json({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
    });
  });

  // ── 4. Authorization Endpoint ────────────────────────────────────────

  // ── Consent data API (for React SPA consent page) ────────────────────
  router.get("/oauth/consent-data", oauthConsentDataLimiter, async (req: Request, res: Response) => {
    const client_id = req.query.client_id as string | undefined;
    if (!client_id) {
      res.status(400).json({ error: "invalid_request", error_description: "client_id is required" });
      return;
    }

    // Require authenticated session
    const sessionResult = await resolveSession(req);
    if (!sessionResult?.user?.id) {
      res.status(401).json({ error: "login_required" });
      return;
    }

    const client = await store.getClient(client_id);
    if (!client) {
      res.status(400).json({ error: "invalid_client", error_description: "Unknown client_id" });
      return;
    }

    const userId = sessionResult.user.id;
    const userCompanyId = await getUserCompanyId(db, userId);

    let userPermissions: string[] = [];
    if (userCompanyId) {
      const access = accessService(db);
      const role = await access.resolveRole(userCompanyId, "user", userId);
      if (role?.permissionSlugs) {
        userPermissions = [...role.permissionSlugs];
      }
    }

    const csrfToken = createCsrfToken(userId, client_id);

    res.json({
      clientName: client.clientName,
      userPermissions,
      csrfToken,
    });
  });

  router.get("/oauth/authorize", oauthAuthorizeGetLimiter, async (req: Request, res: Response) => {
    const {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      state,
      scope,
      resource,
    } = req.query as Record<string, string | undefined>;

    // Validate required params
    if (!client_id || !redirect_uri || !code_challenge) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing required parameters" });
      return;
    }

    if (code_challenge_method && code_challenge_method !== "S256") {
      res.status(400).json({ error: "invalid_request", error_description: "Only S256 code_challenge_method is supported" });
      return;
    }

    const client = await store.getClient(client_id);
    if (!client) {
      res.status(400).json({ error: "invalid_client", error_description: "Unknown client_id" });
      return;
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      res.status(400).json({ error: "invalid_request", error_description: "redirect_uri not registered" });
      return;
    }

    // Check if user is logged in
    const sessionResult = await resolveSession(req);
    if (!sessionResult?.user?.id) {
      // Not logged in: redirect to auth page with return URL
      const returnUrl = req.originalUrl;
      res.redirect(`/auth?next=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // Redirect to React SPA consent page
    const consentParams = new URLSearchParams({
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method: code_challenge_method ?? "S256",
      ...(state && { state }),
      ...(scope && { scope }),
      ...(resource && { resource }),
    });
    res.redirect(`/oauth-consent?${consentParams.toString()}`);
  });

  // Consent form submission (HTML form sends application/x-www-form-urlencoded)
  router.post("/oauth/authorize", express.urlencoded({ extended: false }), oauthAuthorizePostLimiter, async (req: Request, res: Response) => {
    const {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      state,
      consent,
      scopes: rawScopes,
      permissions: rawPermissions,
      resource,
      csrf_token,
    } = req.body ?? {};

    // Verify session first
    const sessionResult = await resolveSession(req);
    if (!sessionResult?.user?.id) {
      res.status(401).json({ error: "login_required" });
      return;
    }

    const userId = sessionResult.user.id;

    // Validate client and redirect_uri BEFORE checking consent (prevents open redirect on deny)
    const client = await store.getClient(client_id);
    if (!client) {
      res.status(400).json({ error: "invalid_client" });
      return;
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      res.status(400).json({ error: "invalid_request", error_description: "redirect_uri not registered" });
      return;
    }

    // Validate CSRF token (bound to session + client)
    if (!csrf_token || !consumeCsrfToken(csrf_token, userId, client_id)) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: userId,
        actorType: "system",
        action: "oauth.csrf.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(403).json({ error: "invalid_request", error_description: "Invalid or expired CSRF token" });
      return;
    }

    if (consent !== "approve") {
      auditService(db).emit({
        companyId: "unknown",
        actorId: userId,
        actorType: "user",
        action: "oauth.consent.denied",
        targetType: "oauth_client",
        targetId: client_id,
        severity: "info",
      }).catch(() => {});
      const redirectTarget = `${redirect_uri}?error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`;
      res.redirect(redirectTarget);
      return;
    }

    const companyId = await getUserCompanyId(db, userId);
    if (!companyId) {
      res.status(403).json({ error: "access_denied", error_description: "User has no active company membership" });
      return;
    }

    // Normalize scopes — may come as comma-separated string (from React SPA) or checkbox array
    let approvedScopes: string[];
    if (typeof rawScopes === "string" && rawScopes.includes(",")) {
      approvedScopes = rawScopes.split(",").filter(Boolean);
    } else if (Array.isArray(rawScopes)) {
      approvedScopes = rawScopes;
    } else if (rawScopes) {
      approvedScopes = [rawScopes];
    } else {
      approvedScopes = ["mcp:read"];
    }

    // Normalize individual permissions from React SPA consent form
    let approvedPermissions: string[] = Array.isArray(rawPermissions)
      ? rawPermissions
      : rawPermissions
        ? [rawPermissions]
        : [];

    // Validate submitted permissions against user's actual role permissions
    if (approvedPermissions.length > 0) {
      const access = accessService(db);
      const role = await access.resolveRole(companyId, "user", userId);
      const userPerms = role?.permissionSlugs ?? new Set<string>();
      approvedPermissions = approvedPermissions.filter(p => userPerms.has(p));
    }

    const code = store.createCode({
      clientId: client_id,
      userId,
      companyId,
      scopes: approvedScopes,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method ?? "S256",
      redirectUri: redirect_uri,
      resource,
      ...(approvedPermissions.length > 0 && { permissions: approvedPermissions }),
    });

    auditService(db).emit({
      companyId,
      actorId: userId,
      actorType: "user",
      action: "oauth.consent.approved",
      targetType: "oauth_client",
      targetId: client_id,
      metadata: { scopes: approvedScopes, permissions: approvedPermissions },
      severity: "info",
    }).catch(() => {});

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    res.redirect(redirectUrl.toString());
  });

  // ── 5. Token Endpoint ────────────────────────────────────────────────

  router.post("/oauth/token", oauthTokenLimiter, async (req: Request, res: Response) => {
    const { grant_type } = req.body ?? {};

    if (grant_type === "authorization_code") {
      await handleAuthorizationCodeGrant(req, res);
    } else if (grant_type === "refresh_token") {
      await handleRefreshTokenGrant(req, res);
    } else {
      res.status(400).json({ error: "unsupported_grant_type" });
    }
  });

  async function handleAuthorizationCodeGrant(req: Request, res: Response) {
    const { code, code_verifier, client_id, redirect_uri } = req.body ?? {};

    if (!code || !code_verifier || !client_id) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing required parameters" });
      return;
    }

    const authCode = store.consumeCode(code);
    if (!authCode) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: "unknown",
        actorType: "system",
        action: "oauth.token.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { reason: "invalid_grant", ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" });
      return;
    }

    // Verify client
    if (authCode.clientId !== client_id) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: "unknown",
        actorType: "system",
        action: "oauth.token.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { reason: "client_id_mismatch", ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(400).json({ error: "invalid_grant", error_description: "client_id mismatch" });
      return;
    }

    // Verify client_secret if the client has one
    const client = await store.getClient(client_id);
    if (client?.clientSecret) {
      const client_secret = req.body?.client_secret;
      if (!client_secret) {
        auditService(db).emit({
          companyId: "unknown",
          actorId: "unknown",
          actorType: "system",
          action: "oauth.token.failed",
          targetType: "oauth_client",
          targetId: client_id ?? "unknown",
          metadata: { reason: "client_secret_missing", ip: req.ip },
          severity: "warning",
        }).catch(() => {});
        res.status(401).json({ error: "invalid_client", error_description: "client_secret required" });
        return;
      }
      const expected = Buffer.from(client.clientSecret);
      const actual = Buffer.from(String(client_secret));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        auditService(db).emit({
          companyId: "unknown",
          actorId: "unknown",
          actorType: "system",
          action: "oauth.token.failed",
          targetType: "oauth_client",
          targetId: client_id ?? "unknown",
          metadata: { reason: "client_secret_mismatch", ip: req.ip },
          severity: "warning",
        }).catch(() => {});
        res.status(401).json({ error: "invalid_client", error_description: "Invalid client_secret" });
        return;
      }
    }

    // Verify redirect_uri
    if (redirect_uri && authCode.redirectUri !== redirect_uri) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: "unknown",
        actorType: "system",
        action: "oauth.token.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { reason: "redirect_uri_mismatch", ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
      return;
    }

    // Verify PKCE
    if (!verifyPkceS256(code_verifier, authCode.codeChallenge)) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: "unknown",
        actorType: "system",
        action: "oauth.token.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { reason: "pkce_failed", ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      return;
    }

    // Issue tokens
    const now = Math.floor(Date.now() / 1000);
    const accessTokenClaims = {
      sub: authCode.userId,
      company_id: authCode.companyId,
      scope: authCode.scopes.join(" "),
      iss: "mnm-oauth",
      aud: MCP_TOKEN_AUDIENCE,
      iat: now,
      exp: now + 30 * 60, // 30 minutes
      jti: randomUUID(),
      ...(authCode.resource ? { resource: authCode.resource } : {}),
      // Individual permissions from consent (validated server-side)
      ...(authCode.permissions && authCode.permissions.length > 0 && {
        permissions: authCode.permissions,
      }),
    };

    const accessToken = signAccessToken(accessTokenClaims);
    const refreshToken = await store.createRefreshToken({
      clientId: authCode.clientId,
      userId: authCode.userId,
      companyId: authCode.companyId,
      scopes: authCode.scopes,
      permissions: authCode.permissions,
      resource: authCode.resource,
    });

    auditService(db).emit({
      companyId: authCode.companyId,
      actorId: authCode.userId,
      actorType: "user",
      action: "oauth.token.issued",
      targetType: "oauth_client",
      targetId: authCode.clientId,
      metadata: { scopes: authCode.scopes, permissions: authCode.permissions, grantType: "authorization_code" },
      severity: "info",
    }).catch(() => {});

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 30 * 60,
      refresh_token: refreshToken,
      scope: authCode.scopes.join(" "),
    });
  }

  async function handleRefreshTokenGrant(req: Request, res: Response) {
    const { refresh_token, client_id } = req.body ?? {};

    if (!refresh_token || !client_id) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing required parameters" });
      return;
    }

    const tokenEntry = await store.consumeRefreshToken(refresh_token);
    if (!tokenEntry) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: "unknown",
        actorType: "system",
        action: "oauth.token.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { reason: "invalid_refresh_token", ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired refresh token" });
      return;
    }

    if (tokenEntry.clientId !== client_id) {
      auditService(db).emit({
        companyId: "unknown",
        actorId: "unknown",
        actorType: "system",
        action: "oauth.token.failed",
        targetType: "oauth_client",
        targetId: client_id ?? "unknown",
        metadata: { reason: "client_id_mismatch_refresh", ip: req.ip },
        severity: "warning",
      }).catch(() => {});
      res.status(400).json({ error: "invalid_grant", error_description: "client_id mismatch" });
      return;
    }

    // Verify client_secret if the client has one
    const client = await store.getClient(client_id);
    if (client?.clientSecret) {
      const client_secret = req.body?.client_secret;
      if (!client_secret) {
        auditService(db).emit({
          companyId: "unknown",
          actorId: "unknown",
          actorType: "system",
          action: "oauth.token.failed",
          targetType: "oauth_client",
          targetId: client_id ?? "unknown",
          metadata: { reason: "client_secret_missing_refresh", ip: req.ip },
          severity: "warning",
        }).catch(() => {});
        res.status(401).json({ error: "invalid_client", error_description: "client_secret required" });
        return;
      }
      const expected = Buffer.from(client.clientSecret);
      const actual = Buffer.from(String(client_secret));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        auditService(db).emit({
          companyId: "unknown",
          actorId: "unknown",
          actorType: "system",
          action: "oauth.token.failed",
          targetType: "oauth_client",
          targetId: client_id ?? "unknown",
          metadata: { reason: "client_secret_mismatch_refresh", ip: req.ip },
          severity: "warning",
        }).catch(() => {});
        res.status(401).json({ error: "invalid_client", error_description: "Invalid client_secret" });
        return;
      }
    }

    // Issue new tokens (rotation)
    const now = Math.floor(Date.now() / 1000);
    const accessTokenClaims = {
      sub: tokenEntry.userId,
      company_id: tokenEntry.companyId,
      scope: tokenEntry.scopes.join(" "),
      iss: "mnm-oauth",
      aud: MCP_TOKEN_AUDIENCE,
      iat: now,
      exp: now + 30 * 60,
      jti: randomUUID(),
      ...(tokenEntry.resource ? { resource: tokenEntry.resource } : {}),
      // Propagate individual permissions through refresh
      ...(tokenEntry.permissions && tokenEntry.permissions.length > 0 && {
        permissions: tokenEntry.permissions,
      }),
    };

    const accessToken = signAccessToken(accessTokenClaims);
    const newRefreshToken = await store.createRefreshToken({
      clientId: tokenEntry.clientId,
      userId: tokenEntry.userId,
      companyId: tokenEntry.companyId,
      scopes: tokenEntry.scopes,
      permissions: tokenEntry.permissions,
      resource: tokenEntry.resource,
    });

    auditService(db).emit({
      companyId: tokenEntry.companyId,
      actorId: tokenEntry.userId,
      actorType: "user",
      action: "oauth.token.refreshed",
      targetType: "oauth_client",
      targetId: tokenEntry.clientId,
      metadata: { scopes: tokenEntry.scopes, permissions: tokenEntry.permissions },
      severity: "info",
    }).catch(() => {});

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 30 * 60,
      refresh_token: newRefreshToken,
      scope: tokenEntry.scopes.join(" "),
    });
  }

  return router;
}
