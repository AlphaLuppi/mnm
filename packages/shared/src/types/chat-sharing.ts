export type SharePermission = "read" | "comment" | "edit";

export type ContextLinkType = "document" | "artifact" | "folder" | "channel";

export interface ChatShare {
  id: string;
  companyId: string;
  channelId: string;
  sharedByUserId: string;
  shareToken: string;
  permission: SharePermission;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ChatContextLink {
  id: string;
  channelId: string;
  companyId: string;
  linkType: ContextLinkType;
  documentId: string | null;
  artifactId: string | null;
  folderId: string | null;
  linkedChannelId: string | null;
  addedByUserId: string | null;
  addedAt: string;
}
