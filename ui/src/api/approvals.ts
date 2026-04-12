import type { Approval, ApprovalComment, Issue } from "@mnm/shared";
import { api } from "./client";

export const approvalsApi = {
  list: (companyId: string, status?: string) =>
    api.get<Approval[]>(
      `/companies/${companyId}/approvals${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Approval>(`/companies/${companyId}/approvals`, data),
  get: (companyId: string, id: string) =>
    api.get<Approval>(`/companies/${companyId}/approvals/${id}`),
  approve: (companyId: string, id: string, decisionNote?: string) =>
    api.post<Approval>(`/companies/${companyId}/approvals/${id}/approve`, { decisionNote }),
  reject: (companyId: string, id: string, decisionNote?: string) =>
    api.post<Approval>(`/companies/${companyId}/approvals/${id}/reject`, { decisionNote }),
  requestRevision: (companyId: string, id: string, decisionNote?: string) =>
    api.post<Approval>(`/companies/${companyId}/approvals/${id}/request-revision`, { decisionNote }),
  resubmit: (companyId: string, id: string, payload?: Record<string, unknown>) =>
    api.post<Approval>(`/companies/${companyId}/approvals/${id}/resubmit`, { payload }),
  listComments: (companyId: string, id: string) =>
    api.get<ApprovalComment[]>(`/companies/${companyId}/approvals/${id}/comments`),
  addComment: (companyId: string, id: string, body: string) =>
    api.post<ApprovalComment>(`/companies/${companyId}/approvals/${id}/comments`, { body }),
  listIssues: (companyId: string, id: string) =>
    api.get<Issue[]>(`/companies/${companyId}/approvals/${id}/issues`),
};
