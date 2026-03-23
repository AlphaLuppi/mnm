import { api } from "./client";

export type Tag = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
};

export type CreateTagInput = {
  name: string;
  slug: string;
  description?: string;
  color?: string;
};

export type UpdateTagInput = {
  name?: string;
  description?: string;
  color?: string;
};

export const tagsApi = {
  list: (companyId: string, includeArchived = false) =>
    api.get<Tag[]>(
      `/companies/${companyId}/tags${includeArchived ? "?includeArchived=true" : ""}`,
    ),

  get: (companyId: string, tagId: string) =>
    api.get<Tag>(`/companies/${companyId}/tags/${tagId}`),

  create: (companyId: string, input: CreateTagInput) =>
    api.post<Tag>(`/companies/${companyId}/tags`, input),

  update: (companyId: string, tagId: string, input: UpdateTagInput) =>
    api.patch<Tag>(`/companies/${companyId}/tags/${tagId}`, input),

  archive: (companyId: string, tagId: string) =>
    api.post<Tag>(`/companies/${companyId}/tags/${tagId}/archive`, {}),

  unarchive: (companyId: string, tagId: string) =>
    api.post<Tag>(`/companies/${companyId}/tags/${tagId}/unarchive`, {}),

  delete: (companyId: string, tagId: string) =>
    api.delete<void>(`/companies/${companyId}/tags/${tagId}`),

  /** Get tags assigned to a specific agent */
  listForAgent: (companyId: string, agentId: string) =>
    api.get<Tag[]>(`/companies/${companyId}/agents/${agentId}/tags`),
};
