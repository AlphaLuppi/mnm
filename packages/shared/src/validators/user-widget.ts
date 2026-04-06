import { z } from "zod";
import { ContentDocument } from "../types/content-blocks.js";

export const createUserWidgetSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  blocks: ContentDocument,
  dataSource: z.object({
    endpoint: z.string().min(1).refine(
      (v) => v.startsWith("/") && !v.startsWith("//"),
      "endpoint must be a relative path starting with /",
    ),
    params: z.record(z.unknown()).optional(),
    refreshInterval: z.number().min(60).optional(),
  }).optional().nullable(),
  position: z.number().int().min(0).optional(),
  span: z.number().int().min(1).max(4).optional().default(2),
});

export type CreateUserWidget = z.infer<typeof createUserWidgetSchema>;

export const updateUserWidgetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  blocks: ContentDocument.optional(),
  dataSource: z.object({
    endpoint: z.string().min(1).refine(
      (v) => v.startsWith("/") && !v.startsWith("//"),
      "endpoint must be a relative path starting with /",
    ),
    params: z.record(z.unknown()).optional(),
    refreshInterval: z.number().min(60).optional(),
  }).optional().nullable(),
  position: z.number().int().min(0).optional(),
  span: z.number().int().min(1).max(4).optional(),
});

export type UpdateUserWidget = z.infer<typeof updateUserWidgetSchema>;
