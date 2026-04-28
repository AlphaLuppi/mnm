/**
 * useWorkflowRunActions — TanStack mutation hooks for cancelling and
 * reactivating governed workflow runs.
 *
 * Backed by:
 *   POST /api/companies/:companyId/governed-workflows/runs/:runId/cancel
 *   POST /api/companies/:companyId/governed-workflows/runs/:runId/reactivate
 *
 * Server contract (see `server/src/routes/governed-workflows-ui.ts`):
 *  - Errors come back as `{ isError: true, error_code, message, hints }` —
 *    surfaced by `ApiError.body.error_code` after `api.post` rejects.
 *  - Cancel requires a `{ reason: string (>=5 chars) }` body.
 *  - Reactivate takes an empty body.
 *
 * Cache invalidation:
 *  - Specific runDetail key (so the run page refetches immediately).
 *  - All `governedWorkflows.runs(companyId, ...)` list keys for this company
 *    via predicate, since the hook does not know the parent workflow `name`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";

interface CancelRunResponse {
  runId: string;
  cancelledAt: string;
  cancelledStepIds: string[];
}

interface ReactivateRunResponse {
  runId: string;
  reactivatedStepIds: string[];
}

/** Pull the structured `error_code` (if any) out of an ApiError body. */
function extractErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiError) {
    const body = err.body as { error_code?: string } | null;
    return body?.error_code;
  }
  return undefined;
}

function extractMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string } | null;
    if (body?.message) return body.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Invalidate every "runs list" query for this company regardless of the
 * workflow `name` slot, since this hook only knows the runId.
 *
 * Run-list key shape (see queryKeys.governedWorkflows.runs):
 *   ["governed-workflows", "runs", companyId, name, filters]
 *
 * Care must be taken NOT to match the runDetail key, which shares the same
 * prefix but interposes the literal "detail":
 *   ["governed-workflows", "runs", "detail", companyId, runId]
 */
function invalidateRunListsForCompany(
  qc: ReturnType<typeof useQueryClient>,
  companyId: string,
) {
  qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey as unknown[];
      return (
        key[0] === "governed-workflows" &&
        key[1] === "runs" &&
        key[2] === companyId &&
        key[2] !== "detail" // belt-and-braces; companyId is a UUID anyway
      );
    },
  });
}

export function useCancelRun(runId: string) {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const { selectedCompanyId } = useCompany();
  return useMutation({
    mutationFn: async ({ reason }: { reason: string }): Promise<CancelRunResponse> => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return await api.post<CancelRunResponse>(
        `/companies/${selectedCompanyId}/governed-workflows/runs/${runId}/cancel`,
        { reason },
      );
    },
    onSuccess: () => {
      if (selectedCompanyId) {
        invalidateRunListsForCompany(qc, selectedCompanyId);
        qc.invalidateQueries({
          queryKey: queryKeys.governedWorkflows.runDetail(selectedCompanyId, runId),
        });
      }
      pushToast({
        title: "Run annulé",
        body: "Le run a été annulé avec succès.",
        tone: "success",
      });
    },
    onError: (err) => {
      const code = extractErrorCode(err);
      const map: Record<string, string> = {
        WORKFLOW_RUN_ALREADY_CANCELLED: "Ce run est déjà annulé.",
        WORKFLOW_RUN_NOT_ACTIVE: "Seuls les runs actifs peuvent être annulés.",
        WORKFLOW_FORBIDDEN: "Vous n'avez pas la permission d'annuler ce run.",
        WORKFLOW_INVALID_INPUT: "Motif d'annulation invalide (5 caractères minimum).",
        WORKFLOW_RUN_NOT_FOUND: "Ce run est introuvable.",
      };
      pushToast({
        title: "Erreur",
        body: (code && map[code]) ?? extractMessage(err, "Échec de l'annulation."),
        tone: "error",
      });
    },
  });
}

export function useReactivateRun(runId: string) {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const { selectedCompanyId } = useCompany();
  return useMutation({
    mutationFn: async (): Promise<ReactivateRunResponse> => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return await api.post<ReactivateRunResponse>(
        `/companies/${selectedCompanyId}/governed-workflows/runs/${runId}/reactivate`,
        {},
      );
    },
    onSuccess: () => {
      if (selectedCompanyId) {
        invalidateRunListsForCompany(qc, selectedCompanyId);
        qc.invalidateQueries({
          queryKey: queryKeys.governedWorkflows.runDetail(selectedCompanyId, runId),
        });
      }
      pushToast({
        title: "Run réactivé",
        body: "Le run est de nouveau actif.",
        tone: "success",
      });
    },
    onError: (err) => {
      const code = extractErrorCode(err);
      const map: Record<string, string> = {
        WORKFLOW_RUN_NOT_CANCELLED: "Ce run n'est pas annulé.",
        WORKFLOW_FORBIDDEN: "Vous n'avez pas la permission de réactiver ce run.",
        WORKFLOW_RUN_NOT_FOUND: "Ce run est introuvable.",
      };
      pushToast({
        title: "Erreur",
        body: (code && map[code]) ?? extractMessage(err, "Échec de la réactivation."),
        tone: "error",
      });
    },
  });
}
