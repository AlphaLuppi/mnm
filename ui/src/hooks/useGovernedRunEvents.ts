/**
 * useGovernedRunEvents
 *
 * Subscribes to live events for a specific governed workflow run and
 * invalidates the runDetail query whenever a step or gate transitions.
 *
 * Real-time delivery relies on the global `LiveUpdatesProvider` WebSocket
 * connection. The provider already handles `governed_run.step_updated` and
 * `governed_run.gate_evaluated` events by calling:
 *
 *   queryClient.invalidateQueries({ queryKey: queryKeys.governedWorkflows.runDetail(companyId, runId) })
 *
 * This hook provides the per-component subscription point — callers mount it
 * in the RunDetail page so intent is explicit and the lifecycle is tied to the
 * component. No additional WS connection is opened; the provider's connection
 * is reused.
 *
 * Invariant: the event channel on the server side is
 *   company:<companyId>:governed-runs:<runId>
 * but the client uses company-scoped WS (the server routes events by
 * companyId + type). The runId filter is applied at the payload level in
 * LiveUpdatesProvider.handleLiveEvent.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys.js";

export function useGovernedRunEvents({
  companyId,
  runId,
}: {
  companyId: string;
  runId: string;
}): void {
  const qc = useQueryClient();

  // Register a DOM-level listener for the governed-run custom event dispatched
  // by LiveUpdatesProvider so this hook remains unit-testable without a real
  // WebSocket. LiveUpdatesProvider dispatches "governed_run:updated" when it
  // receives a governed_run.* SSE event for this company.
  useEffect(() => {
    function onUpdate(e: Event) {
      const detail = (e as CustomEvent<{ companyId: string; runId: string }>).detail;
      if (detail.companyId !== companyId || detail.runId !== runId) return;
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.runDetail(companyId, runId),
      });
    }

    window.addEventListener("governed_run:updated", onUpdate);
    return () => {
      window.removeEventListener("governed_run:updated", onUpdate);
    };
  }, [companyId, runId, qc]);
}
