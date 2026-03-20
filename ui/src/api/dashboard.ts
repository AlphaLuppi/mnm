// dash-s02-api-client
import type {
  DashboardSummary,
  DashboardKpis,
  DashboardTimeline,
  DashboardBreakdown,
  DashboardPeriod,
  DashboardBreakdownCategory,
} from "@mnm/shared";
import { api } from "./client";

export const dashboardApi = {
  // Legacy summary — backward compatible
  summary: (companyId: string) =>
    api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),

  // DASH-S02: Enriched dashboard endpoints
  kpis: (companyId: string) =>
    api.get<DashboardKpis>(`/companies/${companyId}/dashboard/kpis`),

  timeline: (companyId: string, period: DashboardPeriod) =>
    api.get<DashboardTimeline>(
      `/companies/${companyId}/dashboard/timeline?period=${period}`,
    ),

  breakdown: (companyId: string, category: DashboardBreakdownCategory) =>
    api.get<DashboardBreakdown>(
      `/companies/${companyId}/dashboard/breakdown/${category}`,
    ),
};
