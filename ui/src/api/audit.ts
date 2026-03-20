import type { AuditListResult, AuditEvent, AuditVerifyResult } from "@mnm/shared";
import { api } from "./client";

export interface AuditFilters {
  actorId?: string;
  actorType?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const auditApi = {
  list: (companyId: string, filters: AuditFilters = {}) =>
    api.get<AuditListResult>(`/companies/${companyId}/audit${buildQuery(filters)}`),

  count: (companyId: string, filters: Omit<AuditFilters, "limit" | "offset" | "sortOrder"> = {}) =>
    api.get<{ count: number }>(`/companies/${companyId}/audit/count${buildQuery(filters)}`),

  getById: (companyId: string, eventId: string) =>
    api.get<AuditEvent>(`/companies/${companyId}/audit/${eventId}`),

  verify: (companyId: string, dateFrom?: string, dateTo?: string) => {
    const params: Record<string, string | undefined> = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return api.get<AuditVerifyResult>(`/companies/${companyId}/audit/verify${buildQuery(params)}`);
  },

  exportCsv: async (companyId: string, filters: Omit<AuditFilters, "limit" | "offset" | "sortOrder"> = {}) => {
    const qs = buildQuery(filters);
    const res = await fetch(`/api/companies/${companyId}/audit/export/csv${qs}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${companyId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportJson: async (companyId: string, filters: Omit<AuditFilters, "limit" | "offset" | "sortOrder"> = {}) => {
    const qs = buildQuery(filters);
    const res = await fetch(`/api/companies/${companyId}/audit/export/json${qs}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${companyId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
