import type { Goal } from "@mnm/shared";
import { api } from "./client";

export const goalsApi = {
  list: (companyId: string) => api.get<Goal[]>(`/companies/${companyId}/goals`),
  get: (companyId: string, id: string) => api.get<Goal>(`/companies/${companyId}/goals/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Goal>(`/companies/${companyId}/goals`, data),
  update: (companyId: string, id: string, data: Record<string, unknown>) => api.patch<Goal>(`/companies/${companyId}/goals/${id}`, data),
  remove: (companyId: string, id: string) => api.delete<Goal>(`/companies/${companyId}/goals/${id}`),
};
