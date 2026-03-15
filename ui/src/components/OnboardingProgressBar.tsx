import { Building2, Bot, ListTodo, Users, Gauge, Rocket, Check } from "lucide-react";
import { cn } from "../lib/utils";

// onb-s01-progress-component

export interface OnboardingProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

const STEP_CONFIG = [
  { label: "Company", icon: Building2 },
  { label: "Agent", icon: Bot },
  { label: "Task", icon: ListTodo },
  { label: "Invite", icon: Users },
  { label: "Speed", icon: Gauge },
  { label: "Launch", icon: Rocket },
];

export function OnboardingProgressBar({
  currentStep,
  totalSteps = 5,
}: OnboardingProgressBarProps) {
  const steps = STEP_CONFIG.slice(0, totalSteps);

  return (
    <div
      data-testid="onb-s01-progress-bar"
      className="flex items-center justify-between w-full px-4 py-3"
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isUpcoming = stepNumber > currentStep;
        const StepIcon = step.icon;

        return (
          <div
            key={stepNumber}
            className="flex flex-col items-center flex-1"
          >
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
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "hidden",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
