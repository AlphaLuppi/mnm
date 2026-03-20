import { Button } from "@/components/ui/button";
import { SkipForward, ArrowRight, Loader2, Hand, Sparkles, Zap } from "lucide-react";
import { cn } from "../lib/utils";

// onb-s04-dual-mode-component

export type DualModePosition = "manual" | "assisted" | "auto";

export interface OnboardingDualModeStepProps {
  onSelect: (position: DualModePosition) => void;
  onSkip: () => void;
  selectedPosition: DualModePosition;
  loading?: boolean;
}

const MODE_CARDS: Array<{
  position: DualModePosition;
  title: string;
  description: string;
  icon: typeof Hand;
}> = [
  {
    position: "manual",
    title: "Manual Control",
    description:
      "Every agent action requires your explicit approval. Best for critical workflows.",
    icon: Hand,
  },
  {
    position: "assisted",
    title: "Assisted Mode",
    description:
      "Agents suggest actions but wait for your confirmation at key checkpoints. Recommended.",
    icon: Sparkles,
  },
  {
    position: "auto",
    title: "Full Automation",
    description:
      "Agents execute autonomously with minimal interruption. Monitor via dashboard.",
    icon: Zap,
  },
];

export function OnboardingDualModeStep({
  onSelect,
  onSkip,
  selectedPosition,
  loading = false,
}: OnboardingDualModeStepProps) {
  return (
    <div data-testid="onb-s04-dual-mode-step" className="space-y-4">
      {MODE_CARDS.map((card) => {
        const isSelected = selectedPosition === card.position;
        const Icon = card.icon;

        return (
          <button
            key={card.position}
            data-testid={`onb-s04-card-${card.position}`}
            type="button"
            className={cn(
              "w-full text-left border rounded-lg p-4 transition-all",
              "hover:border-primary/50 hover:bg-muted/30",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border",
            )}
            onClick={() => onSelect(card.position)}
            disabled={loading}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 items-center justify-center rounded-md",
                  isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    data-testid={`onb-s04-card-title-${card.position}`}
                    className={cn(
                      "text-sm font-medium",
                      isSelected && "text-primary",
                    )}
                  >
                    {card.title}
                  </span>
                  {card.position === "assisted" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      Recommended
                    </span>
                  )}
                </div>
                <p
                  data-testid={`onb-s04-card-desc-${card.position}`}
                  className="text-xs text-muted-foreground mt-1"
                >
                  {card.description}
                </p>
              </div>
              <div
                data-testid={`onb-s04-card-radio-${card.position}`}
                className={cn(
                  "mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                  isSelected ? "border-primary" : "border-muted-foreground/30",
                )}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            </div>
          </button>
        );
      })}

      <div className="flex items-center justify-end pt-2">
        <Button
          data-testid="onb-s04-skip"
          variant="ghost"
          size="sm"
          onClick={onSkip}
          disabled={loading}
        >
          <SkipForward className="h-3.5 w-3.5 mr-1" />
          Skip
        </Button>
      </div>
    </div>
  );
}
