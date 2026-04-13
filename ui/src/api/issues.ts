import type { Approval, Issue, IssueAttachment, IssueComment, IssueLabel } from "@mnm/shared";
import { api } from "./client";

export const issuesApi = {
  list: (
    companyId: string,
    filters?: {
      status?: string;
      projectId?: string;
      assigneeAgentId?: string;
      assigneeUserId?: string;
      assigneeTagId?: string;
      touchedByUserId?: string;
      unreadForUserId?: string;
      labelId?: string;
      q?: string;
      pool?: boolean;
    },
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.assigneeAgentId) params.set("assigneeAgentId", filters.assigneeAgentId);
    if (filters?.assigneeUserId) params.set("assigneeUserId", filters.assigneeUserId);
    if (filters?.assigneeTagId) params.set("assigneeTagId", filters.assigneeTagId);
    if (filters?.touchedByUserId) params.set("touchedByUserId", filters.touchedByUserId);
    if (filters?.unreadForUserId) params.set("unreadForUserId", filters.unreadForUserId);
    if (filters?.labelId) params.set("labelId", filters.labelId);
    if (filters?.q) params.set("q", filters.q);
    if (filters?.pool) params.set("pool", "true");
    const qs = params.toString();
    return api.get<Issue[]>(`/companies/${companyId}/issues${qs ? `?${qs}` : ""}`);
  },
  listLabels: (companyId: string) => api.get<IssueLabel[]>(`/companies/${companyId}/labels`),
  createLabel: (companyId: string, data: { name: string; color: string }) =>
    api.post<IssueLabel>(`/companies/${companyId}/labels`, data),
  deleteLabel: (companyId: string, id: string) => api.delete<IssueLabel>(`/companies/${companyId}/labels/${id}`),
  get: (companyId: string, id: string) => api.get<Issue>(`/companies/${companyId}/issues/${id}`),
  markRead: (companyId: string, id: string) => api.post<{ id: string; lastReadAt: Date }>(`/companies/${companyId}/issues/${id}/read`, {}),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Issue>(`/companies/${companyId}/issues`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) => api.patch<Issue>(`/companies/${companyId}/issues/${id}`, data),
  remove: (companyId: string, id: string) => api.delete<Issue>(`/companies/${companyId}/issues/${id}`),
  checkout: (companyId: string, id: string, agentId: string) =>
    api.post<Issue>(`/companies/${companyId}/issues/${id}/checkout`, {
      agentId,
      expectedStatuses: ["todo", "backlog", "blocked"],
    }),
  release: (companyId: string, id: string) => api.post<Issue>(`/companies/${companyId}/issues/${id}/release`, {}),
  listComments: (companyId: string, id: string) => api.get<IssueComment[]>(`/companies/${companyId}/issues/${id}/comments`),
  addComment: (companyId: string, id: string, body: string, reopen?: boolean, interrupt?: boolean) =>
    api.post<IssueComment>(
      `/companies/${companyId}/issues/${id}/comments`,
      {
        body,
        ...(reopen === undefined ? {} : { reopen }),
        ...(interrupt === undefined ? {} : { interrupt }),
      },
    ),
  listAttachments: (companyId: string, id: string) => api.get<IssueAttachment[]>(`/companies/${companyId}/issues/${id}/attachments`),
  uploadAttachment: (
    companyId: string,
    issueId: string,
    file: File,
    issueCommentId?: string | null,
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (issueCommentId) {
      form.append("issueCommentId", issueCommentId);
    }
    return api.postForm<IssueAttachment>(`/companies/${companyId}/issues/${issueId}/attachments`, form);
  },
  deleteAttachment: (companyId: string, id: string) => api.delete<{ ok: true }>(`/companies/${companyId}/attachments/${id}`),
  listApprovals: (companyId: string, id: string) => api.get<Approval[]>(`/companies/${companyId}/issues/${id}/approvals`),
  linkApproval: (companyId: string, id: string, approvalId: string) =>
    api.post<Approval[]>(`/companies/${companyId}/issues/${id}/approvals`, { approvalId }),
  unlinkApproval: (companyId: string, id: string, approvalId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/issues/${id}/approvals/${approvalId}`),
};
