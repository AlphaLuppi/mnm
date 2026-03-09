import { useQuery } from "@tanstack/react-query";
import { bmadApi } from "../api/bmad";
import { queryKeys } from "../lib/queryKeys";

export function useBmadProject(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.bmad.project(projectId!),
    queryFn: () => bmadApi.getProject(projectId!, companyId),
    enabled: !!projectId,
  });
}

export function useBmadFile(projectId: string | undefined, filePath: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.bmad.file(projectId!, filePath!),
    queryFn: () => bmadApi.getFile(projectId!, filePath!, companyId),
    enabled: !!projectId && !!filePath,
  });
}
