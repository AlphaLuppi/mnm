export type FolderVisibility = "private" | "public";

export type FolderItemType = "artifact" | "document" | "channel";

export interface FolderItem {
  id: string;
  folderId: string;
  companyId: string;
  itemType: FolderItemType;
  artifactId: string | null;
  documentId: string | null;
  channelId: string | null;
  displayName: string | null;
  addedByUserId: string | null;
  addedAt: string;
}

export interface Folder {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: FolderVisibility;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
}
