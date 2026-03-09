"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GitCompare, Search, Clock } from "lucide-react";
import { useDriftDetections, useDriftStatus } from "@/hooks/use-drift";
import { DriftCard } from "@/components/drift/drift-card";
import { CrossDocDriftPanel } from "@/components/drift/cross-doc-drift-panel";
import { launchTask } from "@/hooks/use-tasks";
import type { DriftDetection } from "@/lib/core/types";

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function DriftPage() {
  const { drifts, isLoading } = useDriftDetections();
  const { status } = useDriftStatus();
  const [tab, setTab] = useState("code-vs-spec");

  const pending = drifts.filter(
    (d) => d.userDecision === "pending" || !d.userDecision
  );
  const resolved = drifts.filter(
    (d) => d.userDecision === "accepted" || d.userDecision === "rejected"
  );

  function handleScanClick() {
    launchTask("scan-cross-doc-drift");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drift Detection</h1>
          <p className="text-muted-foreground">
            Review when code diverges from specifications, or when specs are inconsistent with each other
          </p>
        </div>
        <Button onClick={handleScanClick}>
          <Search className="mr-2 h-4 w-4" />
          Scan for Drift
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="code-vs-spec">
              Code vs Spec ({drifts.length})
            </TabsTrigger>
            <TabsTrigger value="cross-doc">Cross-Document</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {status?.lastScanAt
              ? `Last scanned: ${formatRelativeTime(status.lastScanAt)}`
              : "No scans yet"}
          </div>
        </div>

        <TabsContent value="code-vs-spec" className="mt-4">
          <CodeVsSpecTab
            drifts={drifts}
            pending={pending}
            resolved={resolved}
            isLoading={isLoading}
            onScanClick={handleScanClick}
          />
        </TabsContent>

        <TabsContent value="cross-doc" className="mt-4">
          <CrossDocDriftPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CodeVsSpecTab({
  drifts,
  pending,
  resolved,
  isLoading,
  onScanClick,
}: {
  drifts: DriftDetection[];
  pending: DriftDetection[];
  resolved: DriftDetection[];
  isLoading: boolean;
  onScanClick: () => void;
}) {
  const [subtab, setSubtab] = useState("all");

  const displayed =
    subtab === "pending"
      ? pending
      : subtab === "resolved"
        ? resolved
        : drifts;

  const sorted = [...displayed].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSubtab("all")}
          className={`rounded-md px-3 py-1 text-sm ${subtab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          All ({drifts.length})
        </button>
        <button
          onClick={() => setSubtab("pending")}
          className={`rounded-md px-3 py-1 text-sm ${subtab === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setSubtab("resolved")}
          className={`rounded-md px-3 py-1 text-sm ${subtab === "resolved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Resolved ({resolved.length})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <GitCompare className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-medium">No drift detected</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {subtab === "pending"
              ? "No pending drift detections. All detected drifts have been resolved."
              : subtab === "resolved"
                ? "No resolved drift detections yet."
                : "Click \"Scan for Drift\" to check if your code matches your specifications."}
          </p>
          {subtab === "all" && (
            <Button onClick={onScanClick} className="mt-4">
              <Search className="mr-2 h-4 w-4" />
              Scan for Drift
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((drift) => (
            <DriftCard key={drift.id} drift={drift} />
          ))}
        </div>
      )}
    </div>
  );
}
