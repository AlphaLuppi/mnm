import { Router, type Request, type Response } from "express";
import { createHmac, createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Db } from "@mnm/db";
import { companyMemberships } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import { OAuthStore } from "./oauth-store.js";
import { renderConsentPage } from "./mcp-consent.js";
import type { BetterAuthSessionResult } from "../../auth/better-auth.js";
import { getMcpJwtSecret } from "./mcp-auth-config.js";

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

// ── Store (singleton per process) ───────────────────────────────────────────

const store = new OAuthStore();

// ── CSRF token store ───────────────────────────────────────────────────────

const CSRF_TTL_MS = 10 * 60 * 1000; // 10 minutes
const csrfTokens = new Map<string, number>(); // token → expiresAt

function createCsrfToken(): string {
  const token = randomUUID();
  csrfTokens.set(token, Date.now() + CSRF_TTL_MS);
  return token;
}

function consumeCsrfToken(token: string): boolean {
  const expiresAt = csrfTokens.get(token);
  if (expiresAt == null) return false;
  csrfTokens.delete(token);
  return Date.now() <= expiresAt;
}

// ── Router ──────────────────────────────────────────────────────────────────

let cleanupStarted = false;

export function createMcpOAuthRouter(deps: McpOAuthRouterDeps): Router {
  const router = Router();
  const { db, resolveSession, getPublicUrl } = deps;

  // Periodic cleanup every 15 minutes (started once)
  if (!cleanupStarted) {
    cleanupStarted = true;
    setInterval(() => {
      store.cleanup();
      const now = Date.now();
      for (const [token, expiresAt] of csrfTokens) {
        if (now > expiresAt) csrfTokens.delete(token);
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

  router.post("/oauth/register", (req: Request, res: Response) => {
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

    const client = store.registerClient(client_name, uris, grants);

    res.status(201).json({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
    });
  });

  // ── 4. Authorization Endpoint ────────────────────────────────────────

  router.get("/oauth/authorize", async (req: Request, res: Response) => {
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

    const client = store.getClient(client_id);
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
      // Not logged in: redirect to login page with return URL
      const returnUrl = req.originalUrl;
      res.redirect(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // User is logged in — render consent screen
    const requestedScopes = scope ? scope.split(" ").filter(Boolean) : ["mcp:read", "mcp:write"];
    const csrfToken = createCsrfToken();

    const html = renderConsentPage({
      clientName: client.clientName,
      requestedScopes,
      clientId: client_id,
      redirectUri: redirect_uri,
      state,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method ?? "S256",
      resource,
      csrfToken,
    });

    res.type("html").send(html);
  });

  // Consent form submission
  router.post("/oauth/authorize", async (req: Request, res: Response) => {
    const {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      state,
      consent,
      scopes: rawScopes,
      resource,
      csrf_token,
    } = req.body ?? {};

    // Validate CSRF token
    if (!csrf_token || !consumeCsrfToken(csrf_token)) {
      res.status(403).json({ error: "invalid_request", error_description: "Invalid or expired CSRF token" });
      return;
    }

    if (consent !== "approve") {
      const redirectTarget = redirect_uri
        ? `${redirect_uri}?error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`
        : "/";
      res.redirect(redirectTarget);
      return;
    }

    // Verify session
    const sessionResult = await resolveSession(req);
    if (!sessionResult?.user?.id) {
      res.status(401).json({ error: "login_required" });
      return;
    }

    const userId = sessionResult.user.id;
    const companyId = await getUserCompanyId(db, userId);
    if (!companyId) {
      res.status(403).json({ error: "access_denied", error_description: "User has no active company membership" });
      return;
    }

    const client = store.getClient(client_id);
    if (!client) {
      res.status(400).json({ error: "invalid_client" });
      return;
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      res.status(400).json({ error: "invalid_request", error_description: "redirect_uri not registered" });
      return;
    }

    // Normalize scopes from form checkboxes
    const approvedScopes: string[] = Array.isArray(rawScopes)
      ? rawScopes
      : rawScopes
        ? [rawScopes]
        : ["mcp:read"];

    const code = store.createCode({
      clientId: client_id,
      userId,
      companyId,
      scopes: approvedScopes,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method ?? "S256",
      redirectUri: redirect_uri,
      resource,
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    res.redirect(redirectUrl.toString());
  });

  // ── 5. Token Endpoint ────────────────────────────────────────────────

  router.post("/oauth/token", async (req: Request, res: Response) => {
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
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" });
      return;
    }

    // Verify client
    if (authCode.clientId !== client_id) {
      res.status(400).json({ error: "invalid_grant", error_description: "client_id mismatch" });
      return;
    }

    // Verify redirect_uri
    if (redirect_uri && authCode.redirectUri !== redirect_uri) {
      res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
      return;
    }

    // Verify PKCE
    if (!verifyPkceS256(code_verifier, authCode.codeChallenge)) {
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
      aud: "mnm-mcp",
      iat: now,
      exp: now + 30 * 60, // 30 minutes
      jti: randomUUID(),
      ...(authCode.resource ? { resource: authCode.resource } : {}),
    };

    const accessToken = signAccessToken(accessTokenClaims);
    const refreshToken = store.createRefreshToken({
      clientId: authCode.clientId,
      userId: authCode.userId,
      companyId: authCode.companyId,
      scopes: authCode.scopes,
      resource: authCode.resource,
    });

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

    const tokenEntry = store.consumeRefreshToken(refresh_token);
    if (!tokenEntry) {
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired refresh token" });
      return;
    }

    if (tokenEntry.clientId !== client_id) {
      res.status(400).json({ error: "invalid_grant", error_description: "client_id mismatch" });
      return;
    }

    // Issue new tokens (rotation)
    const now = Math.floor(Date.now() / 1000);
    const accessTokenClaims = {
      sub: tokenEntry.userId,
      company_id: tokenEntry.companyId,
      scope: tokenEntry.scopes.join(" "),
      iss: "mnm-oauth",
      aud: "mnm-mcp",
      iat: now,
      exp: now + 30 * 60,
      jti: randomUUID(),
      ...(tokenEntry.resource ? { resource: tokenEntry.resource } : {}),
    };

    const accessToken = signAccessToken(accessTokenClaims);
    const newRefreshToken = store.createRefreshToken({
      clientId: tokenEntry.clientId,
      userId: tokenEntry.userId,
      companyId: tokenEntry.companyId,
      scopes: tokenEntry.scopes,
      resource: tokenEntry.resource,
    });

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
