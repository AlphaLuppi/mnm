// POD-06: Sandbox API client (renamed from pods.ts)
import type { UserSandbox, SandboxProvisionOptions } from "@mnm/shared";
import { api } from "./client";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  sessionId?: string | null;
  interactive?: boolean;
}

export const sandboxesApi = {
  getMyPod: (companyId: string) =>
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

  sendInput: (companyId: string, sessionId: string, input: string) =>
    api.post<ExecResult>(
      `/companies/${companyId}/sandboxes/my/exec/input`,
      { sessionId, input },
    ),
};
