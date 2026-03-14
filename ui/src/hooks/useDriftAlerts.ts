import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driftAlertsApi } from "../api/drift";
import { queryKeys } from "../lib/queryKeys";

export function useDriftAlerts(
  companyId: string | undefined,
  filters?: {
    severity?: string;
    limit?: number;
    offset?: number;
  },
) {
  return useQuery({
    queryKey: queryKeys.drift.alerts(companyId!, filters as Record<string, unknown>),
    queryFn: () => driftAlertsApi.listAlerts(companyId!, filters),
    enabled: !!companyId,
    refetchInterval: 30_000, // refresh every 30s for near-realtime
  });
}

export function useDriftAlertResolve(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      alertId: string;
      resolution: "acknowledged" | "ignored" | "remediated";
      note?: string;
    }) =>
      driftAlertsApi.resolveAlert(companyId!, params.alertId, {
        resolution: params.resolution,
        note: params.note,
      }),
    onSuccess: () => {
      if (companyId) {
        qc.invalidateQueries({ queryKey: ["drift", "alerts", companyId] });
        qc.invalidateQueries({
          queryKey: queryKeys.drift.monitoringStatus(companyId),
        });
      }
    },
  });
}

export function useDriftMonitoringStatus(companyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.drift.monitoringStatus(companyId!),
    queryFn: () => driftAlertsApi.getMonitoringStatus(companyId!),
    enabled: !!companyId,
    refetchInterval: 60_000, // refresh every 60s
  });
}

export function useDriftMonitoringToggle(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "stop") =>
      action === "start"
        ? driftAlertsApi.startMonitoring(companyId!)
        : driftAlertsApi.stopMonitoring(companyId!),
    onSuccess: () => {
      if (companyId) {
        qc.invalidateQueries({
          queryKey: queryKeys.drift.monitoringStatus(companyId),
        });
        qc.invalidateQueries({ queryKey: ["drift", "alerts", companyId] });
      }
    },
  });
}
