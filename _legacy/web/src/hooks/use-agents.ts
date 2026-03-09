"use client";

import useSWR from "swr";
import type { Agent } from "@/lib/core/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<Agent[]>(
    "/api/agents",
    fetcher
  );

  return {
    agents: Array.isArray(data) ? data : [],
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useAgent(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Agent>(
    `/api/agents/${id}`,
    fetcher
  );

  return {
    agent: data,
    isLoading,
    isError: !!error,
    mutate,
  };
}
