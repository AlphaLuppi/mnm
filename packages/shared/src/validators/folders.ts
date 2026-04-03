import { z } from "zod";

export const FOLDER_VISIBILITIES = ["private", "public"] as const;
export const FOLDER_ITEM_TYPES = ["artifact", "document", "channel"] as const;

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
  visibility: z.enum(FOLDER_VISIBILITIES).optional().default("private"),
});

export type CreateFolder = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = createFolderSchema.partial();

export type UpdateFolder = z.infer<typeof updateFolderSchema>;

export const addFolderItemSchema = z.object({
  itemType: z.enum(FOLDER_ITEM_TYPES),
  artifactId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  channelId: z.string().uuid().optional().nullable(),
  displayName: z.string().max(255).optional().nullable(),
});

export type AddFolderItem = z.infer<typeof addFolderItemSchema>;
