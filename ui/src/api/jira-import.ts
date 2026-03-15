// onb-s03-api-client

import { api } from "./client";
import type { JiraImportPreview, JiraImportProgress } from "@mnm/shared";

export interface JiraConnectionResult {
  connected: boolean;
  serverInfo: {
    baseUrl: string;
    version: string;
    serverTitle: string;
  };
}

export interface JiraImportStartResult {
  jobId: string;
  status: string;
}

export interface JiraImportJobList {
  jobs: JiraImportProgress[];
}

export interface JiraConnectionConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraImportConfig extends JiraConnectionConfig {
  projectKeys: string[];
  fieldMapping?: {
    statusMapping?: Record<string, string>;
    priorityMapping?: Record<string, string>;
  };
}

// onb-s03-api-connect, onb-s03-api-preview, onb-s03-api-start
// onb-s03-api-listJobs, onb-s03-api-getJob, onb-s03-api-cancel
export const jiraImportApi = {
  // onb-s03-api-connect
  connect: (companyId: string, config: JiraConnectionConfig) =>
    api.post<JiraConnectionResult>(
      `/companies/${companyId}/import/jira/connect`,
      config,
    ),

  // onb-s03-api-preview
  preview: (companyId: string, config: JiraConnectionConfig) =>
    api.post<JiraImportPreview>(
      `/companies/${companyId}/import/jira/preview`,
      config,
    ),

  // onb-s03-api-start
  start: (companyId: string, config: JiraImportConfig) =>
    api.post<JiraImportStartResult>(
      `/companies/${companyId}/import/jira/start`,
      config,
    ),

  // onb-s03-api-listJobs
  listJobs: (companyId: string) =>
    api.get<JiraImportJobList>(
      `/companies/${companyId}/import/jira/jobs`,
    ),

  // onb-s03-api-getJob
  getJob: (companyId: string, jobId: string) =>
    api.get<JiraImportProgress>(
      `/companies/${companyId}/import/jira/jobs/${jobId}`,
    ),

  // onb-s03-api-cancel
  cancel: (companyId: string, jobId: string) =>
    api.post<{ jobId: string; status: string }>(
      `/companies/${companyId}/import/jira/jobs/${jobId}/cancel`,
      {},
    ),
};
