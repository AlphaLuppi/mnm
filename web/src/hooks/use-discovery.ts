"use client";

import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface DiscoveryResult {
  id: number;
  type: string;
  path: string;
  classification: string | null;
  name: string | null;
  metadata: string | null;
  llmModel: string | null;
  discoveredAt: number;
}

interface DiscoveryResponse {
  results: DiscoveryResult[];
  lastScan: string | null;
  count: number;
}

export function useDiscoveryResults(type?: string) {
  const url = type
    ? `/api/discovery/results?type=${encodeURIComponent(type)}`
    : "/api/discovery/results";

  const { data, error, isLoading, mutate } = useSWR<DiscoveryResponse>(
    url,
    fetcher
  );

  const results = Array.isArray(data?.results) ? data.results : [];

  return {
    results,
    lastScan: data?.lastScan ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useDiscoveryScan() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    summary?: { total: number; byType: Record<string, number> };
    message?: string;
  } | null>(null);

  async function triggerScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const response = await fetch("/api/discovery/scan", { method: "POST" });
      const result = await response.json();
      setScanResult(result);
      return result;
    } finally {
      setScanning(false);
    }
  }

  return {
    scanning,
    scanResult,
    triggerScan,
  };
}
