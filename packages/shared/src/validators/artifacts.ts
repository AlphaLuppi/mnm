import { z } from "zod";

export const ARTIFACT_TYPES = ["markdown", "code", "diagram", "spreadsheet", "html"] as const;

export const createArtifactSchema = z.object({
  title: z.string().min(1).max(255),
  artifactType: z.enum(ARTIFACT_TYPES).optional().default("markdown"),
  language: z.string().optional().nullable(),
  content: z.string().min(1),
  sourceChannelId: z.string().uuid().optional().nullable(),
  sourceMessageId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateArtifact = z.infer<typeof createArtifactSchema>;

export const updateArtifactSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  changeSummary: z.string().max(500).optional(),
  language: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateArtifact = z.infer<typeof updateArtifactSchema>;
