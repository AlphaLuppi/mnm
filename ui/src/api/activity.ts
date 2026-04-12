import type { ActivityEvent } from "@mnm/shared";
import { api } from "./client";

export interface RunForIssue {
  runId: string;
  status: string;
  agentId: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  invocationSource: string;
  usageJson: Record<string, unknown> | null;
  resultJson: Record<string, unknown> | null;
}

export interface IssueForRun {
  issueId: string;
  identifier: string | null;
  title: string;
  status: string;
  priority: string;
}

export const activityApi = {
  list: (companyId: string) => api.get<ActivityEvent[]>(`/companies/${companyId}/activity`),
  forIssue: (companyId: string, issueId: string) =>
    api.get<ActivityEvent[]>(`/companies/${companyId}/issues/${issueId}/activity`),
  runsForIssue: (companyId: string, issueId: string) =>
    api.get<RunForIssue[]>(`/companies/${companyId}/issues/${issueId}/runs`),
  issuesForRun: (companyId: string, runId: string) =>
    api.get<IssueForRun[]>(`/companies/${companyId}/heartbeat-runs/${runId}/issues`),
};
