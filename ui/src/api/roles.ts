import { api } from "./client";

export type Role = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  hierarchyLevel: number;
  inheritsFromId: string | null;
  bypassTagFilter: boolean;
  isSystem: boolean;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: Array<{ id: string; slug: string }>;
};

export type CreateRoleInput = {
  name: string;
  slug: string;
  description?: string;
  hierarchyLevel?: number;
  bypassTagFilter?: boolean;
  permissionSlugs?: string[];
};

export type UpdateRoleInput = {
  name?: string;
  description?: string;
  hierarchyLevel?: number;
  bypassTagFilter?: boolean;
  permissionSlugs?: string[];
};

export const rolesApi = {
  list: (companyId: string) =>
    api.get<Role[]>(`/companies/${companyId}/roles`),

  get: (companyId: string, roleId: string) =>
    api.get<Role>(`/companies/${companyId}/roles/${roleId}`),

  create: (companyId: string, input: CreateRoleInput) =>
    api.post<Role>(`/companies/${companyId}/roles`, input),

  update: (companyId: string, roleId: string, input: UpdateRoleInput) =>
    api.patch<Role>(`/companies/${companyId}/roles/${roleId}`, input),

  delete: (companyId: string, roleId: string) =>
    api.delete<void>(`/companies/${companyId}/roles/${roleId}`),
};
