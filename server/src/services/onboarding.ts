import type { Db } from "@mnm/db";
import { companies } from "@mnm/db";
import { eq } from "drizzle-orm";

// onb-s01-service-marker

export interface OnboardingStatus {
  step: number;
  completed: boolean;
  data: Record<string, unknown> | null;
}

export interface UpdateOnboardingInput {
  step: number;
  data?: Record<string, unknown> | null;
}

export function onboardingService(db: Db) {
  // onb-s01-svc-getStatus
  async function getOnboardingStatus(companyId: string): Promise<OnboardingStatus> {
    const [company] = await db
      .select({
        onboardingStep: companies.onboardingStep,
        onboardingCompleted: companies.onboardingCompleted,
        onboardingData: companies.onboardingData,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    return {
      step: company.onboardingStep,
      completed: company.onboardingCompleted,
      data: company.onboardingData as Record<string, unknown> | null,
    };
  }

  // onb-s01-svc-updateStep
  async function updateOnboardingStep(
    companyId: string,
    step: number,
    data?: Record<string, unknown> | null,
  ): Promise<OnboardingStatus> {
    const updatePayload: Record<string, unknown> = {
      onboardingStep: step,
      updatedAt: new Date(),
    };
    if (data !== undefined) {
      updatePayload.onboardingData = data;
    }

    const [updated] = await db
      .update(companies)
      .set(updatePayload)
      .where(eq(companies.id, companyId))
      .returning({
        onboardingStep: companies.onboardingStep,
        onboardingCompleted: companies.onboardingCompleted,
        onboardingData: companies.onboardingData,
      });

    if (!updated) {
      throw new Error(`Company not found: ${companyId}`);
    }

    return {
      step: updated.onboardingStep,
      completed: updated.onboardingCompleted,
      data: updated.onboardingData as Record<string, unknown> | null,
    };
  }

  // onb-s01-svc-complete
  async function completeOnboarding(companyId: string): Promise<OnboardingStatus> {
    const [updated] = await db
      .update(companies)
      .set({
        onboardingCompleted: true,
        onboardingStep: 6,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning({
        onboardingStep: companies.onboardingStep,
        onboardingCompleted: companies.onboardingCompleted,
        onboardingData: companies.onboardingData,
      });

    if (!updated) {
      throw new Error(`Company not found: ${companyId}`);
    }

    return {
      step: updated.onboardingStep,
      completed: updated.onboardingCompleted,
      data: updated.onboardingData as Record<string, unknown> | null,
    };
  }

  // onb-s01-svc-reset
  async function resetOnboarding(companyId: string): Promise<OnboardingStatus> {
    const [updated] = await db
      .update(companies)
      .set({
        onboardingStep: 0,
        onboardingCompleted: false,
        onboardingData: null,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning({
        onboardingStep: companies.onboardingStep,
        onboardingCompleted: companies.onboardingCompleted,
        onboardingData: companies.onboardingData,
      });

    if (!updated) {
      throw new Error(`Company not found: ${companyId}`);
    }

    return {
      step: updated.onboardingStep,
      completed: updated.onboardingCompleted,
      data: updated.onboardingData as Record<string, unknown> | null,
    };
  }

  return {
    getOnboardingStatus,
    updateOnboardingStep,
    completeOnboarding,
    resetOnboarding,
  };
}
