/**
 * PAPERCLIP-PHASE2 — Inbox Interactive
 *
 * Hook returning the live list of `thread_interactions` for an issue and
 * mutation handlers (accept / reject / respond). Listens to the
 * `thread_interaction:*` DOM events the LiveUpdatesProvider dispatches
 * when one of the matching SSE events arrives, so the list refreshes
 * without polling (project rule).
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AcceptThreadInteraction,
  RejectThreadInteraction,
  RespondThreadInteraction,
} from "@mnm/shared";
import { threadInteractionsApi } from "../api/thread-interactions";

const THREAD_INTERACTION_EVENT = "thread_interaction:updated";

const queryKey = (companyId: string, issueId: string) =>
  ["thread-interactions", companyId, issueId] as const;

export function useThreadInteractions({
  companyId,
  issueId,
  enabled = true,
}: {
  companyId: string;
  issueId: string;
  enabled?: boolean;
}) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(companyId, issueId),
    queryFn: () => threadInteractionsApi.list(companyId, issueId),
    enabled,
    staleTime: 5_000,
  });

  // Live updates — no polling. LiveUpdatesProvider re-dispatches the
  // SSE event as a DOM CustomEvent so this hook stays unit-testable
  // without instantiating a WebSocket. See server/src/services/
  // thread-interactions.ts emit() for the source-of-truth event names.
  useEffect(() => {
    if (!enabled) return;
    function onUpdate(e: Event) {
      const detail = (e as CustomEvent<{ companyId: string; issueId: string }>).detail;
      if (detail.companyId !== companyId || detail.issueId !== issueId) return;
      qc.invalidateQueries({ queryKey: queryKey(companyId, issueId) });
    }
    window.addEventListener(THREAD_INTERACTION_EVENT, onUpdate);
    return () => window.removeEventListener(THREAD_INTERACTION_EVENT, onUpdate);
  }, [companyId, issueId, enabled, qc]);

  const accept = useMutation({
    mutationFn: (vars: { interactionId: string; body?: AcceptThreadInteraction }) =>
      threadInteractionsApi.accept(companyId, issueId, vars.interactionId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(companyId, issueId) }),
  });

  const reject = useMutation({
    mutationFn: (vars: { interactionId: string; body?: RejectThreadInteraction }) =>
      threadInteractionsApi.reject(companyId, issueId, vars.interactionId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(companyId, issueId) }),
  });

  const respond = useMutation({
    mutationFn: (vars: { interactionId: string; body: RespondThreadInteraction }) =>
      threadInteractionsApi.respond(companyId, issueId, vars.interactionId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(companyId, issueId) }),
  });

  return {
    interactions: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
    accept: accept.mutate,
    reject: reject.mutate,
    respond: respond.mutate,
    isAccepting: accept.isPending,
    isRejecting: reject.isPending,
    isResponding: respond.isPending,
  };
}
