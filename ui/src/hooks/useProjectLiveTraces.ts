import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tracesApi, type Trace } from "../api/traces";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";

export interface LiveAgentTrace {
  trace: Trace;
  agentName: string;
}

export function useProjectLiveTraces(companyId: string | undefined) {
  const { data: tracesData } = useQuery({
    queryKey: queryKeys.traces.list(companyId!, {
      status: "running",
      limit: 20,
    } as Record<string, unknown>),
    queryFn: () =>
      tracesApi.list(companyId!, { status: "running", limit: 20 }),
    enabled: !!companyId,
    refetchInterval: 5_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(a.id, a.name);
    return map;
  }, [agents]);

  const liveTraces: LiveAgentTrace[] = useMemo(() => {
    const traces = tracesData?.data ?? [];
    return traces.map((trace) => ({
      trace,
      agentName: agentMap.get(trace.agentId) ?? trace.agentId.slice(0, 8),
    }));
  }, [tracesData, agentMap]);

  // Detect potential file conflicts: multiple running agents editing same files
  const fileConflicts = useMemo(() => {
    // This would require observation data — for now return empty
    // Will be populated when LiveEvents push observation data
    return [] as Array<{ file: string; agents: string[] }>;
  }, []);

  return {
    liveTraces,
    liveCount: liveTraces.length,
    fileConflicts,
    isLoading: !tracesData,
  };
}
