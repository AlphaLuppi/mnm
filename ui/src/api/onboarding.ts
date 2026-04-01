import { api } from "./client";

// onb-s01-api-marker

export interface OnboardingStatus {
  step: number;
  completed: boolean;
  data: Record<string, unknown> | null;
}

export interface UpdateOnboardingInput {
  step: number;
  data?: Record<string, unknown> | null;
}

// onb-s01-api-getStatus, onb-s01-api-updateStep
// onb-s01-api-complete, onb-s01-api-reset
export const onboardingApi = {
  // onb-s01-api-getStatus
  getStatus: (companyId: string) =>
    api.get<OnboardingStatus>(
      `/companies/${companyId}/onboarding`,
    ),

  // onb-s01-api-updateStep
  updateStep: (companyId: string, step: number, data?: Record<string, unknown> | null) =>
    api.put<OnboardingStatus>(
      `/companies/${companyId}/onboarding`,
      { step, data },
    ),

  // onb-s01-api-complete
  complete: (companyId: string, data?: { agentMode?: "sandbox" | "local" }) =>
    api.post<OnboardingStatus>(
      `/companies/${companyId}/onboarding/complete`,
      data ?? {},
    ),

  // onb-s01-api-reset
  reset: (companyId: string) =>
    api.post<OnboardingStatus>(
      `/companies/${companyId}/onboarding/reset`,
      {},
    ),
};
