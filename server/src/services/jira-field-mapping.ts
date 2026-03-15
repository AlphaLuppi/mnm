// onb-s03-field-mapping

// --- Types ---

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: string | null;
    status?: { name: string } | null;
    priority?: { name: string } | null;
    issuetype?: { name: string } | null;
    parent?: { key: string } | null;
    project?: { key: string } | null;
    assignee?: { emailAddress?: string; displayName?: string } | null;
    created?: string | null;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string | null;
}

export interface JiraFieldMappingConfig {
  statusMapping?: Record<string, string>;
  priorityMapping?: Record<string, string>;
}

// --- Default Mappings ---

export const DEFAULT_STATUS_MAP: Record<string, string> = {
  "To Do": "backlog",
  "Open": "backlog",
  "Backlog": "backlog",
  "Reopened": "backlog",
  "New": "backlog",
  "In Progress": "in_progress",
  "In Review": "in_progress",
  "In Development": "in_progress",
  "Code Review": "in_progress",
  "Testing": "in_progress",
  "Done": "done",
  "Closed": "done",
  "Resolved": "done",
  "Complete": "done",
  "Cancelled": "cancelled",
  "Won't Do": "cancelled",
  "Rejected": "cancelled",
};

export const DEFAULT_PRIORITY_MAP: Record<string, string> = {
  "Highest": "high",
  "High": "high",
  "Critical": "high",
  "Blocker": "high",
  "Medium": "medium",
  "Normal": "medium",
  "Low": "low",
  "Lowest": "low",
  "Minor": "low",
  "Trivial": "low",
};

// --- Mapping Functions ---

export function mapJiraIssueToMnm(
  jiraIssue: JiraIssue,
  companyId: string,
  config?: JiraFieldMappingConfig,
) {
  const statusMap = config?.statusMapping ?? DEFAULT_STATUS_MAP;
  const priorityMap = config?.priorityMapping ?? DEFAULT_PRIORITY_MAP;

  const jiraStatus = jiraIssue.fields.status?.name ?? "To Do";
  const jiraPriority = jiraIssue.fields.priority?.name ?? "Medium";

  return {
    companyId,
    identifier: jiraIssue.key,
    title: jiraIssue.fields.summary,
    description: jiraIssue.fields.description ?? undefined,
    status: statusMap[jiraStatus] ?? "backlog",
    priority: priorityMap[jiraPriority] ?? "medium",
    // Store Jira-specific metadata
    assigneeAdapterOverrides: {
      jiraIssueType: jiraIssue.fields.issuetype?.name ?? null,
      jiraParentKey: jiraIssue.fields.parent?.key ?? null,
      jiraProjectKey: jiraIssue.fields.project?.key ?? null,
      jiraAssigneeEmail: jiraIssue.fields.assignee?.emailAddress ?? null,
      importedFrom: "jira",
    },
    createdAt: jiraIssue.fields.created
      ? new Date(jiraIssue.fields.created)
      : new Date(),
  };
}

export function mapJiraProjectToMnm(
  jiraProject: JiraProject,
  companyId: string,
) {
  return {
    companyId,
    name: jiraProject.name,
    description: jiraProject.description ?? undefined,
    status: "active" as const,
  };
}
