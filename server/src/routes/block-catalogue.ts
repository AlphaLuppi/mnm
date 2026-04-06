import { Router } from "express";
import type { Db } from "@mnm/db";
import { ContentDocument, BLOCK_TYPES } from "@mnm/shared";
import { zodToJsonSchema } from "zod-to-json-schema";
import { validate } from "../middleware/validate.js";
import { validateContentDocumentSchema } from "@mnm/shared";

export function blockCatalogueRoutes(_db: Db) {
  const router = Router();

  // GET /block-catalogue — Return JSON Schema for agent prompts
  router.get(
    "/companies/:companyId/block-catalogue",
    (_req, res) => {
      const jsonSchema = zodToJsonSchema(ContentDocument, {
        name: "ContentDocument",
        $refStrategy: "none",
      });

      res.json({
        schemaVersion: 1,
        blockTypes: BLOCK_TYPES,
        jsonSchema,
      });
    },
  );

  // POST /blocks/validate — Validate a ContentDocument
  router.post(
    "/companies/:companyId/blocks/validate",
    validate(validateContentDocumentSchema),
    (_req, res) => {
      // If validation passes (via the validate middleware), the document is valid
      res.json({ valid: true });
    },
  );

  return router;
}
