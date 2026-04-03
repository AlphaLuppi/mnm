import { api } from "./client";
import type { Folder, FolderItem } from "@mnm/shared";

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

export const foldersApi = {
  create(companyId: string, input: { name: string; description?: string; icon?: string; visibility?: string }) {
    return api.post<Folder>(`/companies/${companyId}/folders`, input);
  },

  list(companyId: string, opts?: { visibility?: string }) {
    return api.get<{ folders: Folder[]; total: number }>(
      `/companies/${companyId}/folders${buildQuery(opts as Record<string, string | number | undefined> ?? {})}`,
    );
  },

  getById(companyId: string, id: string) {
    return api.get<Folder & { items: FolderItem[] }>(`/companies/${companyId}/folders/${id}`);
  },

  update(companyId: string, id: string, input: { name?: string; description?: string; icon?: string; visibility?: string }) {
    return api.patch<Folder>(`/companies/${companyId}/folders/${id}`, input);
  },

  delete(companyId: string, id: string) {
    return api.delete(`/companies/${companyId}/folders/${id}`);
  },

  addItem(companyId: string, folderId: string, input: { itemType: string; artifactId?: string; documentId?: string; channelId?: string; displayName?: string }) {
    return api.post<FolderItem>(`/companies/${companyId}/folders/${folderId}/items`, input);
  },

  removeItem(companyId: string, folderId: string, itemId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/items/${itemId}`);
  },

  addTag(companyId: string, folderId: string, tagId: string) {
    return api.post(`/companies/${companyId}/folders/${folderId}/tags`, { tagId });
  },

  removeTag(companyId: string, folderId: string, tagId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/tags/${tagId}`);
  },
};
