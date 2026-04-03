import { z } from "zod";

export const uploadDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive().optional(),
  assetId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UploadDocument = z.infer<typeof uploadDocumentSchema>;

export const summarizeDocumentSchema = z.object({
  documentId: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

export type SummarizeDocument = z.infer<typeof summarizeDocumentSchema>;
