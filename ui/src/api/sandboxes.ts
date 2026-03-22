// POD-06: Sandbox API client
import type { UserSandbox, SandboxProvisionOptions } from "@mnm/shared";
import { api } from "./client";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  authPending?: boolean;
}

export const sandboxesApi = {
  getMySandbox: (companyId: string) =>
    api.get<{ pod: UserSandbox | null }>(
      `/companies/${companyId}/sandboxes/my`,
    ),

  provision: (companyId: string, options?: SandboxProvisionOptions) =>
    api.post<UserSandbox>(
      `/companies/${companyId}/sandboxes/provision`,
      options ?? {},
    ),

  wake: (companyId: string) =>
    api.post<UserSandbox>(
      `/companies/${companyId}/sandboxes/my/wake`,
      {},
    ),

  hibernate: (companyId: string) =>
    api.post<UserSandbox>(
      `/companies/${companyId}/sandboxes/my/hibernate`,
      {},
    ),

  destroy: (companyId: string) =>
    api.delete<{ status: string }>(
      `/companies/${companyId}/sandboxes/my`,
    ),

  listAll: (companyId: string) =>
    api.get<{ pods: UserSandbox[] }>(
      `/companies/${companyId}/sandboxes`,
    ),

  exec: (companyId: string, command: string) =>
    api.post<ExecResult>(
      `/companies/${companyId}/sandboxes/my/exec`,
      { command },
    ),

  sendAuthCode: (companyId: string, code: string) =>
    api.post<{ success: boolean; stdout: string; stderr: string }>(
      `/companies/${companyId}/sandboxes/my/auth-code`,
      { code },
    ),
};
