import { Router } from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS,
  BLOCK_TYPES,
  blockPropsSchemas,
  validateContentDocumentSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess } from "./authz.js";

export function blockCatalogueRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/block-catalogue — list all available block types
  router.get(
    "/companies/:companyId/block-catalogue",
    requirePermission(db, PERMISSIONS.ISSUES_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const catalogue = BLOCK_TYPES.map((type) => {
        const key = type
          .split("-")
          .map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s.charAt(0).toUpperCase() + s.slice(1)))
          .join("") as keyof typeof blockPropsSchemas;

        const entry = blockPropsSchemas[key];
        return {
          type,
          description: entry?.description ?? type,
          interactive: type === "action-button" || type === "quick-form",
          layout: type === "stack" || type === "section",
        };
      });

      res.json({ blocks: catalogue });
    },
  );

  // POST /companies/:companyId/blocks/validate — validate a ContentDocument
  router.post(
    "/companies/:companyId/blocks/validate",
    requirePermission(db, PERMISSIONS.ISSUES_READ),
    validate(validateContentDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json({ valid: true, document: req.body });
    },
  );

  return router;
}
