import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driftApi } from "../api/drift";
import { queryKeys } from "../lib/queryKeys";
import type { DriftCheckRequest, DriftResolveRequest, DriftScanRequest } from "@mnm/shared";

export function useDriftResults(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.drift.results(projectId!),
    queryFn: async () => {
      const result = await driftApi.getResults(companyId!, projectId!);
      // Return the data array for backward compatibility with existing consumers
      return result.data;
    },
    enabled: !!projectId && !!companyId,
  });
}

export function useDriftCheck(projectId: string | undefined, companyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: DriftCheckRequest) =>
      driftApi.check(companyId!, projectId!, body),
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
      driftApi.resolve(companyId!, projectId!, driftId, body),
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.results(projectId) });
      }
    },
  });
}

export function useDriftScanStatus(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.drift.status(projectId!),
    queryFn: () => driftApi.getStatus(companyId!, projectId!),
    enabled: !!projectId && !!companyId,
    refetchInterval: (query) => {
      // Poll every 2s while scanning, stop when done
      return query.state.data?.scanning ? 2000 : false;
    },
  });
}

export function useDriftScan(projectId: string | undefined, companyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: DriftScanRequest) =>
      driftApi.scan(companyId!, projectId!, body),
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.status(projectId) });
      }
    },
  });
}

export function useDriftCancelScan(projectId: string | undefined, companyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => driftApi.cancelScan(companyId!, projectId!),
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.status(projectId) });
        qc.invalidateQueries({ queryKey: queryKeys.drift.results(projectId) });
      }
    },
  });
}
