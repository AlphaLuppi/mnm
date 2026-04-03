import type {
  FeedbackVote,
  FeedbackVoteSummary,
  FeedbackSummary,
  CastFeedbackVote,
  FeedbackSummaryFilters,
} from "@mnm/shared";
import { api } from "./client";

export type { FeedbackVote, FeedbackVoteSummary, FeedbackSummary };

export const feedbackApi = {
  castVote: (companyId: string, issueId: string, data: CastFeedbackVote) =>
    api.post<FeedbackVote>(`/companies/${companyId}/issues/${issueId}/feedback`, data),

  getVotes: (companyId: string, issueId: string) =>
    api.get<FeedbackVoteSummary[]>(`/companies/${companyId}/issues/${issueId}/feedback`),

  deleteVote: (companyId: string, issueId: string, targetId: string) =>
    api.delete<{ ok: boolean }>(`/companies/${companyId}/issues/${issueId}/feedback/${targetId}`),

  getSummary: (companyId: string, filters?: FeedbackSummaryFilters) => {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    const qs = params.toString();
    return api.get<FeedbackSummary>(`/companies/${companyId}/feedback/summary${qs ? `?${qs}` : ""}`);
  },
};
