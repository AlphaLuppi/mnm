"use client";

import useSWR from "swr";
import type { DriftDetection } from "@/lib/core/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface DriftStatus {
  lastScanAt: number | null;
  lastScanStatus: string | null;
  totalScans: number;
  pendingDriftCount: number;
}

export interface ScanResult {
  scanId: string;
  detection: {
    id: string;
    severity: string;
    driftType: string;
    summary: string;
    recommendation: string;
    hasDrift: boolean;
  };
  scope: string[];
}

export interface InferredScope {
  files: string[];
  directories: string[];
  patterns: string[];
  confidence: "high" | "medium" | "low";
  source: "spec_content" | "directory_scan" | "fallback";
  specId: string;
  specTitle: string | null;
}

export function useDriftDetections() {
  const { data, error, isLoading, mutate } = useSWR<DriftDetection[]>(
    "/api/drift",
    fetcher,
    { refreshInterval: 5000 }
  );

  async function triggerScan(
    specId: string,
    scope?: string[],
    inferFromSpec: boolean = true
  ): Promise<ScanResult> {
    const response = await fetch("/api/drift/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specId, scope, inferFromSpec }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message ?? "Scan failed");
    }
    await mutate();
    return result;
  }

  async function inferScope(specId: string): Promise<InferredScope> {
    const response = await fetch("/api/drift/infer-scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specId }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message ?? "Scope inference failed");
    }
    return result;
  }

  return {
    drifts: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
    triggerScan,
    inferScope,
  };
}

export function useDriftStatus() {
  const { data, error, isLoading, mutate } = useSWR<DriftStatus>(
    "/api/drift/status",
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    status: data,
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
