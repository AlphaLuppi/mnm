"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SeverityBadge } from "@/components/shared/severity-badge";
import type { CrossDocDriftAlert } from "@/hooks/use-cross-doc-drift";
import { ArrowLeft, Check, X } from "lucide-react";

interface Props {
  drift: CrossDocDriftAlert;
  onBack: () => void;
  onResolve: (
    status: "resolved" | "dismissed",
    rationale?: string
  ) => Promise<void>;
}

export function CrossDocDriftDetail({ drift, onBack, onResolve }: Props) {
  const [rationale, setRationale] = useState("");
  const [resolving, setResolving] = useState(false);

  async function handleResolve(status: "resolved" | "dismissed") {
    setResolving(true);
    try {
      await onResolve(status, rationale || undefined);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to list
      </Button>

      <div className="flex items-center gap-3">
        <SeverityBadge severity={drift.severity} />
        <Badge variant="outline">{drift.driftType}</Badge>
        <Badge variant={drift.status === "open" ? "default" : "secondary"}>
          {drift.status}
        </Badge>
      </div>

      <p className="text-sm">{drift.description}</p>

      {/* Side-by-side comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Source (Upstream)
              {drift.sourceSpec && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {drift.sourceSpec.title ?? drift.sourceSpec.filePath}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drift.sourceText ? (
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs font-mono">
                {drift.sourceText}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                No source text available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Target (Downstream)
              {drift.targetSpec && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {drift.targetSpec.title ?? drift.targetSpec.filePath}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drift.targetText ? (
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs font-mono">
                {drift.targetText}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                No target text available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resolution */}
      {drift.status === "open" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resolve Drift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Optional: explain how this was resolved..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleResolve("resolved")}
                disabled={resolving}
                size="sm"
              >
                <Check className="mr-2 h-4 w-4" />
                Resolve
              </Button>
              <Button
                onClick={() => handleResolve("dismissed")}
                disabled={resolving}
                variant="outline"
                size="sm"
              >
                <X className="mr-2 h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {drift.status !== "open" && drift.resolutionRationale && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{drift.resolutionRationale}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
