import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LAYOUT } from "@mnm/shared";
import type { ResolvedLayout, WidgetPlacement } from "@mnm/shared";
import { useCompany } from "../context/CompanyContext";
import { usePermissions } from "./usePermissions";
import { viewPresetsApi } from "../api/view-presets";
import { queryKeys } from "../lib/queryKeys";
import { resolveLayout } from "../lib/resolve-layout";

export function useViewPreset() {
  const { selectedCompanyId } = useCompany();
  const { hasPermission } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.viewPresets.myView(selectedCompanyId!),
    queryFn: () => viewPresetsApi.getMyView(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });

  const layout: ResolvedLayout = useMemo(() => {
    if (!data?.preset) {
      return resolveLayout(DEFAULT_LAYOUT, null, hasPermission);
    }
    return resolveLayout(data.preset.layout, data.overrides, hasPermission);
  }, [data, hasPermission]);

  const grid: WidgetPlacement[] = useMemo(
    () => data?.grid ?? [],
    [data],
  );

  return {
    layout,
    grid,
    isLoading,
    presetName: data?.preset?.name ?? null,
    presetSlug: data?.preset?.slug ?? null,
  };
}
