import { api } from "./client";
import type { Document, DocumentChunk } from "@mnm/shared";

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

export const documentsApi = {
  upload(companyId: string, file: File, opts?: { title?: string; channelId?: string; folderId?: string }) {
    const formData = new FormData();
    formData.append("file", file);
    if (opts?.title) formData.append("title", opts.title);
    if (opts?.channelId) formData.append("channelId", opts.channelId);
    if (opts?.folderId) formData.append("folderId", opts.folderId);
    return api.postForm<Document>(`/companies/${companyId}/documents/upload`, formData);
  },

  list(companyId: string, opts?: { status?: string; limit?: number; offset?: number }) {
    return api.get<{ documents: Document[]; total: number }>(
      `/companies/${companyId}/documents${buildQuery(opts as Record<string, string | number | undefined> ?? {})}`,
    );
  },

  getById(companyId: string, id: string) {
    return api.get<Document>(`/companies/${companyId}/documents/${id}`);
  },

  getContentUrl(companyId: string, id: string) {
    return `/api/companies/${companyId}/documents/${id}/content`;
  },

  delete(companyId: string, id: string) {
    return api.delete(`/companies/${companyId}/documents/${id}`);
  },

  summarize(companyId: string, id: string, mode: "summary" | "deep_dive" = "summary") {
    return api.post(`/companies/${companyId}/documents/${id}/summarize`, { mode });
  },

  getChunks(companyId: string, id: string) {
    return api.get<DocumentChunk[]>(`/companies/${companyId}/documents/${id}/chunks`);
  },
};
