import { api } from "./client";

// ---------- Types (local until @mnm/shared exports them) ----------

export type TraceStatus = "running" | "completed" | "failed" | "cancelled";
export type ObservationType = "span" | "generation" | "event";

export interface Trace {
  id: string;
  companyId: string;
  heartbeatRunId: string | null;
  workflowInstanceId: string | null;
  stageInstanceId: string | null;
  agentId: string;
  parentTraceId: string | null;
  name: string;
  status: TraceStatus;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number | null;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  metadata: Record<string, unknown> | null;
  tags: string[];
  childTraceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TraceObservation {
  id: string;
  traceId: string;
  parentObservationId: string | null;
  companyId: string;
  type: ObservationType;
  name: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  level: string | null;
  statusMessage: string | null;
  input: unknown;
  output: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  model: string | null;
  modelParameters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  children?: TraceObservation[];
  createdAt: string;
}

export interface TraceDetail extends Trace {
  observations: TraceObservation[];
}

export interface TraceListResult {
  data: Trace[];
  total: number;
  nextCursor: string | null;
}

export interface TraceFilters {
  agentId?: string;
  status?: TraceStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

// ---------- Helpers ----------

function buildQuery(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ---------- API ----------

export const tracesApi = {
  list: (companyId: string, filters: TraceFilters = {}) =>
    api.get<TraceListResult>(
      `/companies/${companyId}/traces${buildQuery(filters as Record<string, unknown>)}`,
    ),

  detail: (companyId: string, traceId: string) =>
    api.get<TraceDetail>(`/companies/${companyId}/traces/${traceId}`),
};
