import { Router } from "express";
import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { logger } from "../middleware/logger.js";
import {
  connectorService,
  verifyConnectorState,
  validateRedirectAfter,
} from "../services/connectors.js";
import { decryptSecret } from "../services/secret-crypto.js";
import { publishLiveEvent } from "../services/live-events.js";
import { githubAppService } from "../services/github-app.js";

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

type CallbackResult =
  | { kind: "redirect"; url: string }
  | { kind: "error"; status: number; body: string };

/**
 * OAuth 2.0 callback dispatcher — generic for ALL providers configured via
 * the Connectors Platform. Mounted at /api/connectors/callback (NON tenant-
 * scoped because the provider can't know the company at redirect time).
 *
 * Flow:
 *   1. Verify the signed state JWT (HS256, BETTER_AUTH_SECRET, 10min TTL).
 *   2. Open a DB transaction and pin tenant context with is_local=true so all
 *      queries hit the same connection AND the context auto-clears on
 *      COMMIT/ROLLBACK (HIGH-A3 connection-pinning fix).
 *   3. C2 cross-tenant guard: assert userId is an active member of companyId
 *      BEFORE any write (HIGH-A1 TOCTOU defense).
 *   4. Exchange the authorization code for an access_token at connector.token_url.
 *   5. Encrypt and upsert into connector_tokens (NOT account BetterAuth).
 *   6. Audit user_connected. H1: validate redirect_after whitelist.
 */
