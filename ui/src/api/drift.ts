import type { DriftReport, DriftCheckRequest, DriftResolveRequest, DriftItem } from "@mnm/shared";
import { api } from "./client";

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export const driftApi = {
  check: (projectId: string, body: DriftCheckRequest, companyId?: string) =>
    api.post<DriftReport>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/drift/check`, companyId),
      body,
    ),
  getResults: (projectId: string, companyId?: string) =>
    api.get<DriftReport[]>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/drift/results`, companyId),
    ),
  resolve: (projectId: string, driftId: string, body: DriftResolveRequest, companyId?: string) =>
    api.patch<DriftItem>(
      withCompanyScope(
        `/projects/${encodeURIComponent(projectId)}/drift/${encodeURIComponent(driftId)}`,
        companyId,
      ),
      body,
    ),
};
