import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { string } from "@mnm/shared";
import { useCompany } from "../context/CompanyContext";
import { accessApi } from "../api/access";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

type PermissionsData = {
  businessRole: string | null;
  presetPermissions: string[];
  explicitGrants: Array<{ permissionKey: string; scope: unknown }>;
  effectivePermissions: string[];
};

export function usePermissions() {
  const { selectedCompanyId } = useCompany();

  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const isLocalTrusted = health?.deploymentMode === "local_trusted";

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: queryKeys.access.myPermissions(selectedCompanyId!),
    queryFn: () => accessApi.getMyPermissions(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000, // cache 30s — permissions change rarely
  });

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      // In local_trusted mode, all permissions are granted
      if (isLocalTrusted) return true;
      if (!data) return false;
      return data.effectivePermissions.includes(permissionKey);
    },
    [data, isLocalTrusted],
  );

  return {
    permissions: isLocalTrusted
      : (data?.effectivePermissions ?? []),
    businessRole: isLocalTrusted ? "admin" : (data?.businessRole ?? null),
    hasPermission,
    isLoading: isLocalTrusted ? false : isLoading,
  };
}
