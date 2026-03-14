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
      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  auto: {
    label: "Auto",
    icon: Sparkles,
    className:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
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
