import type { SidebarBadges } from "@mnm/shared";
import { api } from "./client";

export const sidebarBadgesApi = {
  get: (companyId: string) => api.get<SidebarBadges>(`/companies/${companyId}/sidebar-badges`),
  dismiss: (companyId: string, key: string) =>
    api.post<void>(`/companies/${companyId}/inbox/dismiss`, { key }),
};
