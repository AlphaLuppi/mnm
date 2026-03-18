import { api } from "./client";

// ---------- Types (local until @mnm/shared exports them) ----------

export type TraceStatus = "running" | "completed" | "failed" | "cancelled";
export type ObservationType = "span" | "generation" | "event";

// PIPE-02: Silver phase types
export type TracePhaseType =
  | "COMPREHENSION"
  | "IMPLEMENTATION"
  | "VERIFICATION"
  | "COMMUNICATION"
  | "INITIALIZATION"
  | "RESULT"
  | "UNKNOWN";

export interface TracePhase {
  order: number;
  type: TracePhaseType;
  name: string;
  startIdx: number;
  endIdx: number;
  observationCount: number;
  summary: string;
}

// PIPE-03: Gold analysis types
export type GoldVerdict = "success" | "partial" | "failure" | "neutral";

export interface TraceGoldPhase {
  phaseOrder: number;
  relevanceScore: number; // 0-100
  annotation: string;
  verdict: GoldVerdict;
  keyObservationIds: string[];
}

export interface TraceGold {
  generatedAt: string;
  modelUsed: string;
  prompt: string;
  promptSources: {
    global?: string;
    workflow?: string;
    agent?: string;
    issue?: { id: string; title: string };
    custom?: string;
  };
  phases: TraceGoldPhase[];
  verdict: "success" | "partial" | "failure";
  verdictReason: string;
  highlights: string[];
  issueAcStatus?: {
    acId: string;
    label: string;
    status: "met" | "partial" | "not_met" | "unknown";
    evidence?: string;
  }[];
}

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
  totalCostUsd: number | string;
  metadata: Record<string, unknown> | null;
  tags: string[];
  phases: TracePhase[] | null;
  gold: TraceGold | null;
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
  costUsd: number | string | null;
  model: string | null;
  modelParameters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  children?: TraceObservation[];
  createdAt: string;
}

export interface TraceDetail extends Trace {
  observations: TraceObservation[];
  childTraces?: Trace[];
}

export interface TraceListResult {
  data: Trace[];
  total: number;
  nextCursor: string | null;
}

export interface TraceFilters {
  agentId?: string;
  status?: TraceStatus;
  workflowInstanceId?: string;
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
