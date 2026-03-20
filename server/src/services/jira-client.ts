// onb-s03-jira-client

import type { JiraIssue, JiraProject } from "./jira-field-mapping.js";

export interface JiraClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraSearchResult {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraServerInfo {
  baseUrl: string;
  version: string;
  serverTitle: string;
}

export function createJiraClient(baseUrl: string, email: string, apiToken: string) {
  // Normalize baseUrl: remove trailing slash
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  // Build Authorization header using base64 encoding (Jira Cloud basic auth)
  const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64");

  async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${normalizedBase}/rest/api/3/${path.replace(/^\//, "")}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Jira API error ${res.status}: ${body.slice(0, 500)}`);
    }

    return res.json();
  }

  // onb-s03-jira-client-testConnection
  async function testConnection(): Promise<JiraServerInfo> {
    const info = await jiraFetch<{ baseUrl: string; version: string; serverTitle: string }>(
      "serverInfo",
    );
    return {
      baseUrl: info.baseUrl,
      version: info.version,
      serverTitle: info.serverTitle,
    };
  }

  // onb-s03-jira-client-fetchProjects
  async function fetchProjects(): Promise<JiraProject[]> {
    const projects = await jiraFetch<JiraProject[]>("project");
    return projects;
  }

  // onb-s03-jira-client-fetchIssuesBatch
  async function fetchIssuesBatch(
    projectKey: string,
    startAt: number = 0,
    maxResults: number = 50,
  ): Promise<JiraSearchResult> {
    const jql = encodeURIComponent(`project = "${projectKey}" ORDER BY created ASC`);
    const result = await jiraFetch<JiraSearchResult>(
      `search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,description,status,priority,issuetype,parent,project,assignee,created`,
    );
    return result;
  }

  // onb-s03-jira-client-fetchIssue
  async function fetchIssue(issueKey: string): Promise<JiraIssue> {
    const issue = await jiraFetch<JiraIssue>(`issue/${issueKey}`);
    return issue;
  }

  // onb-s03-jira-client-getIssueCount
  async function getIssueCount(projectKey: string): Promise<number> {
    const jql = encodeURIComponent(`project = "${projectKey}"`);
    const result = await jiraFetch<{ total: number }>(
      `search?jql=${jql}&maxResults=0`,
    );
    return result.total;
  }

  return {
    testConnection,
    fetchProjects,
    fetchIssuesBatch,
    fetchIssue,
    getIssueCount,
  };
}
