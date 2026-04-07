import { lazy, type ComponentType } from "react";
import type { WidgetProps } from "../components/widgets/types";

export interface WidgetDef {
  component: React.LazyExoticComponent<ComponentType<WidgetProps>>;
  /** Default width in 12-column grid units */
  defaultW: number;
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
  "kpi-bar":          { component: lazy(() => import("../components/widgets/KpiBar")),               defaultW: 12, label: "KPI Bar",             description: "Full-width KPI overview",          minW: 6, maxW: 12, minH: 2, maxH: 6 },

  // Charts — compact metric widgets
  "run-activity":     { component: lazy(() => import("../components/widgets/RunActivityWidget")),     defaultW: 4, label: "Run Activity",        description: "Recent run timeline",              minW: 2, maxW: 12, minH: 5, maxH: 16 },
  "priority-chart":   { component: lazy(() => import("../components/widgets/PriorityWidget")),        defaultW: 4, label: "Issues by Priority",  description: "Priority distribution chart",      minW: 2, maxW: 12, minH: 5, maxH: 16 },
  "status-chart":     { component: lazy(() => import("../components/widgets/StatusWidget")),          defaultW: 4, label: "Issues by Status",    description: "Status distribution chart",        minW: 2, maxW: 12, minH: 5, maxH: 16 },
  "success-rate":     { component: lazy(() => import("../components/widgets/SuccessRateWidget")),     defaultW: 4, label: "Success Rate",        description: "Agent success rate trends",        minW: 2, maxW: 12, minH: 5, maxH: 16 },

  // Panels — tables and lists
  "active-agents":    { component: lazy(() => import("../components/widgets/ActiveAgentsWidget")),    defaultW: 6, label: "Active Agents",       description: "Currently running agents",         minW: 3, maxW: 12, minH: 4, maxH: 16 },
  "recent-issues":    { component: lazy(() => import("../components/widgets/RecentIssuesWidget")),    defaultW: 6, label: "Recent Issues",       description: "Latest issues across agents",      minW: 3, maxW: 12, minH: 4, maxH: 16 },
  "recent-activity":  { component: lazy(() => import("../components/widgets/RecentActivityWidget")),  defaultW: 6, label: "Recent Activity",     description: "Latest activity feed",             minW: 3, maxW: 12, minH: 4, maxH: 16 },

  // Enterprise
  "kpi-enterprise":   { component: lazy(() => import("../components/widgets/KpiEnterpriseWidget")),   defaultW: 12, label: "Enterprise KPIs",     description: "Enterprise-level KPI overview",    minW: 6, maxW: 12, minH: 2, maxH: 6 },
  "timeline":         { component: lazy(() => import("../components/widgets/TimelineWidget")),        defaultW: 6, label: "Timeline",            description: "Activity timeline visualization",  minW: 3, maxW: 12, minH: 4, maxH: 16 },
  "breakdown":        { component: lazy(() => import("../components/widgets/BreakdownWidget")),       defaultW: 6, label: "Breakdown",           description: "Category breakdown analysis",      minW: 3, maxW: 12, minH: 4, maxH: 16 },

  // Persona-specific (placeholders for now)
  "chat-activity":    { component: placeholder("Chat Activity"),       defaultW: 6, label: "Chat Activity",      description: "Chat message activity",            minW: 2, maxW: 12, minH: 3, maxH: 16 },
  "my-folders":       { component: placeholder("My Folders"),          defaultW: 6, label: "My Folders",         description: "Your document folders",            minW: 2, maxW: 12, minH: 3, maxH: 16 },
  "my-issues":        { component: placeholder("My Issues"),           defaultW: 6, label: "My Issues",          description: "Issues assigned to you",           minW: 3, maxW: 12, minH: 4, maxH: 16 },
  "team-activity":    { component: placeholder("Team Activity"),       defaultW: 6, label: "Team Activity",      description: "Team-wide activity feed",          minW: 3, maxW: 12, minH: 4, maxH: 16 },
  "cost-overview":    { component: placeholder("Cost Overview"),       defaultW: 6, label: "Cost Overview",      description: "Agent cost breakdown",             minW: 2, maxW: 12, minH: 3, maxH: 16 },
  "health-summary":   { component: placeholder("Health Summary"),      defaultW: 6, label: "Health Summary",     description: "System health overview",           minW: 2, maxW: 12, minH: 3, maxH: 16 },
};
