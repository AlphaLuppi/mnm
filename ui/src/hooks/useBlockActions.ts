import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useCompany } from "../context/CompanyContext";
import { usePermissions } from "./usePermissions";
import type { BlockContext } from "../components/blocks/BlockRenderer";
import { queryKeys } from "../lib/queryKeys";

interface UseBlockActionsOptions {
  surface: "issue" | "inbox" | "dashboard";
  surfaceId?: string;
}

/**
 * Unified action handler for all block surfaces.
 *
 * Routes actions based on the surface:
 * - issue: posts a reply comment with action data
 * - inbox: calls POST /inbox-items/:id/action
 * - dashboard: no actions (display only)
 */
export function useBlockActions({ surface, surfaceId }: UseBlockActionsOptions) {
  const { selectedCompanyId } = useCompany();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload?: Record<string, unknown> }) => {
      if (!selectedCompanyId) throw new Error("No company selected");

      if (surface === "inbox" && surfaceId) {
        return api.post(
          `/companies/${selectedCompanyId}/inbox-items/${surfaceId}/action`,
          { action, payload },
        );
      }

      if (surface === "issue" && surfaceId) {
        const body = `**Action:** ${action}${payload ? `\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` : ""}`;
        return api.post(
          `/companies/${selectedCompanyId}/issues/${surfaceId}/comments`,
          { body },
        );
      }

      throw new Error(`Unsupported action surface: ${surface}`);
    },
    onSuccess: () => {
      if (surface === "inbox" && selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.list(selectedCompanyId) });
      }
      if (surface === "issue" && surfaceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(surfaceId) });
      }
    },
  });

  const onAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      await actionMutation.mutateAsync({ action, payload });
    },
    [actionMutation],
  );

  const context: BlockContext = {
    surface,
    surfaceId,
    companyId: selectedCompanyId ?? "",
    onAction,
    hasPermission,
  };

  return { context, isExecuting: actionMutation.isPending };
}
