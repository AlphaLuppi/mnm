import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { mcpCredentialService } from "../services/mcp-credential.js";
import { mcpOauthService } from "../services/mcp-oauth.js";
import { badRequest } from "../errors.js";

export function mcpOauthRoutes(db: Db) {
  const router = Router();
  const credSvc = mcpCredentialService(db);
  const oauthSvc = mcpOauthService(db);

  // ── GET /companies/:companyId/mcp-credentials ─────────────────────────────
  // List the current user's MCP credentials for this company.
  router.get(
    "/companies/:companyId/mcp-credentials",
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
  router.get("/oauth/authorize/:itemId", async (req, res) => {
    assertBoard(req);

    const itemId = req.params.itemId as string;
    const companyId = (req.query.companyId as string | undefined) ?? req.actor.companyId ?? "";

    if (!companyId) {
      throw badRequest("companyId is required");
    }

    assertCompanyAccess(req, companyId);

    const userId = req.actor.userId!;

    // Build the callback URL pointing back to our server
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.headers.host;
    const callbackUrl = `${proto}://${host}/api/oauth/callback`;

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
    const errorDescription = req.query.error_description as string | undefined;

    // Determine the callback URL (same as used in authorize)
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.headers.host;
    const callbackUrl = `${proto}://${host}/api/oauth/callback`;

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

  // ── POST /companies/:companyId/mcp-credentials/:itemId/api-key ────────────
  // Store an API key credential (non-OAuth) for an MCP item.
  // Body: { material: { env: { KEY: "value" } } }
  router.post(
    "/companies/:companyId/mcp-credentials/:itemId/api-key",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
    const itemId = req.params.itemId as string;
    const userId = req.actor.userId!;
    const companyId = req.params.companyId as string;

    const { material } = req.body as { material?: Record<string, unknown> };
    if (!material || typeof material !== "object" || Object.keys(material).length === 0) {
      throw badRequest("material is required and must be a non-empty object");
    }

    await credSvc.storeCredential(userId, companyId, itemId, "api_key", material);

    res.status(201).json({ ok: true });
  });

  // ── DELETE /companies/:companyId/mcp-credentials/:id ──────────────────────
  // Revoke a credential (clear material, set status=revoked).
  router.delete(
    "/companies/:companyId/mcp-credentials/:id",
    requirePermission(db, "mcp:connect"),
    async (req, res) => {
    const credentialId = req.params.id as string;
    const userId = req.actor.userId!;
    const companyId = req.params.companyId as string;

    const revoked = await credSvc.revoke(credentialId, userId, companyId);
    if (!revoked) {
      res.status(404).json({ error: "Credential not found" });
      return;
    }

    res.status(204).send();
  });

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
  const payload = JSON.stringify(result);
  // Escape for safe embedding in a JS string literal
  const escaped = payload.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MCP OAuth</title>
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
    <div class="icon">${result.success ? "✅" : "❌"}</div>
    <h2>${result.success ? "Connected!" : "Connection failed"}</h2>
    <p>${result.success ? "You can close this window." : escapeHtml(result.error ?? "Unknown error")}</p>
  </div>
  <script>
    try {
      const payload = '${escaped}';
      window.opener?.postMessage({ type: 'mcp-oauth-result', ...JSON.parse(payload) }, '*');
    } catch (e) { /* ignore */ }
    setTimeout(() => { try { window.close(); } catch(e){} }, 2000);
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
