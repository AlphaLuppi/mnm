import { Router } from "express";
import type { Db } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import { setTenantContext, clearTenantContext } from "../middleware/tenant-context.js";
import {
  connectorService,
  verifyConnectorState,
  validateRedirectAfter,
} from "../services/connectors.js";

interface CallbackOptions {
  publicUrl: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

/**
 * OAuth 2.0 callback dispatcher — generic for ALL providers configured via
 * the Connectors Platform. Mounted at /api/connectors/callback (NON tenant-
 * scoped because the provider can't know the company at redirect time).
 *
 * Flow:
 *   1. Verify the signed state JWT (HS256, BETTER_AUTH_SECRET, 10min TTL).
 *   2. Re-establish tenant context for RLS using state.companyId.
 *   3. Exchange the authorization code for an access_token at connector.token_url.
 *   4. Encrypt and upsert into connector_tokens (NOT account BetterAuth).
 *   5. Audit user_connected. H1: validate redirect_after whitelist (path-relative
 *      starting with / but not //, OR absolute URL matching MNM_PUBLIC_URL origin).
 *      On reject: redirect to default + audit redirect_after_rejected.
 */
export function connectorsCallbackRoutes(db: Db, opts: CallbackOptions): Router {
  const router = Router();
  const svc = connectorService(db);

  router.get("/api/connectors/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;

    if (error) {
      logger.warn({ error, errorDescription: req.query.error_description }, "[connectors] callback received provider error");
      return res.redirect(`${opts.publicUrl}/settings/accounts?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }

    let statePayload;
    try {
      statePayload = await verifyConnectorState(state);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[connectors] callback state verify failed");
      return res.status(400).send("Invalid or expired state");
    }

    const { companyId, connectorId, userId, redirectAfter } = statePayload;

    // Set tenant context for RLS (route is NOT under /companies/:companyId middleware)
    await setTenantContext(db, companyId);

    try {
      const connector = await svc.getConnectorById(connectorId, companyId).catch(() => null);
      if (!connector || !connector.enabled) {
        return res.redirect(
          `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("CONNECTOR_NOT_AVAILABLE")}`,
        );
      }
      if (connector.type !== "oauth2") {
        return res.status(400).send("Connector is not an OAuth2 connector");
      }
      if (!connector.tokenUrl || !connector.clientId || !connector.clientSecretCiphertext) {
        return res.status(500).send("Connector mis-configured");
      }

      // Decrypt client_secret to call provider
      const { decryptSecret } = await import("../services/secret-crypto.js");
      const clientSecret = decryptSecret({
        iv: connector.clientSecretIv!,
        ciphertext: connector.clientSecretCiphertext,
        tag: connector.clientSecretTag!,
      });

      // Exchange code → token
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: connector.clientId,
        client_secret: clientSecret,
      });
      if (connector.redirectUri) tokenBody.set("redirect_uri", connector.redirectUri);

      const tokenResp = await fetch(connector.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: tokenBody.toString(),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text().catch(() => "");
        logger.warn(
          { status: tokenResp.status, errText: errText.slice(0, 200), connectorId },
          "[connectors] token exchange failed",
        );
        return res.redirect(
          `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("TOKEN_EXCHANGE_FAILED")}`,
        );
      }

      const tokenJson = (await tokenResp.json()) as OAuthTokenResponse;
      if (!tokenJson.access_token) {
        return res.redirect(
          `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("PROVIDER_NO_ACCESS_TOKEN")}`,
        );
      }

      const expiresAt = tokenJson.expires_in
        ? new Date(Date.now() + tokenJson.expires_in * 1000)
        : null;
      const scopesGranted = tokenJson.scope
        ? tokenJson.scope.split(/\s+/).filter(Boolean)
        : (connector.scopes ?? []);

      await svc.upsertConnectorToken({
        companyId,
        userId,
        connectorId: connector.id,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresAt,
        scopesGranted,
      });

      await svc.recordAudit({
        companyId,
        connectorId: connector.id,
        actorUserId: userId,
        action: "user_connected",
        diffJson: {
          method: "oauth2",
          scopes: scopesGranted,
        },
      });

      // H1 redirect_after whitelist
      const safeRedirect = validateRedirectAfter(redirectAfter, opts.publicUrl);
      if (redirectAfter && !safeRedirect) {
        // log & audit rejection (do not surface URL to caller)
        await svc.recordAudit({
          companyId,
          connectorId: connector.id,
          actorUserId: userId,
          action: "redirect_after_rejected",
          diffJson: {
            // include only origin to avoid leaking the malicious URL into audit
            // (truncated)
            redirectAfterPrefix: redirectAfter.slice(0, 120),
          },
        });
        logger.warn(
          { connectorId, userId, redirectAfter: redirectAfter.slice(0, 120) },
          "[connectors] redirect_after rejected as unsafe",
        );
      }

      const finalRedirect =
        safeRedirect ??
        `/settings/accounts?connected=${encodeURIComponent(connector.providerSlug)}`;
      return res.redirect(finalRedirect);
    } finally {
      await clearTenantContext(db);
    }
  });

  return router;
}
