import { api, ApiError } from "./client";
import type { Folder, FolderItem, FolderShare } from "@mnm/shared";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export interface FolderDetail extends Folder {
  items: (FolderItem & { artifactTitle?: string | null; documentTitle?: string | null; channelName?: string | null })[];
  tags: { id: string; name: string; slug: string; color: string | null }[];
  shares: FolderShare[];
}

export interface DeletionPreview {
  nativeDocuments: { id: string; title: string; mimeType: string }[];
  importedItems: { id: string; itemType: string; displayName: string | null }[];
  channels: { id: string; name: string | null }[];
}

export const foldersApi = {
  create(companyId: string, input: { name: string; description?: string; icon?: string }) {
    return api.post<Folder>(`/companies/${companyId}/folders`, input);
  },

  list(companyId: string, opts?: { limit?: number; offset?: number }) {
    return api.get<{ folders: Folder[]; total: number }>(
      `/companies/${companyId}/folders${buildQuery(opts as Record<string, string | number | undefined> ?? {})}`,
    );
  },

  getById(companyId: string, id: string) {
    return api.get<FolderDetail>(`/companies/${companyId}/folders/${id}`);
  },

  update(companyId: string, id: string, input: { name?: string; description?: string; icon?: string; instructions?: string | null }) {
    return api.patch<Folder>(`/companies/${companyId}/folders/${id}`, input);
  },

  async delete(companyId: string, id: string, preserveDocumentIds?: string[]) {
    const res = await fetch(`/api/companies/${companyId}/folders/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ preserveDocumentIds: preserveDocumentIds ?? [] }),
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new ApiError(
        (errorBody as { error?: string } | null)?.error ?? `Request failed: ${res.status}`,
        res.status,
        errorBody,
      );
    }
  },

  getDeletionPreview(companyId: string, id: string) {
    return api.get<DeletionPreview>(`/companies/${companyId}/folders/${id}/deletion-preview`);
  },

  addItem(companyId: string, folderId: string, input: { itemType: string; artifactId?: string; documentId?: string; channelId?: string; displayName?: string }) {
    return api.post<FolderItem>(`/companies/${companyId}/folders/${folderId}/items`, input);
  },

  removeItem(companyId: string, folderId: string, itemId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/items/${itemId}`);
  },

  upload(companyId: string, folderId: string, file: File, title?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    return api.postForm<any>(`/companies/${companyId}/folders/${folderId}/upload`, formData);
  },

  // Shares
  listShares(companyId: string, folderId: string) {
    return api.get<FolderShare[]>(`/companies/${companyId}/folders/${folderId}/shares`);
  },

  addShare(companyId: string, folderId: string, input: { userId: string; permission?: string }) {
    return api.post<FolderShare>(`/companies/${companyId}/folders/${folderId}/shares`, input);
  },

  updateShare(companyId: string, folderId: string, shareId: string, input: { permission: string }) {
    return api.patch<FolderShare>(`/companies/${companyId}/folders/${folderId}/shares/${shareId}`, input);
  },

  removeShare(companyId: string, folderId: string, shareId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/shares/${shareId}`);
  },

  // Tags
  addTag(companyId: string, folderId: string, tagId: string) {
    return api.post(`/companies/${companyId}/folders/${folderId}/tags`, { tagId });
  },

  removeTag(companyId: string, folderId: string, tagId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/tags/${tagId}`);
  },
};
