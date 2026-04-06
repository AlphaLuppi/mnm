import { api } from "./client";
import type { UserWidget, CreateUserWidget, UpdateUserWidget } from "@mnm/shared";

export const userWidgetsApi = {
  list: (companyId: string) =>
    api.get<UserWidget[]>(`/companies/${companyId}/my-widgets`),

  create: (companyId: string, data: CreateUserWidget) =>
    api.post<UserWidget>(`/companies/${companyId}/my-widgets`, data),

  update: (companyId: string, widgetId: string, data: UpdateUserWidget) =>
    api.patch<UserWidget>(`/companies/${companyId}/my-widgets/${widgetId}`, data),

  delete: (companyId: string, widgetId: string) =>
    api.delete(`/companies/${companyId}/my-widgets/${widgetId}`),

  generate: (companyId: string, prompt: string) =>
    api.post<UserWidget>(`/companies/${companyId}/my-widgets/generate`, { prompt }),
};
