import { z } from "zod";

export const SHARE_PERMISSIONS = ["read", "comment", "edit"] as const;
export const CONTEXT_LINK_TYPES = ["document", "artifact", "folder", "channel"] as const;

export const createShareSchema = z.object({
  channelId: z.string().uuid(),
  permission: z.enum(SHARE_PERMISSIONS).optional().default("read"),
  expiresAt: z.string().datetime().optional().nullable(),
});

export type CreateShare = z.infer<typeof createShareSchema>;

export const addContextLinkSchema = z.object({
  linkType: z.enum(CONTEXT_LINK_TYPES),
  documentId: z.string().uuid().optional().nullable(),
  artifactId: z.string().uuid().optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
  linkedChannelId: z.string().uuid().optional().nullable(),
});

export type AddContextLink = z.infer<typeof addContextLinkSchema>;
