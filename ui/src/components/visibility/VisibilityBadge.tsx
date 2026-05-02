import { Building2, Lock, Tags, Users } from "lucide-react";
import type { Visibility } from "@mnm/shared";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<Visibility, string> = {
  private: "Private",
  tags: "Tags",
  principals: "Members",
  company: "Company",
};

const ICONS: Record<Visibility, typeof Lock> = {
  private: Lock,
  tags: Tags,
  principals: Users,
  company: Building2,
};

export type VisibilityBadgeProps = {
  visibility: Visibility;
  /**
   * When the visibility is `tags` or `principals`, optionally append the
   * count to the label (e.g. "Tags · 3", "Members · 2").
   */
  count?: number;
  className?: string;
  testId?: string;
};

export function VisibilityBadge({
  visibility,
  count,
  className,
  testId,
}: VisibilityBadgeProps) {
  const Icon = ICONS[visibility];
  const label = LABELS[visibility];
  const showCount =
    typeof count === "number" &&
    (visibility === "tags" || visibility === "principals");

  // `company` (tier 3 enforced) gets a stronger variant so the user
  // sees at a glance that it's not contournable.
  const variant = visibility === "company" ? "default" : "outline";

  return (
    <Badge
      variant={variant}
      className={cn("gap-1", className)}
      data-testid={testId}
      data-visibility={visibility}
    >
      <Icon />
      {label}
      {showCount && (
        <span className="text-muted-foreground"> · {count}</span>
      )}
    </Badge>
  );
}
