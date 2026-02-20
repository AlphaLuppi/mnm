"use client";

import { useState } from "react";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Pause, X, RefreshCw } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SpecChangeWarningProps {
  agentId: string;
  agentName: string;
  onViewDiff?: (filePath: string, oldSha: string, newSha: string) => void;
  onPauseAgent?: () => void;
  onTerminateAgent?: () => void;
}

interface SpecChangeItem {
  id: string;
  filePath: string;
  oldCommitSha: string | null;
  newCommitSha: string;
  changeSummary: string;
}

export function SpecChangeWarning({
  agentId,
  agentName,
  onViewDiff,
  onPauseAgent,
  onTerminateAgent,
}: SpecChangeWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useSWR(
    `/api/agents/${agentId}/spec-changes`,
    fetcher,
    { refreshInterval: 5_000 }
  );

  const changes: SpecChangeItem[] = data?.changes ?? [];

  if (dismissed || changes.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Spec Changed</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Agent {agentName} is working on a spec that changed. Review
          recommended.
        </p>
        <div className="flex flex-wrap gap-2">
          {changes[0]?.oldCommitSha && onViewDiff && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onViewDiff(
                  changes[0].filePath,
                  changes[0].oldCommitSha!,
                  changes[0].newCommitSha
                )
              }
            >
              <Eye className="mr-1 h-3 w-3" />
              View Diff
            </Button>
          )}
          {onPauseAgent && (
            <Button variant="outline" size="sm" onClick={onPauseAgent}>
              <Pause className="mr-1 h-3 w-3" />
              Pause Agent
            </Button>
          )}
          {onTerminateAgent && (
            <Button variant="outline" size="sm" onClick={onTerminateAgent}>
              <X className="mr-1 h-3 w-3" />
              Terminate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Acknowledge
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
