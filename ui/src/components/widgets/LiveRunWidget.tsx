/**
 * LiveRunWidget — Phase 4 dashboard widget surfacing stalled governed-run
 * activity. Reactively listens to `governed_run.stalled` and
 * `governed_run.auto_recovered` events via the global LiveUpdatesProvider
 * and displays a roll-up count + last 5 stall events for the company.
 *
 * Why: per CLAUDE.md "Critical Rules", real-time updates MUST go through
 * SSE/WebSocket. We therefore:
 *   - never poll an "active runs" endpoint
 *   - subscribe to the DOM CustomEvent the LiveUpdatesProvider already
 *     dispatches for governed_run.* events (re-using the existing channel
 *     from useGovernedRunEvents)
 *   - keep an in-memory recent-events ring buffer for display
 *
 * For per-run liveness drill-down, this widget exposes the runId list as
 * links — clicking through routes to the run detail page where the per-run
 * liveness API (governedWorkflowsApi.getRunLiveness) is wired separately.
 *
 * The widget is intentionally minimal: 5 most recent events, no historical
 * fetch. The full audit lives in audit_events / live-events history; this
 * is a dashboard at-a-glance only.
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WidgetProps } from "./types";

interface StalledEntry {
  runId: string;
  companyId: string;
  detectedAt: string;
  recoveryAttempts: number;
  nextActionHint: string | null;
  recovered: boolean;
}

const MAX_ENTRIES = 5;

export default function LiveRunWidget({ companyId }: WidgetProps) {
  const [entries, setEntries] = useState<StalledEntry[]>([]);
  // queryClient kept around so future iterations can prefetch the per-run
  // liveness query when the user hovers an entry.
  void useQueryClient();

  useEffect(() => {
    function onLive(e: Event) {
      const detail = (e as CustomEvent<{
        type: string;
        companyId: string;
        runId?: string;
        payload?: Record<string, unknown>;
      }>).detail;
      if (!detail || detail.companyId !== companyId) return;
      if (detail.type === "governed_run.stalled" && detail.runId) {
        const payload = detail.payload ?? {};
        const entry: StalledEntry = {
          runId: detail.runId,
          companyId: detail.companyId,
          detectedAt:
            typeof payload.detectedAt === "string" ? payload.detectedAt : new Date().toISOString(),
          recoveryAttempts:
            typeof payload.recoveryAttempts === "number" ? payload.recoveryAttempts : 0,
          nextActionHint:
            typeof payload.nextActionHint === "string" ? payload.nextActionHint : null,
          recovered: false,
        };
        setEntries((prev) => {
          const filtered = prev.filter((p) => p.runId !== entry.runId);
          return [entry, ...filtered].slice(0, MAX_ENTRIES);
        });
      }
      if (detail.type === "governed_run.auto_recovered" && detail.runId) {
        setEntries((prev) =>
          prev.map((p) => (p.runId === detail.runId ? { ...p, recovered: true } : p)),
        );
      }
    }
    // LiveUpdatesProvider re-uses the "governed_run:updated" channel for
    // step/gate/cancel/reactivate. For the new liveness events, we register
    // on a dedicated channel to keep the existing useGovernedRunEvents hook
    // (which is run-scoped) untouched. The provider dispatches both — see
    // ui/src/context/LiveUpdatesProvider.tsx.
    window.addEventListener("governed_run:liveness", onLive);
    return () => {
      window.removeEventListener("governed_run:liveness", onLive);
    };
  }, [companyId]);

  return (
    <div className="border border-border rounded-lg p-4 bg-card h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Live Runs
        </h3>
        {entries.length > 0 ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {entries.filter((e) => !e.recovered).length} stalled
          </span>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-md px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">No stalled runs</p>
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            Runs are auto-monitored every 30s
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden flex-1 min-h-0 overflow-y-auto">
          {entries.map((entry) => (
            <a
              key={entry.runId}
              href={`/runs/${entry.runId}`}
              className="block px-2 py-2 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground truncate">
                  {entry.runId.slice(0, 8)}…
                </span>
                <span
                  className={
                    entry.recovered
                      ? "text-[10px] text-emerald-600 dark:text-emerald-400"
                      : "text-[10px] text-amber-600 dark:text-amber-400"
                  }
                >
                  {entry.recovered ? "recovered" : "stalled"}
                </span>
              </div>
              {entry.nextActionHint ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  {entry.nextActionHint}
                </p>
              ) : null}
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                <span>attempts: {entry.recoveryAttempts}</span>
                <span>·</span>
                <span>{new Date(entry.detectedAt).toLocaleTimeString()}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
