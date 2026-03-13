import { useQuery } from "@tanstack/react-query";
import { workspaceContextApi } from "../api/workspaceContext";
import { queryKeys } from "../lib/queryKeys";

export function useWorkspaceContext(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.workspaceContext.project(projectId!),
    queryFn: () => workspaceContextApi.getProject(projectId!, companyId),
    enabled: !!projectId,
  });
}

export function useWorkspaceFile(projectId: string | undefined, filePath: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.workspaceContext.file(projectId!, filePath!),
    queryFn: () => workspaceContextApi.getFile(projectId!, filePath!, companyId),
    enabled: !!projectId && !!filePath,
  });
}
