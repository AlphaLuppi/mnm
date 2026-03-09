"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/shared/severity-badge";
import type { DriftDetection } from "@/lib/core/types";

const DRIFT_TYPE_LABELS: Record<string, string> = {
  scope_expansion: "Scope Expansion",
  approach_change: "Approach Change",
  design_deviation: "Design Deviation",
};

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DriftCard({ drift }: { drift: DriftDetection }) {
  const isPending = drift.userDecision === "pending" || !drift.userDecision;

  return (
    <Link href={`/drift/${drift.id}`}>
      <Card className={`cursor-pointer transition-colors hover:bg-muted/50 ${!isPending ? "opacity-70" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={drift.severity} />
              <span className="text-xs text-muted-foreground">
                {DRIFT_TYPE_LABELS[drift.driftType] ?? drift.driftType}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {relativeTime(drift.createdAt)}
              </span>
              <Badge variant={isPending ? "outline" : "secondary"}>
                {isPending ? "Pending" : drift.userDecision === "accepted" ? "Accepted" : "Rejected"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm">{drift.summary}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Recommendation: {drift.recommendation === "update_spec" ? "Update Spec" : drift.recommendation === "recenter_code" ? "Recenter Code" : drift.recommendation}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
