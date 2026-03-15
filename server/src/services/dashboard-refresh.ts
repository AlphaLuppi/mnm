import type { LiveEvent, LiveEventType } from "@mnm/shared";
import { publishLiveEvent, subscribeAllLiveEvents } from "./live-events.js";

/**
 * DASH-S03: Dashboard refresh emitter service.
 *
 * Subscribes to all live events globally and, when a dashboard-relevant event
 * is detected (workflow, agent, audit, container, drift, heartbeat), emits a
 * debounced `dashboard.refresh` event so that connected dashboard clients can
 * invalidate their React Query caches.
 *
 * The debounce is per-company — at most one `dashboard.refresh` is emitted per
 * company per DEBOUNCE_MS window.
 */

const DEBOUNCE_MS = 1_000;

/** Maps companyId -> last emission timestamp. */
const lastEmitByCompany = new Map<string, number>();

/** Maps companyId -> pending debounce timer. */
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Event types that should trigger a dashboard.refresh. */
const DASHBOARD_TRIGGER_EVENTS: ReadonlySet<LiveEventType> = new Set<LiveEventType>([
  // Workflow lifecycle
  "workflow.created",
  "workflow.completed",
  "workflow.updated",
  "workflow.deleted",
  "workflow.failed",
  // Agent status changes
  "agent.status",
  // Audit events
  "audit.event_created",
  // Container lifecycle
  "container.created",
  "container.started",
  "container.completed",
  "container.failed",
  "container.stopped",
  // Drift alerts
  "drift.alert_created",
  "drift.alert_resolved",
  // Run status changes (affects KPIs)
  "heartbeat.run.status",
]);

function sourceFromEventType(type: LiveEventType): string {
  if (type.startsWith("workflow.")) return "workflow";
  if (type.startsWith("agent.")) return "agent";
  if (type.startsWith("audit.")) return "audit";
  if (type.startsWith("container.")) return "container";
  if (type.startsWith("drift.")) return "drift";
  if (type.startsWith("heartbeat.")) return "heartbeat";
  return "unknown";
}

function emitDashboardRefresh(companyId: string, source: string) {
  lastEmitByCompany.set(companyId, Date.now());
  pendingTimers.delete(companyId);
  publishLiveEvent({
    companyId,
    type: "dashboard.refresh",
    payload: { source },
  });
}

function handleTriggerEvent(event: LiveEvent) {
  if (!DASHBOARD_TRIGGER_EVENTS.has(event.type)) return;
  // Avoid infinite loop: don't react to our own dashboard.refresh events
  if (event.type === ("dashboard.refresh" as LiveEventType)) return;

  const companyId = event.companyId;
  const source = sourceFromEventType(event.type);
  const now = Date.now();
  const lastEmit = lastEmitByCompany.get(companyId) ?? 0;

  // If enough time has passed since the last emission, emit immediately.
  if (now - lastEmit >= DEBOUNCE_MS) {
    emitDashboardRefresh(companyId, source);
    return;
  }

  // Otherwise, schedule a debounced emission if one isn't already pending.
  if (!pendingTimers.has(companyId)) {
    const remainingMs = DEBOUNCE_MS - (now - lastEmit);
    const timer = setTimeout(() => {
      emitDashboardRefresh(companyId, source);
    }, remainingMs);
    pendingTimers.set(companyId, timer);
  }
}

/**
 * Initializes the dashboard refresh emitter. Call once at server boot.
 * Returns an unsubscribe function for cleanup (useful in tests).
 */
export function subscribeDashboardRefreshEvents(): () => void {
  const unsubscribe = subscribeAllLiveEvents(handleTriggerEvent);
  return () => {
    unsubscribe();
    // Clean up all pending timers
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer);
    }
    pendingTimers.clear();
    lastEmitByCompany.clear();
  };
}

export const DASHBOARD_REFRESH_DEBOUNCE_MS = DEBOUNCE_MS;
