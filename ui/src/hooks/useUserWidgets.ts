import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateUserWidget, UpdateUserWidget } from "@mnm/shared";
import { useCompany } from "../context/CompanyContext";
import { userWidgetsApi } from "../api/user-widgets";
import { queryKeys } from "../lib/queryKeys";

export function useUserWidgets() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const listKey = queryKeys.userWidgets.list(selectedCompanyId!);

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => userWidgetsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createWidget = useMutation({
    mutationFn: (data: CreateUserWidget) =>
      userWidgetsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const updateWidget = useMutation({
    mutationFn: ({ widgetId, data }: { widgetId: string; data: UpdateUserWidget }) =>
      userWidgetsApi.update(selectedCompanyId!, widgetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const deleteWidget = useMutation({
    mutationFn: (widgetId: string) =>
      userWidgetsApi.delete(selectedCompanyId!, widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  return {
    widgets,
    isLoading,
    createWidget,
    updateWidget,
    deleteWidget,
  };
}
