import { api } from "./client";

export type GoldPromptScope = "global" | "workflow" | "agent" | "issue";

export type GoldPrompt = {
  id: string;
  companyId: string;
  scope: GoldPromptScope;
  scopeId: string | null;
  prompt: string;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateGoldPromptInput = {
  scope: GoldPromptScope;
  scopeId?: string;
  prompt: string;
  isActive?: boolean;
};

export type UpdateGoldPromptInput = {
  prompt?: string;
  isActive?: boolean;
};

export const goldPromptsApi = {
  list: (companyId: string, filters?: { scope?: GoldPromptScope; scopeId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.scope) params.set("scope", filters.scope);
    if (filters?.scopeId) params.set("scopeId", filters.scopeId);
    const qs = params.toString();
    return api.get<GoldPrompt[]>(`/companies/${companyId}/gold-prompts${qs ? `?${qs}` : ""}`);
  },

  create: (companyId: string, input: CreateGoldPromptInput) =>
    api.post<GoldPrompt>(`/companies/${companyId}/gold-prompts`, input),

  update: (companyId: string, promptId: string, input: UpdateGoldPromptInput) =>
    api.put<GoldPrompt>(`/companies/${companyId}/gold-prompts/${promptId}`, input),

  delete: (companyId: string, promptId: string) =>
    api.delete<void>(`/companies/${companyId}/gold-prompts/${promptId}`),
};
