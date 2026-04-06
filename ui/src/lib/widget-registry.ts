import { lazy, type ComponentType } from "react";
import type { WidgetProps } from "../components/widgets/types";

export interface WidgetDef {
  component: React.LazyExoticComponent<ComponentType<WidgetProps>>;
  defaultSpan: 1 | 2 | 3 | 4;
  label: string;
  description?: string;
  /** Min/max constraints in 12-column grid units */
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

// Lazy import for each widget — only the widgets in the active preset are loaded
const placeholder = (label: string) =>
  lazy(() => import("../components/widgets/PlaceholderWidget").then((m) => ({
    default: (props: WidgetProps) => m.default({ ...props, props: { ...props.props, label } }),
  }))) as React.LazyExoticComponent<ComponentType<WidgetProps>>;

export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  // KPIs — full-width bar
  "kpi-bar":          { component: lazy(() => import("../components/widgets/KpiBar")),               defaultSpan: 4, label: "KPI Bar",             description: "Full-width KPI overview",          minW: 12, maxW: 12, minH: 1, maxH: 2 },

  // Charts — compact metric widgets
  "run-activity":     { component: lazy(() => import("../components/widgets/RunActivityWidget")),     defaultSpan: 1, label: "Run Activity",        description: "Recent run timeline",              minW: 3, maxW: 12, minH: 2, maxH: 4 },
  "priority-chart":   { component: lazy(() => import("../components/widgets/PriorityWidget")),        defaultSpan: 1, label: "Issues by Priority",  description: "Priority distribution chart",      minW: 3, maxW: 12, minH: 2, maxH: 4 },
  "status-chart":     { component: lazy(() => import("../components/widgets/StatusWidget")),          defaultSpan: 1, label: "Issues by Status",    description: "Status distribution chart",        minW: 3, maxW: 12, minH: 2, maxH: 4 },
  "success-rate":     { component: lazy(() => import("../components/widgets/SuccessRateWidget")),     defaultSpan: 1, label: "Success Rate",        description: "Agent success rate trends",        minW: 3, maxW: 12, minH: 2, maxH: 4 },

  // Panels — tables and lists
  "active-agents":    { component: lazy(() => import("../components/widgets/ActiveAgentsWidget")),    defaultSpan: 2, label: "Active Agents",       description: "Currently running agents",         minW: 6, maxW: 12, minH: 2, maxH: 6 },
  "recent-issues":    { component: lazy(() => import("../components/widgets/RecentIssuesWidget")),    defaultSpan: 2, label: "Recent Issues",       description: "Latest issues across agents",      minW: 6, maxW: 12, minH: 2, maxH: 6 },
  "recent-activity":  { component: lazy(() => import("../components/widgets/RecentActivityWidget")),  defaultSpan: 2, label: "Recent Activity",     description: "Latest activity feed",             minW: 6, maxW: 12, minH: 2, maxH: 6 },

  // Enterprise
  "kpi-enterprise":   { component: lazy(() => import("../components/widgets/KpiEnterpriseWidget")),   defaultSpan: 4, label: "Enterprise KPIs",     description: "Enterprise-level KPI overview",    minW: 12, maxW: 12, minH: 1, maxH: 2 },
  "timeline":         { component: lazy(() => import("../components/widgets/TimelineWidget")),        defaultSpan: 2, label: "Timeline",            description: "Activity timeline visualization",  minW: 6, maxW: 12, minH: 2, maxH: 6 },
  "breakdown":        { component: lazy(() => import("../components/widgets/BreakdownWidget")),       defaultSpan: 2, label: "Breakdown",           description: "Category breakdown analysis",      minW: 6, maxW: 12, minH: 2, maxH: 6 },

  // Persona-specific (placeholders for now)
  "chat-activity":    { component: placeholder("Chat Activity"),       defaultSpan: 2, label: "Chat Activity",      description: "Chat message activity",            minW: 3, maxW: 12, minH: 2, maxH: 4 },
  "my-folders":       { component: placeholder("My Folders"),          defaultSpan: 2, label: "My Folders",         description: "Your document folders",            minW: 3, maxW: 12, minH: 2, maxH: 4 },
  "my-issues":        { component: placeholder("My Issues"),           defaultSpan: 2, label: "My Issues",          description: "Issues assigned to you",           minW: 6, maxW: 12, minH: 2, maxH: 6 },
  "team-activity":    { component: placeholder("Team Activity"),       defaultSpan: 2, label: "Team Activity",      description: "Team-wide activity feed",          minW: 6, maxW: 12, minH: 2, maxH: 6 },
  "cost-overview":    { component: placeholder("Cost Overview"),       defaultSpan: 2, label: "Cost Overview",      description: "Agent cost breakdown",             minW: 3, maxW: 12, minH: 2, maxH: 4 },
  "health-summary":   { component: placeholder("Health Summary"),      defaultSpan: 2, label: "Health Summary",     description: "System health overview",           minW: 3, maxW: 12, minH: 2, maxH: 4 },
};
