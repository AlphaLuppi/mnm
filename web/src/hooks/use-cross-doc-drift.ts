"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface CrossDocDriftAlert {
  id: number;
  sourceSpecId: number | null;
  targetSpecId: number | null;
  driftType: string;
  severity: string;
  description: string;
  sourceText: string | null;
  targetText: string | null;
  status: string;
  resolvedAt: number | null;
  resolutionRationale: string | null;
  detectedAt: number;
  sourceSpec: {
    id: string;
    title: string | null;
    filePath: string;
    specType: string;
  } | null;
  targetSpec: {
    id: string;
    title: string | null;
    filePath: string;
    specType: string;
  } | null;
}

export function useCrossDocDrifts() {
  const { data, error, isLoading, mutate } = useSWR<CrossDocDriftAlert[]>(
    "/api/drift/cross-doc",
    fetcher
  );

  const drifts = Array.isArray(data) ? data : [];

  async function triggerScan() {
    const response = await fetch("/api/drift/cross-doc", { method: "POST" });
    const result = await response.json();
    await mutate();
    return result;
  }

  async function resolveDrift(
    id: number,
    status: "resolved" | "dismissed",
    rationale?: string
  ) {
    await fetch(`/api/drift/cross-doc/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rationale }),
    });
    await mutate();
  }

  return {
    drifts,
    isLoading,
    isError: !!error,
    triggerScan,
    resolveDrift,
    mutate,
  };
}
