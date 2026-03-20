import { Hand, Zap, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AutomationCursorPosition } from "@mnm/shared";

const POSITION_CONFIG: Record<
  AutomationCursorPosition,
  { label: string; icon: typeof Hand; className: string }
> = {
  manual: {
    label: "Manual",
    icon: Hand,
    className:
      "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  assisted: {
    label: "Assisted",
    icon: Zap,
    className:
      "bg-info-bg text-info border-info/20",
  },
  auto: {
    label: "Auto",
    icon: Sparkles,
    className:
      "bg-success-bg text-success border-success/20",
  },
};

export function CursorPositionBadge({
  position,
  "data-testid": testId,
}: {
  position: AutomationCursorPosition;
  "data-testid"?: string;
}) {
  const config = POSITION_CONFIG[position] ?? POSITION_CONFIG.assisted;
  const Icon = config.icon;

  return (
    <Badge
      data-testid={testId}
      variant="outline"
      className={`gap-1 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
