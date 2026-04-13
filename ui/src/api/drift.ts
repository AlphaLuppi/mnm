import type { DriftReport, DriftCheckRequest, DriftResolveRequest, DriftItem, DriftScanRequest, DriftScanStatus, DriftItemFilters, DriftAlert, DriftMonitorStatus, DriftMonitorConfig } from "@mnm/shared";
import { api } from "./client";

export const driftApi = {
  check: (companyId: string, projectId: string, body: DriftCheckRequest) =>
    api.post<DriftReport>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/drift/check`,
      body,
    ),
  getResults: (companyId: string, projectId: string, options?: { limit?: number; offset?: number; status?: string }) => {
    let url = `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/drift/results`;
    const params = new URLSearchParams();
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.offset != null) params.set("offset", String(options.offset));
    if (options?.status) params.set("status", options.status);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return api.get<{ data: DriftReport[]; total: number }>(url);
  },
  resolve: (companyId: string, projectId: string, driftId: string, body: DriftResolveRequest) =>
    api.patch<DriftItem>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/drift/${encodeURIComponent(driftId)}`,
      body,
    ),
  scan: (companyId: string, projectId: string, body: DriftScanRequest) =>
    api.post<{ started: boolean; status: DriftScanStatus }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/drift/scan`,
      body,
    ),
  getStatus: (companyId: string, projectId: string) =>
    api.get<DriftScanStatus>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/drift/status`,
    ),
  cancelScan: (companyId: string, projectId: string) =>
    api.delete<{ cancelled: boolean }>(
      `/companies/${companyId}/projects/${encodeURIComponent(projectId)}/drift/scan`,
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
