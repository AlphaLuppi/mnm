import { z } from "zod";

export const FOLDER_ITEM_TYPES = ["artifact", "document", "channel"] as const;
export const FOLDER_SHARE_PERMISSIONS = ["viewer", "editor"] as const;

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
});

export type CreateFolder = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
});

export type UpdateFolder = z.infer<typeof updateFolderSchema>;

export const addFolderItemSchema = z.object({
  itemType: z.enum(FOLDER_ITEM_TYPES),
  artifactId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  channelId: z.string().uuid().optional().nullable(),
  displayName: z.string().max(255).optional().nullable(),
});

export type AddFolderItem = z.infer<typeof addFolderItemSchema>;

export const createFolderShareSchema = z.object({
  userId: z.string().min(1),
  permission: z.enum(FOLDER_SHARE_PERMISSIONS).default("viewer"),
});

export type CreateFolderShare = z.infer<typeof createFolderShareSchema>;

export const updateFolderShareSchema = z.object({
  permission: z.enum(FOLDER_SHARE_PERMISSIONS),
});

export type UpdateFolderShare = z.infer<typeof updateFolderShareSchema>;
