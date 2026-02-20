"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { GitCompare } from "lucide-react";
import { useDriftDetections } from "@/hooks/use-drift";
import { DriftCard } from "@/components/drift/drift-card";
import { CrossDocDriftPanel } from "@/components/drift/cross-doc-drift-panel";
import type { DriftDetection } from "@/lib/core/types";

export default function DriftPage() {
  const { drifts, isLoading } = useDriftDetections();
  const [tab, setTab] = useState("code-vs-spec");

  const pending = drifts.filter(
    (d) => d.userDecision === "pending" || !d.userDecision
  );
  const resolved = drifts.filter(
    (d) => d.userDecision === "accepted" || d.userDecision === "rejected"
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Drift Detection</h1>
        <p className="text-muted-foreground">
          Review when code diverges from specifications, or when specs are inconsistent with each other
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="code-vs-spec">
            Code vs Spec ({drifts.length})
          </TabsTrigger>
          <TabsTrigger value="cross-doc">Cross-Document</TabsTrigger>
        </TabsList>

        <TabsContent value="code-vs-spec" className="mt-4">
          <CodeVsSpecTab
            drifts={drifts}
            pending={pending}
            resolved={resolved}
            isLoading={isLoading}
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
}: {
  drifts: DriftDetection[];
  pending: DriftDetection[];
  resolved: DriftDetection[];
  isLoading: boolean;
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
          <p className="mt-4 text-sm text-muted-foreground">
            {subtab === "pending"
              ? "No pending drift detections."
              : subtab === "resolved"
                ? "No resolved drift detections."
                : "No drift detections yet. Drift is checked after agents complete work."}
          </p>
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
