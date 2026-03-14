import type { DriftReport, DriftCheckRequest, DriftResolveRequest, DriftItem, DriftScanRequest, DriftScanStatus, DriftItemFilters, DriftAlert, DriftMonitorStatus, DriftMonitorConfig } from "@mnm/shared";
import { api } from "./client";

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

function projectDriftPath(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}/drift`;
}

export const driftApi = {
  check: (projectId: string, body: DriftCheckRequest, companyId?: string) =>
    api.post<DriftReport>(
      withCompanyScope(`${projectDriftPath(projectId)}/check`, companyId),
      body,
    ),
  getResults: (projectId: string, companyId?: string, options?: { limit?: number; offset?: number; status?: string }) => {
    let url = `${projectDriftPath(projectId)}/results`;
    const params = new URLSearchParams();
    if (companyId) params.set("companyId", companyId);
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.offset != null) params.set("offset", String(options.offset));
    if (options?.status) params.set("status", options.status);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return api.get<{ data: DriftReport[]; total: number }>(url);
  },
  resolve: (projectId: string, driftId: string, body: DriftResolveRequest, companyId?: string) =>
    api.patch<DriftItem>(
      withCompanyScope(
        `${projectDriftPath(projectId)}/${encodeURIComponent(driftId)}`,
        companyId,
      ),
      body,
    ),
  scan: (projectId: string, body: DriftScanRequest, companyId?: string) =>
    api.post<{ started: boolean; status: DriftScanStatus }>(
      withCompanyScope(`${projectDriftPath(projectId)}/scan`, companyId),
      body,
    ),
  getStatus: (projectId: string, companyId?: string) =>
    api.get<DriftScanStatus>(
      withCompanyScope(`${projectDriftPath(projectId)}/status`, companyId),
    ),
  cancelScan: (projectId: string, companyId?: string) =>
    api.delete<{ cancelled: boolean }>(
      withCompanyScope(`${projectDriftPath(projectId)}/scan`, companyId),
    ),
};

// DRIFT-S03: Execution drift alerts API

function companyDriftPath(companyId: string) {
  return `/companies/${encodeURIComponent(companyId)}/drift`;
}

export const driftAlertsApi = {
  listAlerts: (companyId: string, filters?: {
    severity?: string;
    limit?: number;
    offset?: number;
  }) => {
    let url = `${companyDriftPath(companyId)}/alerts`;
    const params = new URLSearchParams();
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.limit != null) params.set("limit", String(filters.limit));
    if (filters?.offset != null) params.set("offset", String(filters.offset));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return api.get<{ data: DriftAlert[]; total: number }>(url);
  },

  resolveAlert: (companyId: string, alertId: string, body: {
    resolution: "acknowledged" | "ignored" | "remediated";
    note?: string;
  }) =>
    api.post<DriftAlert>(
      `${companyDriftPath(companyId)}/alerts/${encodeURIComponent(alertId)}/resolve`,
      body,
    ),

  getMonitoringStatus: (companyId: string) =>
    api.get<DriftMonitorStatus>(
      `${companyDriftPath(companyId)}/monitoring/status`,
    ),

  startMonitoring: (companyId: string, config?: Partial<DriftMonitorConfig>) =>
    api.post<DriftMonitorStatus>(
      `${companyDriftPath(companyId)}/monitoring/start`,
      config ? { config } : {},
    ),

  stopMonitoring: (companyId: string) =>
    api.post<DriftMonitorStatus>(
      `${companyDriftPath(companyId)}/monitoring/stop`,
      {},
    ),
};
