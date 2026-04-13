import { useQuery } from "@tanstack/react-query";
import { workspaceContextApi } from "../api/workspaceContext";
import { queryKeys } from "../lib/queryKeys";

export function useWorkspaceContext(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.workspaceContext.project(projectId!),
    queryFn: () => workspaceContextApi.getProject(companyId!, projectId!),
    enabled: !!projectId && !!companyId,
  });
}

export function useWorkspaceFile(projectId: string | undefined, filePath: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.workspaceContext.file(projectId!, filePath!),
    queryFn: () => workspaceContextApi.getFile(companyId!, projectId!, filePath!),
    enabled: !!projectId && !!filePath && !!companyId,
  });
}
