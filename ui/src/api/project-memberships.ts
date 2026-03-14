import { api } from "./client";
import type { ProjectMembershipRole } from "@mnm/shared";

export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  grantedBy: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}

export interface BulkResult {
  added?: number;
  removed?: number;
  skipped: number;
  results: Array<{
    userId: string;
    status: "added" | "skipped" | "removed";
    reason?: string;
  }>;
}

async function deleteWithBody<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(
      (errorBody as { error?: string } | null)?.error ?? `Request failed: ${res.status}`,
    );
  }
  return res.json();
}

export const projectMembershipsApi = {
  listMembers: (companyId: string, projectId: string) =>
    api.get<ProjectMember[]>(
      `/companies/${companyId}/projects/${projectId}/members`,
    ),

  addMember: (
    companyId: string,
    projectId: string,
    userId: string,
    role: ProjectMembershipRole = "contributor",
  ) =>
    api.post<ProjectMember>(
      `/companies/${companyId}/projects/${projectId}/members`,
      { userId, role },
    ),

  removeMember: (companyId: string, projectId: string, userId: string) =>
    api.delete<ProjectMember>(
      `/companies/${companyId}/projects/${projectId}/members/${userId}`,
    ),

  updateMemberRole: (
    companyId: string,
    projectId: string,
    userId: string,
    role: ProjectMembershipRole,
  ) =>
    api.patch<ProjectMember>(
      `/companies/${companyId}/projects/${projectId}/members/${userId}`,
      { role },
    ),

  bulkAddMembers: (
    companyId: string,
    projectId: string,
    userIds: string[],
    role: ProjectMembershipRole = "contributor",
  ) =>
    api.post<BulkResult>(
      `/companies/${companyId}/projects/${projectId}/members/bulk`,
      { userIds, role },
    ),

  bulkRemoveMembers: (
    companyId: string,
    projectId: string,
    userIds: string[],
  ) =>
    deleteWithBody<BulkResult>(
      `/companies/${companyId}/projects/${projectId}/members/bulk`,
      { userIds },
    ),
};
