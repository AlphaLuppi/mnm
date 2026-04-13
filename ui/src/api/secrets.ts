import type { CompanySecret, SecretProviderDescriptor, SecretProvider } from "@mnm/shared";
import { api } from "./client";

export const secretsApi = {
  list: (companyId: string) => api.get<CompanySecret[]>(`/companies/${companyId}/secrets`),
  providers: (companyId: string) =>
    api.get<SecretProviderDescriptor[]>(`/companies/${companyId}/secret-providers`),
  create: (
    companyId: string,
    data: {
      name: string;
      value: string;
      provider?: SecretProvider;
      description?: string | null;
      externalRef?: string | null;
    },
  ) => api.post<CompanySecret>(`/companies/${companyId}/secrets`, data),
  rotate: (companyId: string, id: string, data: { value: string; externalRef?: string | null }) =>
    api.post<CompanySecret>(`/companies/${companyId}/secrets/${id}/rotate`, data),
  update: (
    companyId: string,
    id: string,
    data: { name?: string; description?: string | null; externalRef?: string | null },
  ) => api.patch<CompanySecret>(`/companies/${companyId}/secrets/${id}`, data),
  remove: (companyId: string, id: string) => api.delete<{ ok: true }>(`/companies/${companyId}/secrets/${id}`),
};
