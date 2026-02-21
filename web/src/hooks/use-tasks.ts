"use client";

import useSWR from "swr";
import type { TaskEntry, TaskType, TaskRunnerState } from "@/lib/tasks/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTasks() {
  const { data, error, isLoading, mutate } = useSWR<TaskRunnerState>(
    "/api/tasks",
    fetcher
  );

  return {
    tasks: data?.tasks ?? [],
    running: data?.running ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export async function launchTask(type: TaskType): Promise<TaskEntry> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? "Failed to launch task");
  }

  return res.json();
}
