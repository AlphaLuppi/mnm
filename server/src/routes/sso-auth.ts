import { Router } from "express";
import type { Db } from "@mnm/db";
import { ssoDiscoverSchema } from "@mnm/shared";
import { ssoAuthService } from "../services/sso-auth.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";

export function ssoAuthRoutes(db: Db) {
  const router = Router();
  const ssoAuth = ssoAuthService(db);

  // sso-s02-route-discover
  // POST /sso/discover — discover SSO provider by email (public, no auth required)
  router.post("/sso/discover", async (req, res) => {
    const parsed = ssoDiscoverSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(
        parsed.error.issues.map((i: { message: string }) => i.message).join(", "),
      );
    }

    const result = await ssoAuth.discoverSsoByEmail(parsed.data.email);
    res.json(result);
  });

  // sso-s02-route-saml-login
  // GET /sso/saml/:companyId/login — initiate SAML login (public)
  router.get("/sso/saml/:companyId/login", async (req, res) => {
    const { companyId } = req.params;

    try {
      const initiation = await ssoAuth.initiateSamlLogin(companyId as string);
      res.redirect(302, initiation.loginUrl);
    } catch (err) {
      // sso-s02-audit-rejected
      await emitAuditSafe(req, db, companyId as string, "sso.auth_rejected", "saml_login", companyId as string, {
        reason: err instanceof Error ? err.message : "Unknown error",
        provider: "saml",
      });
      throw err;
    }
  });

  // sso-s02-route-saml-acs
  // POST /sso/saml/:companyId/acs — SAML Assertion Consumer Service (public)
  router.post("/sso/saml/:companyId/acs", async (req, res) => {
    const { companyId } = req.params;
    const samlResponse = req.body.SAMLResponse as string | undefined;
    const relayState = req.body.RelayState as string | undefined;

    if (!samlResponse) {
      throw badRequest("Missing SAMLResponse parameter");
    }

    try {
      const authResult = await ssoAuth.handleSamlCallback(
        companyId as string,
        samlResponse,
        relayState,
      );

      // Create session
      const session = await ssoAuth.createSsoSession(
        authResult.userId,
        req.ip ?? req.socket?.remoteAddress,
        req.get("user-agent"),
      );

      // Emit audit event
      const auditAction = authResult.isNewUser ? "sso.user_provisioned" : "sso.account_linked";
      // sso-s02-audit-provisioned / sso-s02-audit-linked
      await emitAuditSafe(req, db, companyId as string, auditAction, "user", authResult.userId, {
        provider: "saml",
        email: authResult.email,
        isNewUser: authResult.isNewUser,
      });

      // Set session cookie and redirect to frontend
      res.cookie("better-auth.session_token", session.token, {
        httpOnly: true,
        secure: req.secure,
        sameSite: "lax",
        expires: session.expiresAt,
        path: "/",
      });

      res.redirect(302, "/");
    } catch (err) {
      // sso-s02-audit-failed
      await emitAuditSafe(req, db, companyId as string, "sso.auth_failed", "saml_assertion", companyId as string, {
        reason: err instanceof Error ? err.message : "Unknown error",
        provider: "saml",
      }, "warning");
      throw err;
    }
  });

  // sso-s02-route-oidc-login
  // GET /sso/oidc/:companyId/login — initiate OIDC login (public)
  router.get("/sso/oidc/:companyId/login", async (req, res) => {
    const { companyId } = req.params;

    try {
      const initiation = await ssoAuth.initiateOidcLogin(companyId as string);
      res.redirect(302, initiation.loginUrl);
    } catch (err) {
      // sso-s02-audit-rejected
      await emitAuditSafe(req, db, companyId as string, "sso.auth_rejected", "oidc_login", companyId as string, {
        reason: err instanceof Error ? err.message : "Unknown error",
        provider: "oidc",
      });
      throw err;
    }
  });

  // sso-s02-route-oidc-callback
  // GET /sso/oidc/:companyId/callback — OIDC authorization code callback (public)
  router.get("/sso/oidc/:companyId/callback", async (req, res) => {
    const { companyId } = req.params;
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!code) {
      throw badRequest("Missing code parameter");
    }
    if (!state) {
      throw badRequest("Missing state parameter");
    }

    try {
      const authResult = await ssoAuth.handleOidcCallback(
        companyId as string,
        code,
        state,
      );

      // Create session
      const session = await ssoAuth.createSsoSession(
        authResult.userId,
        req.ip ?? req.socket?.remoteAddress,
        req.get("user-agent"),
      );

      // Emit audit event
      const auditAction = authResult.isNewUser ? "sso.user_provisioned" : "sso.account_linked";
      // sso-s02-audit-provisioned / sso-s02-audit-linked
      await emitAuditSafe(req, db, companyId as string, auditAction, "user", authResult.userId, {
        provider: "oidc",
        email: authResult.email,
        isNewUser: authResult.isNewUser,
      });

      // Set session cookie and redirect to frontend
      res.cookie("better-auth.session_token", session.token, {
        httpOnly: true,
        secure: req.secure,
        sameSite: "lax",
        expires: session.expiresAt,
        path: "/",
      });

      res.redirect(302, "/");
    } catch (err) {
      // sso-s02-audit-failed
      await emitAuditSafe(req, db, companyId as string, "sso.auth_failed", "oidc_callback", companyId as string, {
        reason: err instanceof Error ? err.message : "Unknown error",
        provider: "oidc",
      }, "warning");
      throw err;
    }
  });

  // sso-s02-route-sync
  // POST /companies/:companyId/sso/:configId/sync — sync IdP metadata (requires permission)
  router.post(
    "/companies/:companyId/sso/:configId/sync",
    requirePermission(db, "company:manage_sso"),
    async (req, res) => {
      const { companyId, configId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const result = await ssoAuth.syncMetadata(
        companyId as string,
        configId as string,
      );

      // sso-s02-audit-synced
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sso.metadata_synced",
        targetType: "sso_config",
        targetId: configId as string,
        metadata: {
          configId,
          entityId: result.entityId,
          endpoints: result.endpoints,
        },
      });

      res.json(result);
    },
  );

  return router;
}

/**
 * Safe audit emitter for SSO routes — fire-and-forget.
 * SSO auth routes may not have a fully authenticated actor, so we
 * construct minimal audit params manually.
 */
async function emitAuditSafe(
  req: import("express").Request,
  db: Db,
  companyId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
  severity?: "info" | "warning" | "error" | "critical",
): Promise<void> {
  try {
    await emitAudit({
      req,
      db,
      companyId,
      action,
      targetType,
      targetId,
      metadata,
      severity,
    });
  } catch {
    // Audit must never block SSO flow
  }
}
