import { Router } from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS,
  createSsoConfigurationSchema,
  updateSsoConfigurationSchema,
} from "@mnm/shared";
import { ssoConfigurationService } from "../services/sso-configurations.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";

export function ssoRoutes(db: Db) {
  const router = Router();
  const ssoService = ssoConfigurationService(db);

  // sso-s01-route-list
  // GET /companies/:companyId/sso — list SSO configurations
  router.get(
    "/companies/:companyId/sso",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const configurations = await ssoService.listConfigurations(companyId as string);
      res.json({ configurations });
    },
  );

  // sso-s01-route-get
  // GET /companies/:companyId/sso/:configId — get SSO configuration by ID
  router.get(
    "/companies/:companyId/sso/:configId",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId, configId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const config = await ssoService.getConfigurationById(
        companyId as string,
        configId as string,
      );
      res.json(config);
    },
  );

  // sso-s01-route-create
  // POST /companies/:companyId/sso — create SSO configuration
  router.post(
    "/companies/:companyId/sso",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = createSsoConfigurationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(
          parsed.error.issues.map((i: { message: string }) => i.message).join(", "),
        );
      }

      const config = await ssoService.createConfiguration(
        companyId as string,
        parsed.data,
        actor.actorId,
      );

      // sso-s01-audit-created
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sso.config_created",
        targetType: "sso_config",
        targetId: config.id,
        metadata: {
          provider: parsed.data.provider,
          displayName: parsed.data.displayName,
          emailDomain: parsed.data.emailDomain,
        },
      });

      res.status(201).json(config);
    },
  );

  // sso-s01-route-update
  // PUT /companies/:companyId/sso/:configId — update SSO configuration
  router.put(
    "/companies/:companyId/sso/:configId",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId, configId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = updateSsoConfigurationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(
          parsed.error.issues.map((i: { message: string }) => i.message).join(", "),
        );
      }

      const config = await ssoService.updateConfiguration(
        companyId as string,
        configId as string,
        parsed.data,
      );

      // sso-s01-audit-updated
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sso.config_updated",
        targetType: "sso_config",
        targetId: configId as string,
        metadata: { configId, changes: Object.keys(parsed.data) },
      });

      res.json(config);
    },
  );

  // sso-s01-route-delete
  // DELETE /companies/:companyId/sso/:configId — delete SSO configuration
  router.delete(
    "/companies/:companyId/sso/:configId",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId, configId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deleted = await ssoService.deleteConfiguration(
        companyId as string,
        configId as string,
      );

      // sso-s01-audit-deleted
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sso.config_deleted",
        targetType: "sso_config",
        targetId: configId as string,
        metadata: { configId, provider: deleted.provider, displayName: deleted.displayName },
        severity: "warning",
      });

      res.json({ status: "deleted", id: configId });
    },
  );

  // sso-s01-route-toggle
  // POST /companies/:companyId/sso/:configId/toggle — toggle enabled/disabled
  router.post(
    "/companies/:companyId/sso/:configId/toggle",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId, configId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const config = await ssoService.toggleEnabled(
        companyId as string,
        configId as string,
      );

      // sso-s01-audit-toggled
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sso.config_toggled",
        targetType: "sso_config",
        targetId: configId as string,
        metadata: { configId, enabled: config.enabled, provider: config.provider },
      });

      res.json(config);
    },
  );

  // sso-s01-route-verify
  // POST /companies/:companyId/sso/:configId/verify — verify SSO configuration
  router.post(
    "/companies/:companyId/sso/:configId/verify",
    requirePermission(db, PERMISSIONS.COMPANY_MANAGE_SSO),
    async (req, res) => {
      const { companyId, configId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const config = await ssoService.verifyConfiguration(
        companyId as string,
        configId as string,
      );

      // sso-s01-audit-verified
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "sso.config_verified",
        targetType: "sso_config",
        targetId: configId as string,
        metadata: { configId, provider: config.provider, verifiedAt: config.verifiedAt },
      });

      res.json(config);
    },
  );

  return router;
}
