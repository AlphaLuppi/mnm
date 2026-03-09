import type { BmadProject } from "@mnm/shared";
import { api } from "./client";

function withCompanyScope(path: string, companyId?: string) {
  if (!companyId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

export const bmadApi = {
  getProject: (projectId: string, companyId?: string) =>
    api.get<BmadProject>(
      withCompanyScope(`/projects/${encodeURIComponent(projectId)}/bmad`, companyId),
    ),
  getFile: (projectId: string, filePath: string, companyId?: string) =>
    api.get<string>(
      withCompanyScope(
        `/projects/${encodeURIComponent(projectId)}/bmad/file?path=${encodeURIComponent(filePath)}`,
        companyId,
      ),
    ),
};
