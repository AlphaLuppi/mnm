"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { AcceptDriftDialog } from "@/components/drift/accept-drift-dialog";
import { RejectDriftDialog } from "@/components/drift/reject-drift-dialog";
import { DiffViewer } from "@/components/shared/diff-viewer";
import { useDriftDetail } from "@/hooks/use-drift";
import { toast } from "sonner";

const DRIFT_TYPE_LABELS: Record<string, string> = {
  scope_expansion: "Scope Expansion",
  approach_change: "Approach Change",
  design_deviation: "Design Deviation",
};

export default function DriftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { drift, isLoading, mutate } = useDriftDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!drift) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Drift detection not found.</p>
        <Link href="/drift">
          <Button variant="outline">Back to Drift List</Button>
        </Link>
      </div>
    );
  }

  const isPending = drift.userDecision === "pending" || !drift.userDecision;

  async function handleAccept() {
    const res = await fetch(`/api/drift/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "accepted" }),
    });
    if (res.ok) {
      toast.success("Drift accepted. Update your spec to match the implementation.");
      mutate();
    } else {
      toast.error("Failed to accept drift.");
    }
  }

  async function handleReject(taskTitle: string, notes: string) {
    const res = await fetch(`/api/drift/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "rejected", taskTitle, notes }),
    });
    if (res.ok) {
      toast.success("Drift rejected. Remediation task created.");
      mutate();
    } else {
      toast.error("Failed to reject drift.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/drift">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SeverityBadge severity={drift.severity} />
              <CardTitle className="text-lg">
                {DRIFT_TYPE_LABELS[drift.driftType] ?? drift.driftType}
              </CardTitle>
            </div>
            <Badge variant={isPending ? "outline" : "secondary"}>
              {isPending
                ? "Pending"
                : drift.userDecision === "accepted"
                  ? "Accepted"
                  : "Rejected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Summary</h3>
            <p className="text-sm text-muted-foreground">{drift.summary}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Recommendation</h3>
            <p className="text-sm text-muted-foreground">
              {drift.recommendation === "update_spec"
                ? "Update the spec to match the implementation."
                : drift.recommendation === "recenter_code"
                  ? "Fix the code to match the spec."
                  : drift.recommendation}
            </p>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Agent: {drift.agentId.slice(0, 8)}...</span>
            <span>Spec: {drift.specId.slice(0, 8)}...</span>
          </div>
        </CardContent>
      </Card>

      {drift.diffContent && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Code Changes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-80">
              <DiffViewer
                oldContent=""
                newContent={drift.diffContent}
                oldTitle="Spec Intent"
                newTitle="Implementation"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <div className="flex gap-3">
          <AcceptDriftDialog
            driftId={drift.id}
            summary={drift.summary}
            onAccept={handleAccept}
          />
          <RejectDriftDialog
            specTitle={drift.specId}
            onReject={handleReject}
          />
        </div>
      )}
    </div>
  );
}
