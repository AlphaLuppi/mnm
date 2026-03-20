// onb-s03-shared-types

export type ImportJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface JiraImportConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKeys: string[];
  fieldMapping?: {
    statusMapping?: Record<string, string>;
    priorityMapping?: Record<string, string>;
  };
}

export interface JiraImportPreview {
  projects: Array<{
    key: string;
    name: string;
    issueCount: number;
  }>;
  totalIssueCount: number;
}

export interface JiraImportProgress {
  jobId: string;
  status: ImportJobStatus;
  progressTotal: number;
  progressDone: number;
  errors: Array<{
    issueKey: string;
    message: string;
  }>;
  source: string;
  createdAt: string;
  completedAt: string | null;
}
