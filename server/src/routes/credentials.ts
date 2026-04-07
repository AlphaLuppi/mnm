import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { credentialService } from "../services/credential.js";
import { oauthService } from "../services/oauth.js";
import { configLayerRuntimeService } from "../services/config-layer-runtime.js";
import { badRequest } from "../errors.js";
import { logger } from "../middleware/logger.js";

export function credentialRoutes(db: Db) {
  const router = Router();
  const credSvc = credentialService(db);
  const oauthSvc = oauthService(db);
  const clRuntime = configLayerRuntimeService(db);

  // ── GET /companies/:companyId/credentials ──────────────────────────────────
  // List the current user's credentials for this company.
  router.get(
    "/companies/:companyId/credentials",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);

      const userId = req.actor.userId!;
      const credentials = await credSvc.listUserCredentials(userId, companyId);
      res.json(credentials);
    },
  );

  // ── GET /oauth/authorize/:itemId ──────────────────────────────────────────
  // Initiate the OAuth2 PKCE flow — redirect to the provider.
  // Query param: companyId (required)
  router.get("/oauth/authorize/:itemId", requirePermission(db, "mcp:connect"), async (req, res) => {
    assertBoard(req);

    const itemId = req.params.itemId as string;
    const companyId = (req.query.companyId as string | undefined) ?? req.actor.companyId ?? "";

    if (!companyId) {
      throw badRequest("companyId is required");
    }

    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId!;

    // Build the callback URL pointing back to our server
    const callbackUrl = `${buildPublicBaseUrl(req)}/api/oauth/callback`;

    const authorizeUrl = await oauthSvc.initiateAuthorize(
      userId,
      companyId,
      itemId,
      callbackUrl,
    );

    res.redirect(302, authorizeUrl);
  });

  // ── GET /oauth/callback ───────────────────────────────────────────────────
  // OAuth2 callback — exchange code for tokens, store credential, close popup.
  // This page is loaded in a popup window opened by the UI.
  router.get("/oauth/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;
    const errorDescription = (req.query.error_description as string | undefined)?.slice(0, 500);

    // Determine the callback URL (same as used in authorize)
    const callbackUrl = `${buildPublicBaseUrl(req)}/api/oauth/callback`;

    if (error) {
      const html = buildPopupHtml({
        success: false,
        error: errorDescription ?? error,
      });
      res.status(400).set("Content-Type", "text/html").send(html);
      return;
    }

    if (!code || !state) {
      const html = buildPopupHtml({
        success: false,
        error: "Missing code or state in OAuth callback",
      });
      res.status(400).set("Content-Type", "text/html").send(html);
      return;
    }

    try {
      const result = await oauthSvc.handleCallback(state, code, callbackUrl);
      const html = buildPopupHtml({
        success: true,
        itemId: result.itemId,
        userId: result.userId,
      });
      res.set("Content-Type", "text/html").send(html);
    } catch (err) {
      const html = buildPopupHtml({
        success: false,
        error: (err as Error).message,
      });
      res.status(400).set("Content-Type", "text/html").send(html);
    }
  });

  // ── POST /companies/:companyId/credentials/:itemId/secret ─────────────────
  // Store an API key credential (non-OAuth) for an item.
  // Body: { material: { env: { KEY: "value" } } }
  router.post(
    "/companies/:companyId/credentials/:itemId/secret",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
    const itemId = req.params.itemId as string;
    const userId = req.actor.userId!;
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { material } = req.body as { material?: Record<string, unknown> };
    if (!material || typeof material !== "object" || Object.keys(material).length === 0) {
      throw badRequest("material is required and must be a non-empty object");
    }

    await credSvc.storeCredential(userId, companyId, itemId, "api_key", material);
    clRuntime.invalidateCompanyCache(companyId);

    res.status(201).json({ ok: true });
  });

  // ── DELETE /companies/:companyId/credentials/:id ───────────────────────────
  // Revoke a credential (clear material, set status=revoked).
  router.delete(
    "/companies/:companyId/credentials/:id",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
    const credentialId = req.params.id as string;
    const userId = req.actor.userId!;
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const revoked = await credSvc.revoke(credentialId, userId, companyId);
    if (!revoked) {
      res.status(404).json({ error: "Credential not found" });
      return;
    }

    clRuntime.invalidateCompanyCache(companyId);
    res.status(204).send();
  });

  // ── POST /companies/:companyId/credentials/:itemId/pat ─────────────────────
  // Store a PAT credential for a git provider item.
  // Body: { material: { token: "ghp_xxx" } }
  router.post(
    "/companies/:companyId/credentials/:itemId/pat",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
      const itemId = req.params.itemId as string;
      const userId = req.actor.userId!;
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { material } = req.body as { material?: Record<string, unknown> };
      if (!material?.token || typeof material.token !== "string") {
        throw badRequest("material.token is required");
      }

      await credSvc.storeCredential(userId, companyId, itemId, "pat", material);
      clRuntime.invalidateCompanyCache(companyId);
      res.status(201).json({ ok: true });
    },
  );

  // ── Backward-compat aliases (supprimer en V2) ─────────────────────────────
  // Inline handlers instead of 307 redirects to avoid body/header loss on some clients.
  router.get(
    "/companies/:companyId/mcp-credentials",
    requirePermission(db, "mcp:connect"),
    (req, res) => res.redirect(301, `/api/companies/${req.params.companyId}/credentials`),
  );
  router.post(
    "/companies/:companyId/mcp-credentials/:itemId/api-key",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
      const itemId = req.params.itemId as string;
      const userId = req.actor.userId!;
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { material } = req.body as { material?: Record<string, unknown> };
      if (!material || typeof material !== "object" || Object.keys(material).length === 0) {
        throw badRequest("material is required and must be a non-empty object");
      }

      await credSvc.storeCredential(userId, companyId, itemId, "api_key", material);
      clRuntime.invalidateCompanyCache(companyId);
      res.status(201).json({ ok: true });
    },
  );
  router.delete(
    "/companies/:companyId/mcp-credentials/:id",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
      const credentialId = req.params.id as string;
      const userId = req.actor.userId!;
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const revoked = await credSvc.revoke(credentialId, userId, companyId);
      if (!revoked) {
        res.status(404).json({ error: "Credential not found" });
        return;
      }

      clRuntime.invalidateCompanyCache(companyId);
      res.status(204).send();
    },
  );

  return router;
}

