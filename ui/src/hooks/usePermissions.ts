import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { accessApi } from "../api/access";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

export function usePermissions() {
  const { selectedCompanyId } = useCompany();

  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const isLocalTrusted = health?.deploymentMode === "local_trusted";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.access.myPermissions(selectedCompanyId!),
    queryFn: () => accessApi.getMyPermissions(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      if (isLocalTrusted) return true;
      if (!data) return false;
      return (data.effectivePermissions ?? []).includes(permissionKey);
    },
    [data, isLocalTrusted],
  );

  return {
    permissions: data?.effectivePermissions ?? [],
    roleId: isLocalTrusted ? null : ((data as { roleId?: string | null } | undefined)?.roleId ?? null),
    hasPermission,
    isLoading: isLocalTrusted ? false : isLoading,
  };
}
