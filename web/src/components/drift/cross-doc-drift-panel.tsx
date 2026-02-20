"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/shared/severity-badge";
import {
  useCrossDocDrifts,
  type CrossDocDriftAlert,
} from "@/hooks/use-cross-doc-drift";
import { CrossDocDriftDetail } from "./cross-doc-drift-detail";
import { FileText, RefreshCw, Loader2 } from "lucide-react";

export function CrossDocDriftPanel() {
  const { drifts, isLoading, triggerScan, resolveDrift } =
    useCrossDocDrifts();
  const [scanning, setScanning] = useState(false);
  const [selectedDrift, setSelectedDrift] =
    useState<CrossDocDriftAlert | null>(null);

  const openDrifts = drifts.filter((d) => d.status === "open");
  const resolvedDrifts = drifts.filter(
    (d) => d.status === "resolved" || d.status === "dismissed"
  );

  async function handleScan() {
    setScanning(true);
    try {
      await triggerScan();
    } finally {
      setScanning(false);
    }
  }

  if (selectedDrift) {
    return (
      <CrossDocDriftDetail
        drift={selectedDrift}
        onBack={() => setSelectedDrift(null)}
        onResolve={async (status, rationale) => {
          await resolveDrift(selectedDrift.id, status, rationale);
          setSelectedDrift(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cross-Document Drift</h2>
          <p className="text-sm text-muted-foreground">
            Inconsistencies between specification documents
          </p>
        </div>
        <Button
          onClick={handleScan}
          disabled={scanning}
          variant="outline"
          size="sm"
        >
          {scanning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {scanning ? "Scanning..." : "Scan for Drift"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : openDrifts.length === 0 && resolvedDrifts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No cross-document drift detected. Click &quot;Scan for Drift&quot;
              to check for inconsistencies between your spec documents.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {openDrifts.length > 0 && (
            <>
              <h3 className="text-sm font-medium">
                Open ({openDrifts.length})
              </h3>
              {openDrifts.map((drift) => (
                <CrossDocDriftCard
                  key={drift.id}
                  drift={drift}
                  onClick={() => setSelectedDrift(drift)}
                />
              ))}
            </>
          )}
          {resolvedDrifts.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-muted-foreground mt-6">
                Resolved ({resolvedDrifts.length})
              </h3>
              {resolvedDrifts.map((drift) => (
                <CrossDocDriftCard
                  key={drift.id}
                  drift={drift}
                  onClick={() => setSelectedDrift(drift)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CrossDocDriftCard({
  drift,
  onClick,
}: {
  drift: CrossDocDriftAlert;
  onClick: () => void;
}) {
  const isOpen = drift.status === "open";

  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${!isOpen ? "opacity-60" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={drift.severity} />
            <Badge variant="outline" className="text-xs">
              {drift.driftType}
            </Badge>
          </div>
          <Badge variant={isOpen ? "default" : "secondary"}>
            {drift.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm">{drift.description}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          {drift.sourceSpec && (
            <span>
              Source: {drift.sourceSpec.title ?? drift.sourceSpec.filePath}
            </span>
          )}
          {drift.targetSpec && (
            <span>
              Target: {drift.targetSpec.title ?? drift.targetSpec.filePath}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
