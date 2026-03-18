// TRACE-01: Trace status constants
export const TRACE_STATUSES = ["running", "completed", "failed", "cancelled"] as const;
export type TraceStatus = (typeof TRACE_STATUSES)[number];

// TRACE-01: Observation type constants
export const TRACE_OBSERVATION_TYPES = ["span", "generation", "event"] as const;
export type TraceObservationType = (typeof TRACE_OBSERVATION_TYPES)[number];

// TRACE-01: Observation status constants
export const TRACE_OBSERVATION_STATUSES = ["started", "completed", "failed"] as const;
export type TraceObservationStatus = (typeof TRACE_OBSERVATION_STATUSES)[number];

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

// TRACE-01: Trace data types
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
  totalCostUsd: string;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  phases: TracePhase[] | null;
  gold: TraceGold | null;
  createdAt: string;
  updatedAt: string;
}

export interface TraceObservation {
  id: string;
  traceId: string;
  parentObservationId: string | null;
  companyId: string;
  type: TraceObservationType;
  name: string;
  status: TraceObservationStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  level: string | null;
  statusMessage: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: string | null;
  model: string | null;
  modelParameters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// TRACE-01: Observation tree node (for getTree)
export interface TraceObservationNode extends TraceObservation {
  children: TraceObservationNode[];
}

// TRACE-01: Trace with tree
export interface TraceWithTree extends Trace {
  observations: TraceObservationNode[];
  childTraces?: Trace[];
}

// TRACE-01: List result
export interface TraceListResult {
  data: Trace[];
  nextCursor: string | null;
}

// TRACE-07: Lens scope
export interface TraceLensScope {
  agentIds?: string[];
  workflowIds?: string[];
  global?: boolean;
}

// TRACE-07: Lens data type
export interface TraceLens {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  prompt: string;
  scope: TraceLensScope;
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// PIPE-03: Gold prompt scopes
export const GOLD_PROMPT_SCOPES = ["global", "workflow", "agent", "issue"] as const;
export type GoldPromptScope = (typeof GOLD_PROMPT_SCOPES)[number];

// PIPE-03: Gold prompt data type
export interface GoldPrompt {
  id: string;
  companyId: string;
  scope: GoldPromptScope;
  scopeId: string | null;
  prompt: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// TRACE-07: Lens result data type
export interface TraceLensResult {
  id: string;
  lensId: string;
  traceId: string | null;
  workflowInstanceId: string | null;
  companyId: string;
  userId: string;
  resultMarkdown: string;
  resultStructured: Record<string, unknown> | null;
  generatedAt: string;
  modelUsed: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  createdAt: string;
}
