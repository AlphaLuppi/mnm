export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  staleTasks: number;
}

// DASH-S01: Dashboard API types

export const DASHBOARD_PERIODS = ["7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_BREAKDOWN_CATEGORIES = [
  "agents",
  "workflows",
  "audit",
  "costs",
  "containers",
] as const;
export type DashboardBreakdownCategory = (typeof DASHBOARD_BREAKDOWN_CATEGORIES)[number];

export const K_ANONYMITY_THRESHOLD = 5;

export interface DashboardKpis {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
    total: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
    total: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  workflows: {
    active: number;
    completed: number;
    failed: number;
    paused: number;
    total: number;
  };
  audit: {
    eventsToday: number;
    eventsWeek: number;
    eventsMonth: number;
  };
  containers: {
    running: number;
    stopped: number;
    total: number;
  };
  drift: {
    openAlerts: number;
  };
  pendingApprovals: number;
  staleTasks: number;
}

export interface DashboardTimelinePoint {
  date: string;
  agentsActive: number;
  tasksCompleted: number;
  auditEvents: number;
  costCents: number;
}

export interface DashboardTimeline {
  period: DashboardPeriod;
  points: DashboardTimelinePoint[];
}

export interface DashboardBreakdownItem {
  label: string;
  count: number;
}

export interface DashboardBreakdown {
  category: DashboardBreakdownCategory;
  items: DashboardBreakdownItem[];
  total: number;
}
