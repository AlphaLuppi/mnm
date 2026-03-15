import type {
  SsoConfiguration,
  CreateSsoConfigurationInput,
  UpdateSsoConfigurationInput,
  SsoMetadataSyncResult,
} from "@mnm/shared";
import { api } from "./client";

// sso-s03-api-list, sso-s03-api-get, sso-s03-api-create
// sso-s03-api-update, sso-s03-api-delete, sso-s03-api-toggle
// sso-s03-api-verify, sso-s03-api-sync
export const ssoApi = {
  // sso-s03-api-list
  list: (companyId: string) =>
    api.get<{ configurations: SsoConfiguration[] }>(
      `/companies/${companyId}/sso`,
    ),

  // sso-s03-api-get
  getById: (companyId: string, configId: string) =>
    api.get<SsoConfiguration>(
      `/companies/${companyId}/sso/${configId}`,
    ),

  // sso-s03-api-create
  create: (companyId: string, body: CreateSsoConfigurationInput) =>
    api.post<SsoConfiguration>(
      `/companies/${companyId}/sso`,
      body,
    ),

  // sso-s03-api-update
  update: (companyId: string, configId: string, body: UpdateSsoConfigurationInput) =>
    api.put<SsoConfiguration>(
      `/companies/${companyId}/sso/${configId}`,
      body,
    ),

  // sso-s03-api-delete
  delete: (companyId: string, configId: string) =>
    api.delete<{ status: string; id: string }>(
      `/companies/${companyId}/sso/${configId}`,
    ),

  // sso-s03-api-toggle
  toggle: (companyId: string, configId: string) =>
    api.post<SsoConfiguration>(
      `/companies/${companyId}/sso/${configId}/toggle`,
      {},
    ),

  // sso-s03-api-verify
  verify: (companyId: string, configId: string) =>
    api.post<SsoConfiguration>(
      `/companies/${companyId}/sso/${configId}/verify`,
      {},
    ),

  // sso-s03-api-sync
  sync: (companyId: string, configId: string) =>
    api.post<SsoMetadataSyncResult>(
      `/companies/${companyId}/sso/${configId}/sync`,
      {},
    ),
};
