// POD-06: Pod API client
import type { UserPod, PodProvisionOptions } from "@mnm/shared";
import { api } from "./client";

export const podsApi = {
  getMyPod: (companyId: string) =>
    api.get<{ pod: UserPod | null }>(
      `/companies/${companyId}/pods/my`,
    ),

  provision: (companyId: string, options?: PodProvisionOptions) =>
    api.post<UserPod>(
      `/companies/${companyId}/pods/provision`,
      options ?? {},
    ),

  wake: (companyId: string) =>
    api.post<UserPod>(
      `/companies/${companyId}/pods/my/wake`,
      {},
    ),

  hibernate: (companyId: string) =>
    api.post<UserPod>(
      `/companies/${companyId}/pods/my/hibernate`,
      {},
    ),

  destroy: (companyId: string) =>
    api.delete<{ status: string }>(
      `/companies/${companyId}/pods/my`,
    ),

  listAll: (companyId: string) =>
    api.get<{ pods: UserPod[] }>(
      `/companies/${companyId}/pods`,
    ),

  exec: (companyId: string, command: string, stdin?: string) =>
    api.post<{ stdout: string; stderr: string; exitCode: number }>(
      `/companies/${companyId}/pods/my/exec`,
      { command, stdin },
    ),
};
