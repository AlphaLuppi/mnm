import type {
  Agent,
  AdapterEnvironmentTestResult,
  AgentKeyCreated,
  AgentRuntimeState,
  AgentTaskSession,
  HeartbeatRun,
  Approval,
  AgentConfigRevision,
} from "@mnm/shared";
import { isUuidLike, normalizeAgentUrlKey } from "@mnm/shared";
import { ApiError, api } from "./client";

export interface AgentKey {
  id: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AdapterModel {
  id: string;
  label: string;
}

export interface ClaudeLoginResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  loginUrl: string | null;
  stdout: string;
  stderr: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export interface AgentHireResponse {
  agent: Agent;
  approval: Approval | null;
}

/** Build the path for a company-scoped agent endpoint */
function agentPath(companyId: string, id: string, suffix = "") {
  return `/companies/${companyId}/agents/${encodeURIComponent(id)}${suffix}`;
}

export const agentsApi = {
  list: (companyId: string, opts?: { workspaceId?: string; includeScoped?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.workspaceId) params.set("workspaceId", opts.workspaceId);
    else if (opts?.includeScoped) params.set("includeScoped", "true");
    const query = params.toString();
    return api.get<Agent[]>(`/companies/${companyId}/agents${query ? `?${query}` : ""}`);
  },
  org: (companyId: string) => api.get<OrgNode[]>(`/companies/${companyId}/org`),
  listConfigurations: (companyId: string) =>
    api.get<Record<string, unknown>[]>(`/companies/${companyId}/agent-configurations`),
  get: async (companyId: string, id: string) => {
    try {
      return await api.get<Agent>(agentPath(companyId, id));
    } catch (error) {
      // Backward-compat fallback: if backend shortname lookup reports ambiguity,
      // resolve using company agent list while ignoring terminated agents.
      if (
        !(error instanceof ApiError) ||
        error.status !== 409 ||
        isUuidLike(id)
      ) {
        throw error;
      }

      const urlKey = normalizeAgentUrlKey(id);
      if (!urlKey) throw error;

      const agents = await api.get<Agent[]>(`/companies/${companyId}/agents`);
      const matches = agents.filter(
        (agent) => agent.status !== "terminated" && normalizeAgentUrlKey(agent.urlKey) === urlKey,
      );
      if (matches.length !== 1) throw error;
      return api.get<Agent>(agentPath(companyId, matches[0]!.id));
    }
  },
  getConfiguration: (companyId: string, id: string) =>
    api.get<Record<string, unknown>>(agentPath(companyId, id, "/configuration")),
  listConfigRevisions: (companyId: string, id: string) =>
    api.get<AgentConfigRevision[]>(agentPath(companyId, id, "/config-revisions")),
  getConfigRevision: (companyId: string, id: string, revisionId: string) =>
    api.get<AgentConfigRevision>(agentPath(companyId, id, `/config-revisions/${revisionId}`)),
  rollbackConfigRevision: (companyId: string, id: string, revisionId: string) =>
    api.post<Agent>(agentPath(companyId, id, `/config-revisions/${revisionId}/rollback`), {}),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Agent>(`/companies/${companyId}/agents`, data),
  hire: (companyId: string, data: Record<string, unknown>) =>
    api.post<AgentHireResponse>(`/companies/${companyId}/agent-hires`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) =>
    api.patch<Agent>(agentPath(companyId, id), data),
  updatePermissions: (companyId: string, id: string, data: { canCreateAgents?: boolean; permissionSlugs?: string[] }) =>
    api.patch<Agent>(agentPath(companyId, id, "/permissions"), data),
  getDirectPermissions: (companyId: string, id: string) =>
    api.get<{ permissionSlugs: string[] }>(agentPath(companyId, id, "/direct-permissions")),
  pause: (companyId: string, id: string) => api.post<Agent>(agentPath(companyId, id, "/pause"), {}),
  resume: (companyId: string, id: string) => api.post<Agent>(agentPath(companyId, id, "/resume"), {}),
  terminate: (companyId: string, id: string) => api.post<Agent>(agentPath(companyId, id, "/terminate"), {}),
  remove: (companyId: string, id: string) => api.delete<{ ok: true }>(agentPath(companyId, id)),
  listKeys: (companyId: string, id: string) => api.get<AgentKey[]>(agentPath(companyId, id, "/keys")),
  createKey: (companyId: string, id: string, name: string) =>
    api.post<AgentKeyCreated>(agentPath(companyId, id, "/keys"), { name }),
  revokeKey: (companyId: string, agentId: string, keyId: string) =>
    api.delete<{ ok: true }>(agentPath(companyId, agentId, `/keys/${encodeURIComponent(keyId)}`)),
  runtimeState: (companyId: string, id: string) =>
    api.get<AgentRuntimeState>(agentPath(companyId, id, "/runtime-state")),
  taskSessions: (companyId: string, id: string) =>
    api.get<AgentTaskSession[]>(agentPath(companyId, id, "/task-sessions")),
  resetSession: (companyId: string, id: string, taskKey?: string | null) =>
    api.post<void>(agentPath(companyId, id, "/runtime-state/reset-session"), { taskKey: taskKey ?? null }),
  adapterModels: (companyId: string, type: string) =>
    api.get<AdapterModel[]>(
      `/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/models`,
    ),
  testEnvironment: (
    companyId: string,
    type: string,
    data: { adapterConfig: Record<string, unknown> },
  ) =>
    api.post<AdapterEnvironmentTestResult>(
      `/companies/${companyId}/adapters/${type}/test-environment`,
      data,
    ),
  invoke: (companyId: string, id: string) => api.post<HeartbeatRun>(agentPath(companyId, id, "/heartbeat/invoke"), {}),
  wakeup: (
    companyId: string,
    id: string,
    data: {
      source?: "timer" | "assignment" | "on_demand" | "automation";
      triggerDetail?: "manual" | "ping" | "callback" | "system";
      reason?: string | null;
      payload?: Record<string, unknown> | null;
      idempotencyKey?: string | null;
    },
  ) => api.post<HeartbeatRun | { status: "skipped" }>(agentPath(companyId, id, "/wakeup"), data),
  loginWithClaude: (companyId: string, id: string) =>
    api.post<ClaudeLoginResult>(agentPath(companyId, id, "/claude-login"), {}),
};