export function connectorsCallbackRoutes(db: Db, opts: CallbackOptions): Router {
  const router = Router();

  router.get("/api/connectors/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;

    if (error) {
      logger.warn(
        { error, errorDescription: req.query.error_description },
        "[connectors] callback received provider error",
      );
      return res.redirect(
        `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }

    let statePayload;
    try {
      statePayload = await verifyConnectorState(state);
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "[connectors] callback state verify failed",
      );
      return res.status(400).send("Invalid or expired state");
    }

    const { companyId, connectorId, userId, redirectAfter } = statePayload;

    // HIGH-A3 — wrap entire DB workflow in a transaction so the connection used
    // for set_config(..., is_local=true) is the same one used by every read/write
    // afterwards. The tx-local setting auto-clears at COMMIT/ROLLBACK, which
    // prevents the SEC-T3-6 cross-connection RLS leak documented in
    // tenant-context.ts:22-33.
    let result: CallbackResult;
    try {
      result = await db.transaction(async (tx): Promise<CallbackResult> => {
        await tx.execute(
          sql`SELECT set_config('app.current_company_id', ${companyId}, true)`,
        );

        // tx is a PgTransaction but exposes the same query API as Db. The cast
        // is safe at runtime — connectorService only invokes select/insert/etc.
        const txSvc = connectorService(tx as unknown as Db);

        // HIGH-A1 — C2 cross-tenant guard BEFORE any write. The state JWT is
        // signed with BETTER_AUTH_SECRET so it cannot be forged externally, but
        // a user's company membership may have been revoked between authorize
        // and callback (TOCTOU). Refuse the upsert in that case.
        try {
          await txSvc.assertUserInCompany(userId, companyId);
        } catch (err) {
          logger.warn(
            { err: (err as Error).message, userId, companyId, connectorId },
            "[connectors] callback: user is not an active member of company — rejecting",
          );
          return {
            kind: "redirect",
            url: `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("USER_NOT_IN_COMPANY")}`,
          };
        }

        const connector = await txSvc
          .getConnectorById(connectorId, companyId)
          .catch(() => null);
        if (!connector || !connector.enabled) {
          return {
            kind: "redirect",
            url: `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("CONNECTOR_NOT_AVAILABLE")}`,
          };
        }
        if (connector.type !== "oauth2") {
          return { kind: "error", status: 400, body: "Connector is not an OAuth2 connector" };
        }
        if (
          !connector.tokenUrl ||
          !connector.clientId ||
          !connector.clientSecretCiphertext ||
          !connector.clientSecretIv ||
          !connector.clientSecretTag
        ) {
          return { kind: "error", status: 500, body: "Connector mis-configured" };
        }

        const clientSecret = decryptSecret({
          iv: connector.clientSecretIv,
          ciphertext: connector.clientSecretCiphertext,
          tag: connector.clientSecretTag,
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
          return {
            kind: "redirect",
            url: `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("TOKEN_EXCHANGE_FAILED")}`,
          };
        }

        const tokenJson = (await tokenResp.json()) as OAuthTokenResponse;
        if (!tokenJson.access_token) {
          return {
            kind: "redirect",
            url: `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("PROVIDER_NO_ACCESS_TOKEN")}`,
          };
        }

        // MED-B2 — only treat expires_in as set when it's actually a number.
        // Some providers omit it for non-expiring tokens (or send null/0).
        const expiresAt =
          typeof tokenJson.expires_in === "number" && tokenJson.expires_in > 0
            ? new Date(Date.now() + tokenJson.expires_in * 1000)
            : null;
        const scopesGranted = tokenJson.scope
          ? tokenJson.scope.split(/\s+/).filter(Boolean)
          : (connector.scopes ?? []);

        await txSvc.upsertConnectorToken({
          companyId,
          userId,
          connectorId: connector.id,
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token ?? null,
          expiresAt,
          scopesGranted,
        });

        await txSvc.recordAudit({
          companyId,
          connectorId: connector.id,
          actorUserId: userId,
          action: "user_connected",
          diffJson: {
            method: "oauth2",
            scopes: scopesGranted,
          },
        });

        // T8 SSE — fire `user.connector_status_changed` (actor-only) so the
        // user's open `/settings/accounts` tab refreshes without polling.
        // Outside the tx because publishLiveEvent doesn't depend on DB state.
        publishLiveEvent({
          companyId,
          type: "user.connector_status_changed",
          payload: {
            userId,
            connectorId: connector.id,
            providerSlug: connector.providerSlug,
            status: "connected",
          },
          visibility: { scope: "actor-only", actorId: userId },
        });

        // H1 redirect_after whitelist
        const safeRedirect = validateRedirectAfter(redirectAfter, opts.publicUrl);
        if (redirectAfter && !safeRedirect) {
          await txSvc.recordAudit({
            companyId,
            connectorId: connector.id,
            actorUserId: userId,
            action: "redirect_after_rejected",
            diffJson: {
              // include only prefix to avoid leaking the malicious URL into audit
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
        return { kind: "redirect", url: finalRedirect };
      });
    } catch (err) {
      logger.error(
        { err, connectorId, userId, companyId },
        "[connectors] callback transaction failed",
      );
      return res.redirect(
        `${opts.publicUrl}/settings/accounts?error=${encodeURIComponent("CALLBACK_FAILED")}`,
      );
    }

    if (result.kind === "redirect") {
      return res.redirect(result.url);
    }
    return res.status(result.status).send(result.body);
  });

  // ── GitHub App install callback (Phase 1 step 5) ──────────────────────────
  // GitHub redirects here after the org admin clicks "Install" / "Configure".
  // Query params:
  //   ?installation_id=<id>&setup_action=install|update[&state=<jwt>]
  // The optional `state` JWT carries the same shape as the OAuth callback
  // (companyId + connectorId + userId). When the App was created with
  // `request_oauth_on_install: true`, GitHub also forwards `?code=` for a
  // user-OAuth exchange — we ignore that here (Phase 5 wizard configures
  // the App separately from the connector OAuth flow).
  router.get("/api/connectors/github/app-install/callback", async (req, res) => {
    const installationId =
      typeof req.query.installation_id === "string" ? req.query.installation_id : null;
    const setupAction =
      typeof req.query.setup_action === "string" ? req.query.setup_action : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!installationId) {
      return res.status(400).send("Missing installation_id");
    }
    if (!state) {
      return res.status(400).send("Missing state");
    }

    let payload;
    try {
      payload = await verifyConnectorState(state);
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "[github-app] install callback state verify failed",
      );
      return res.status(400).send("Invalid or expired state");
    }
    const { companyId, connectorId, userId } = payload;

    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.current_company_id', ${companyId}, true)`,
        );
        const txConnectors = connectorService(tx as unknown as Db);
        // C2 cross-tenant guard before any write.
        await txConnectors.assertUserInCompany(userId, companyId);

        const githubApp = await txConnectors.getConnectorById(connectorId, companyId)
          .then(() =>
            githubAppService(tx as unknown as Db).getGitHubAppByConnector(
              companyId,
              connectorId,
            ),
          );
        if (!githubApp) {
          logger.warn(
            { connectorId, companyId, installationId },
            "[github-app] install callback for connector with no App row — ignoring",
          );
          return;
        }

        // Sync the installation metadata from GitHub (account_login, type,
        // repository_selection). This also handles "update" setup_action by
        // refreshing the row.
        const upserted = await githubAppService(tx as unknown as Db).upsertInstallationFromCallback({
          companyId,
          githubAppId: githubApp.id,
          installationId,
        });

        // Audit + SSE event (outside the tx-state mutation but still under the
        // pinned tenant context).
        await txConnectors.recordAudit({
          companyId,
          connectorId,
          actorUserId: userId,
          action: "connector_updated",
          diffJson: {
            change: "github_app_installation_added",
            installationId,
            accountLogin: upserted.accountLogin,
            setupAction,
          },
        });

        publishLiveEvent({
          companyId,
          type: "connector.github_app_installation_added",
          payload: {
            connectorId,
            installationId,
            accountLogin: upserted.accountLogin,
          },
        });
      });
    } catch (err) {
      logger.error(
        { err, connectorId, userId, companyId, installationId },
        "[github-app] install callback transaction failed",
      );
      return res.redirect(
        `${opts.publicUrl}/admin/connectors/${encodeURIComponent(connectorId)}?error=${encodeURIComponent("INSTALL_CALLBACK_FAILED")}`,
      );
    }

    return res.redirect(
      `${opts.publicUrl}/admin/connectors/${encodeURIComponent(connectorId)}?focus=app-installations`,
    );
  });

  return router;
}
