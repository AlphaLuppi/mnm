import type { DriftReport, DriftCheckRequest, DriftResolveRequest, DriftItem, DriftScanRequest, DriftScanStatus } from "@mnm/shared";
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
  getResults: (projectId: string, companyId?: string) =>
    api.get<DriftReport[]>(
      withCompanyScope(`${projectDriftPath(projectId)}/results`, companyId),
    ),
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
