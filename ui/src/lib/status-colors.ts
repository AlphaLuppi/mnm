/**
 * Canonical status & priority color definitions.
 *
 * Every component that renders a status indicator (StatusIcon, StatusBadge,
 * agent status dots, etc.) should import from here so colors stay consistent.
 */

// ---------------------------------------------------------------------------
// Issue status colors
// ---------------------------------------------------------------------------

/** StatusIcon circle: text + border classes */
export const issueStatusIcon: Record<string, string> = {
  backlog: "text-muted-foreground border-muted-foreground",
  todo: "text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400",
  in_progress: "text-yellow-600 border-yellow-600 dark:text-yellow-400 dark:border-yellow-400",
  in_review: "text-violet-600 border-violet-600 dark:text-violet-400 dark:border-violet-400",
  done: "text-green-600 border-green-600 dark:text-green-400 dark:border-green-400",
  cancelled: "text-neutral-500 border-neutral-500",
  blocked: "text-red-600 border-red-600 dark:text-red-400 dark:border-red-400",
};

export const issueStatusIconDefault = "text-muted-foreground border-muted-foreground";

/** Text-only color for issue statuses (dropdowns, labels) */
export const issueStatusText: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-600 dark:text-blue-400",
  in_progress: "text-yellow-600 dark:text-yellow-400",
  in_review: "text-violet-600 dark:text-violet-400",
  done: "text-green-600 dark:text-green-400",
  cancelled: "text-neutral-500",
  blocked: "text-red-600 dark:text-red-400",
};

export const issueStatusTextDefault = "text-muted-foreground";

// ---------------------------------------------------------------------------
// Badge colors — used by StatusBadge for all entity types
// ---------------------------------------------------------------------------

export const statusBadge: Record<string, string> = {
  // Agent statuses
  active: "bg-success-bg text-success",
  running: "bg-agent-bg text-agent",
  paused: "bg-warning-bg text-warning",
  idle: "bg-warning-bg text-warning",
  archived: "bg-muted text-muted-foreground",

  // Goal statuses
  planned: "bg-muted text-muted-foreground",
  achieved: "bg-success-bg text-success",
  completed: "bg-success-bg text-success",

  // Run statuses
  failed: "bg-error-bg text-error",
  interrupted: "bg-warning-bg text-warning",
  timed_out: "bg-warning-bg text-warning",
  succeeded: "bg-success-bg text-success",
  error: "bg-error-bg text-error",
  terminated: "bg-error-bg text-error",
  pending: "bg-warning-bg text-warning",

  // Approval statuses
  pending_approval: "bg-warning-bg text-warning",
  revision_requested: "bg-warning-bg text-warning",
  approved: "bg-success-bg text-success",
  rejected: "bg-error-bg text-error",

  // Issue statuses — consistent hues with issueStatusIcon above
  backlog: "bg-muted text-muted-foreground",
  todo: "bg-info-bg text-info",
  in_progress: "bg-warning-bg text-warning",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  blocked: "bg-error-bg text-error",
  done: "bg-success-bg text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export const statusBadgeDefault = "bg-muted text-muted-foreground";

// ---------------------------------------------------------------------------
// Agent status dot — solid background for small indicator dots
// ---------------------------------------------------------------------------

export const agentStatusDot: Record<string, string> = {
  running: "bg-cyan-400 animate-pulse",
  active: "bg-green-400",
  paused: "bg-yellow-400",
  idle: "bg-yellow-400",
  pending_approval: "bg-amber-400",
  error: "bg-red-400",
  archived: "bg-neutral-400",
};

export const agentStatusDotDefault = "bg-neutral-400";

// ---------------------------------------------------------------------------
// Priority colors
// ---------------------------------------------------------------------------

export const priorityColor: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
};

export const priorityColorDefault = "text-yellow-600 dark:text-yellow-400";
