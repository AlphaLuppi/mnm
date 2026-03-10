import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driftApi } from "../api/drift";
import { queryKeys } from "../lib/queryKeys";
import type { DriftCheckRequest, DriftResolveRequest, DriftScanRequest } from "@mnm/shared";

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

export function useDriftScanStatus(projectId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: queryKeys.drift.status(projectId!),
    queryFn: () => driftApi.getStatus(projectId!, companyId),
    enabled: !!projectId,
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
      driftApi.scan(projectId!, body, companyId),
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
    mutationFn: () => driftApi.cancelScan(projectId!, companyId),
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.drift.status(projectId) });
        qc.invalidateQueries({ queryKey: queryKeys.drift.results(projectId) });
      }
    },
  });
}
