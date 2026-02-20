"use client";

import useSWR from "swr";
import type { DriftDetection } from "@/lib/core/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useDriftDetections() {
  const { data, error, isLoading, mutate } = useSWR<DriftDetection[]>(
    "/api/drift",
    fetcher,
    { refreshInterval: 5000 }
  );

  return {
    drifts: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function usePendingDrifts() {
  const { data, error, isLoading } = useSWR<DriftDetection[]>(
    "/api/drift?status=pending",
    fetcher,
    { refreshInterval: 5000 }
  );

  return {
    pendingDrifts: data ?? [],
    pendingCount: data?.length ?? 0,
    hasCritical: data?.some((d) => d.severity === "critical") ?? false,
    isLoading,
    isError: !!error,
  };
}

export function useDriftDetail(id: string) {
  const { data, error, isLoading, mutate } = useSWR<DriftDetection>(
    `/api/drift/${id}`,
    fetcher
  );

  return {
    drift: data,
    isLoading,
    isError: !!error,
    mutate,
  };
}
