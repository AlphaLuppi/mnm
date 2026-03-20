/**
 * PROJ-S03: useProjectScope hook
 *
 * Fetches the current user's project scope (allowed project IDs)
 * for the selected company. Returns null for global access.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useCompany } from "../context/CompanyContext";
import { useCurrentUser } from "./useCurrentUser";

export function useProjectScope() {
  const { selectedCompanyId } = useCompany();
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["project-scope", selectedCompanyId, user?.id],
    queryFn: async () => {
      if (!selectedCompanyId || !user?.id) return null;
      return api.get<{ projectIds: string[] }>(
        `/companies/${selectedCompanyId}/users/${user.id}/project-ids`,
      );
    },
    enabled: !!selectedCompanyId && !!user?.id,
    staleTime: 30_000, // Cache for 30s
  });

  return {
    projectIds: data?.projectIds ?? null,
    isLoading,
    isScoped: data?.projectIds !== null && data?.projectIds !== undefined,
  };
}
