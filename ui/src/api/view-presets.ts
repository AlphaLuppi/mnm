import { api } from "./client";
import type { MyViewResponse, ViewPreset, LayoutOverrides } from "@mnm/shared";

export const viewPresetsApi = {
  list: (companyId: string) =>
    api.get<ViewPreset[]>(`/companies/${companyId}/view-presets`),

  get: (companyId: string, presetId: string) =>
    api.get<ViewPreset>(`/companies/${companyId}/view-presets/${presetId}`),

  create: (companyId: string, data: Partial<ViewPreset>) =>
    api.post<ViewPreset>(`/companies/${companyId}/view-presets`, data),

  update: (companyId: string, presetId: string, data: Partial<ViewPreset>) =>
    api.patch<ViewPreset>(`/companies/${companyId}/view-presets/${presetId}`, data),

  delete: (companyId: string, presetId: string) =>
    api.delete(`/companies/${companyId}/view-presets/${presetId}`),

  getMyView: (companyId: string) =>
    api.get<MyViewResponse>(`/companies/${companyId}/my-view`),

  updateOverrides: (companyId: string, overrides: LayoutOverrides) =>
    api.patch<{ overrides: LayoutOverrides }>(`/companies/${companyId}/my-view/overrides`, overrides),
};
