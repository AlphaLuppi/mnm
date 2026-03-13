"use client";

import { Badge } from "@/components/ui/badge";

const SEVERITY_STYLES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  minor: { variant: "outline", className: "border-green-500/50 text-green-600 dark:text-green-400" },
  moderate: { variant: "outline", className: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  critical: { variant: "destructive", className: "" },
};

const SEVERITY_LABELS: Record<string, string> = {
  minor: "Minor",
  moderate: "Moderate",
  critical: "Critical",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.minor;
  return (
    <Badge variant={style.variant} className={style.className}>
      {SEVERITY_LABELS[severity] ?? severity}
    </Badge>
  );
}
