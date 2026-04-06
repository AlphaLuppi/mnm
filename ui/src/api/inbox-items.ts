import { api } from "./client";
import type { InboxItem, InboxItemFilters, InboxItemAction } from "@mnm/shared";

export const inboxItemsApi = {
  list: (companyId: string, filters?: Partial<InboxItemFilters>) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.priority) params.set("priority", filters.priority);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return api.get<{ items: InboxItem[]; total: number }>(
      `/companies/${companyId}/inbox-items${qs ? `?${qs}` : ""}`,
    );
  },

  create: (companyId: string, data: {
    recipientId: string;
    title: string;
    body?: string | null;
    contentBlocks?: unknown;
    category?: string;
    priority?: string;
    relatedIssueId?: string | null;
    relatedAgentId?: string | null;
    expiresAt?: string | null;
  }) =>
    api.post<InboxItem>(`/companies/${companyId}/inbox-items`, data),

  update: (companyId: string, itemId: string, data: { status?: string }) =>
    api.patch<InboxItem>(`/companies/${companyId}/inbox-items/${itemId}`, data),

  action: (companyId: string, itemId: string, data: InboxItemAction) =>
    api.post<InboxItem>(
      `/companies/${companyId}/inbox-items/${itemId}/action`,
      data,
    ),

  delete: (companyId: string, itemId: string) =>
    api.delete(`/companies/${companyId}/inbox-items/${itemId}`),
};
