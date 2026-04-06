import { z } from "zod";
import { ContentDocument } from "../types/content-blocks.js";

/** Validation schema for content_blocks JSONB fields */
export const contentBlocksSchema = ContentDocument.optional().nullable();

/** Standalone validation — used by POST /blocks/validate */
export const validateContentDocumentSchema = z.object({
  document: ContentDocument,
});

export type ValidateContentDocument = z.infer<typeof validateContentDocumentSchema>;
