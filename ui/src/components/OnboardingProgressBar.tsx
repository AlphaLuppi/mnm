import { Building2, Shield, Tag, Users, Rocket, Check } from "lucide-react";
import { cn } from "../lib/utils";

// onb-s01-progress-component

export interface OnboardingProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

const STEP_CONFIG = [
  { label: "Company", icon: Building2 },
  { label: "Roles", icon: Shield },
  { label: "Tags", icon: Tag },
  { label: "Invite", icon: Users },
  { label: "Done", icon: Rocket },
];

export function OnboardingProgressBar({
  currentStep,
  totalSteps = 5,
}: OnboardingProgressBarProps) {
  const steps = STEP_CONFIG.slice(0, totalSteps);

  return (
    <div
      data-testid="onb-s01-progress-bar"
      className="flex items-center w-full px-4 py-3"
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isUpcoming = stepNumber > currentStep;
        const StepIcon = step.icon;
        const showConnector = index < steps.length - 1;

        return (
          <div
            key={stepNumber}
            className={cn("flex items-center", showConnector ? "flex-1" : "")}
          >
            <div className="flex flex-col items-center">
              <div
                data-testid={`onb-s01-progress-step-${stepNumber}`}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary animate-pulse",
                  isUpcoming && "border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <span
                data-testid={`onb-s01-step-label-${stepNumber}`}
                className={cn(
                  "mt-1 text-xs font-medium",
                  isCompleted && "text-primary",
                  isCurrent && "text-primary font-semibold",
                  isUpcoming && "text-muted-foreground/50",
                )}
              >
                {step.label}
              </span>
            </div>
            {showConnector && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-1.25rem]",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
