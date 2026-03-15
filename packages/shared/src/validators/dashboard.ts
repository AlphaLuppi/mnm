import { z } from "zod";
import { DASHBOARD_PERIODS, DASHBOARD_BREAKDOWN_CATEGORIES } from "../types/dashboard.js";

// DASH-S01: Dashboard validators

export const dashboardTimelineFiltersSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default("7d"),
});

export type DashboardTimelineFilters = z.infer<typeof dashboardTimelineFiltersSchema>;

export const dashboardBreakdownCategorySchema = z.enum(DASHBOARD_BREAKDOWN_CATEGORIES);

export type DashboardBreakdownCategoryInput = z.infer<typeof dashboardBreakdownCategorySchema>;
