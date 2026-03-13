"use client";

import useSWR from "swr";
import type { ProviderState } from "@/lib/providers/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface DashboardData {
  specs: { total: number; byType: Record<string, number> };
  agents: { running: number; total: number };
  drift: { pending: number; total: number };
  crossDocDrift: { open: number };
  workflows: { total: number };
  discovery: { total: number; byType: Record<string, number> };
  providers: ProviderState[];
  git: { branch: string; head: string; message: string } | null;
}

export function useDashboard() {
  const { data, error, isLoading } = useSWR<DashboardData>(
    "/api/dashboard",
    fetcher
  );

  return {
    dashboard: data,
    isLoading,
    isError: !!error,
  };
}