// ─── Helper: popup closer HTML ────────────────────────────────────────────────

interface PopupResult {
  success: boolean;
  error?: string;
  itemId?: string;
  userId?: string;
}

function buildPopupHtml(result: PopupResult): string {
  // Use JSON.stringify for safe embedding — escape </script> to prevent premature tag close
  const safePayload = JSON.stringify(result).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OAuth Connection</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,.12); text-align: center; max-width: 360px; }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
    p { color: #6b7280; font-size: .9rem; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${result.success ? "&#x2705;" : "&#x274C;"}</div>
    <h2>${result.success ? "Connected!" : "Connection failed"}</h2>
    <p>${result.success ? "You can close this window." : escapeHtml(result.error ?? "Unknown error")}</p>
  </div>
  <script>
    try {
      const payload = ${safePayload};
      window.opener?.postMessage({ type: 'mcp-oauth-result', ...payload }, window.location.origin);
    } catch (e) { /* ignore */ }
    setTimeout(() => { try { window.close(); } catch(e){} }, 2000);
  </script>
</body>
</html>`;
}

/**
 * Resolve the public base URL for OAuth callbacks.
 * Prefers MNM_PUBLIC_URL (explicit config), falls back to req.protocol + req.headers.host.
 * Does NOT use x-forwarded-host to avoid host injection attacks (SEC-04).
 */
function buildPublicBaseUrl(req: import("express").Request): string {
  if (process.env.MNM_PUBLIC_URL) {
    return process.env.MNM_PUBLIC_URL.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    logger.warn("[credentials] MNM_PUBLIC_URL not set in production — OAuth callback URL derived from Host header");
  }
  const proto = req.protocol ?? "http";
  const host = req.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
