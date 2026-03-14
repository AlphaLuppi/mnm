import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  createCredentialProxyRuleSchema,
  updateCredentialProxyRuleSchema,
  testCredentialProxyRuleSchema,
} from "@mnm/shared";
import { credentialProxyRulesService } from "../services/credential-proxy-rules.js";
import { secretService } from "../services/secrets.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { emitAudit } from "../services/audit-emitter.js";
import { badRequest } from "../errors.js";

export function credentialProxyRulesRoutes(db: Db) {
  const router = Router();
  const rulesService = credentialProxyRulesService(db);

  // cont-s02-route-list-rules
  // GET /companies/:companyId/credential-proxy-rules — list rules
  router.get(
    "/companies/:companyId/credential-proxy-rules",
    requirePermission(db, "company:manage_settings"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const rules = await rulesService.listRules(companyId as string);
      res.json({ rules });
    },
  );

  // cont-s02-route-get-rule
  // GET /companies/:companyId/credential-proxy-rules/:ruleId — get rule by ID
  router.get(
    "/companies/:companyId/credential-proxy-rules/:ruleId",
    requirePermission(db, "company:manage_settings"),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const rule = await rulesService.getRuleById(companyId as string, ruleId as string);
      res.json(rule);
    },
  );

  // cont-s02-route-create-rule
  // POST /companies/:companyId/credential-proxy-rules — create rule
  router.post(
    "/companies/:companyId/credential-proxy-rules",
    requirePermission(db, "company:manage_settings"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = createCredentialProxyRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i: { message: string }) => i.message).join(", "));
      }

      const rule = await rulesService.createRule(
        companyId as string,
        parsed.data,
        actor.actorId,
      );

      // cont-s02-audit-rule-created
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "credential_proxy_rule.created",
        targetType: "credential_proxy_rule",
        targetId: rule.id,
        metadata: {
          name: parsed.data.name,
          secretPattern: parsed.data.secretPattern,
          allowedAgentRoles: parsed.data.allowedAgentRoles,
        },
      });

      res.status(201).json(rule);
    },
  );

  // cont-s02-route-update-rule
  // PUT /companies/:companyId/credential-proxy-rules/:ruleId — update rule
  router.put(
    "/companies/:companyId/credential-proxy-rules/:ruleId",
    requirePermission(db, "company:manage_settings"),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = updateCredentialProxyRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i: { message: string }) => i.message).join(", "));
      }

      const rule = await rulesService.updateRule(
        companyId as string,
        ruleId as string,
        parsed.data,
      );

      // cont-s02-audit-rule-updated
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "credential_proxy_rule.updated",
        targetType: "credential_proxy_rule",
        targetId: ruleId as string,
        metadata: { ruleId, changes: Object.keys(parsed.data) },
      });

      res.json(rule);
    },
  );

  // cont-s02-route-delete-rule
  // DELETE /companies/:companyId/credential-proxy-rules/:ruleId — delete rule
  router.delete(
    "/companies/:companyId/credential-proxy-rules/:ruleId",
    requirePermission(db, "company:manage_settings"),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const deleted = await rulesService.deleteRule(companyId as string, ruleId as string);

      // cont-s02-audit-rule-deleted
      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "credential_proxy_rule.deleted",
        targetType: "credential_proxy_rule",
        targetId: ruleId as string,
        metadata: { ruleId, name: deleted.name },
        severity: "warning",
      });

      res.json({ status: "deleted", id: ruleId });
    },
  );

  // cont-s02-route-test-rule
  // POST /companies/:companyId/credential-proxy-rules/:ruleId/test — test rule (dry-run)
  router.post(
    "/companies/:companyId/credential-proxy-rules/:ruleId/test",
    requirePermission(db, "company:manage_settings"),
    async (req, res) => {
      const { companyId, ruleId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const parsed = testCredentialProxyRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i: { message: string }) => i.message).join(", "));
      }

      const rule = await rulesService.getRuleById(companyId as string, ruleId as string);
      const matched = rulesService.matchesPattern(rule.secretPattern, parsed.data.secretName);

      // Check if the secret exists in the company
      let secretFound = false;
      if (matched) {
        try {
          const secrets = secretService(db);
          const secret = await secrets.getByName(companyId as string, parsed.data.secretName);
          secretFound = secret !== null;
        } catch {
          secretFound = false;
        }
      }

      await emitAudit({
        req,
        db,
        companyId: companyId as string,
        action: "credential_proxy_rule.tested",
        targetType: "credential_proxy_rule",
        targetId: ruleId as string,
        metadata: { ruleId, secretName: parsed.data.secretName, matched },
      });

      res.json({
        matched,
        rule: matched ? rule : null,
        secretFound,
        secretName: parsed.data.secretName,
        reason: matched
          ? (secretFound ? undefined : "secret_not_found")
          : "pattern_no_match",
      });
    },
  );

  return router;
}
