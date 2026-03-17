import { api } from "./client";

// ---------- Types (local until @mnm/shared exports them) ----------

export interface LensScope {
  agentIds?: string[];
  workflowIds?: string[];
  global?: boolean;
}

export interface TraceLens {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  prompt: string;
  scope: LensScope;
  isTemplate: boolean;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LensAnalysisResult {
  id: string;
  lensId: string;
  traceId: string;
  companyId: string;
  userId: string;
  resultMarkdown: string;
  resultStructured: Record<string, unknown> | null;
  generatedAt: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}

export interface LensCostEstimate {
  estimatedCostUsd: number;
  observationCount: number;
  tokenEstimate: number;
}

export interface CreateLensInput {
  name: string;
  prompt: string;
  scope?: LensScope;
  isDefault?: boolean;
}

export interface UpdateLensInput {
  name?: string;
  prompt?: string;
  scope?: LensScope;
  isActive?: boolean;
  isDefault?: boolean;
}

// ---------- API ----------

export const lensesApi = {
  list: (companyId: string) =>
    api.get<TraceLens[]>(`/companies/${companyId}/trace-lenses`),

  create: (companyId: string, body: CreateLensInput) =>
    api.post<TraceLens>(`/companies/${companyId}/trace-lenses`, body),

  update: (companyId: string, lensId: string, body: UpdateLensInput) =>
    api.put<TraceLens>(`/companies/${companyId}/trace-lenses/${lensId}`, body),

  delete: (companyId: string, lensId: string) =>
    api.delete<void>(`/companies/${companyId}/trace-lenses/${lensId}`),

  analyze: (companyId: string, lensId: string, traceId: string) =>
    api.post<LensAnalysisResult>(
      `/companies/${companyId}/trace-lenses/${lensId}/analyze/${traceId}`,
      {},
    ),

  getResult: (companyId: string, lensId: string, traceId: string) =>
    api.get<LensAnalysisResult>(
      `/companies/${companyId}/trace-lenses/${lensId}/results/${traceId}`,
    ),

  estimateCost: (companyId: string, traceId: string) =>
    api.get<LensCostEstimate>(
      `/companies/${companyId}/traces/${traceId}/analysis-cost`,
    ),
};
