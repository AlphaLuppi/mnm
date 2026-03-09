import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driftApi } from "../api/drift";
import { queryKeys } from "../lib/queryKeys";
import type { DriftCheckRequest, DriftResolveRequest } from "@mnm/shared";

export function useDriftResults(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.drift.results(projectId!),
    queryFn: () => driftApi.getResults(projectId!, companyId),
    enabled: !!projectId,
  });
}

export function useDriftCheck(projectId: string | undefined, companyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: DriftCheckRequest) =>
      driftApi.check(projectId!, body, companyId),
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.results(projectId) });
      }
    },
  });
}

export function useDriftResolve(projectId: string | undefined, companyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ driftId, ...body }: DriftResolveRequest & { driftId: string }) =>
      driftApi.resolve(projectId!, driftId, body, companyId),
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.results(projectId) });
      }
    },
  });
}
