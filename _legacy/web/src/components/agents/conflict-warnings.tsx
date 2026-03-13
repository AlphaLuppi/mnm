"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { Agent } from "@/lib/core/types";

export interface Conflict {
  agentA: { id: string; name: string };
  agentB: { id: string; name: string };
  sharedFiles: string[];
}

export function detectClientConflicts(agents: Agent[]): Conflict[] {
  const running = agents.filter(
    (a) => a.status === "running" || a.status === "paused"
  );
  const conflicts: Conflict[] = [];

  for (let i = 0; i < running.length; i++) {
    for (let j = i + 1; j < running.length; j++) {
      const scopeA = parseScopeJson(running[i].scope);
      const scopeB = parseScopeJson(running[j].scope);
      const shared = scopeA.filter((f) => scopeB.includes(f));

      if (shared.length > 0) {
        conflicts.push({
          agentA: { id: running[i].id, name: running[i].name },
          agentB: { id: running[j].id, name: running[j].name },
          sharedFiles: shared,
        });
      }
    }
  }

  return conflicts;
}

function parseScopeJson(scope: string | null): string[] {
  if (!scope) return [];
  try {
    return JSON.parse(scope) as string[];
  } catch {
    return [];
  }
}

export function ConflictWarnings({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {conflicts.map((c, i) => (
        <Alert key={i} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Scope Conflict</AlertTitle>
          <AlertDescription>
            <strong>{c.agentA.name}</strong> and{" "}
            <strong>{c.agentB.name}</strong> share files:{" "}
            {c.sharedFiles.length <= 3
              ? c.sharedFiles.join(", ")
              : `${c.sharedFiles.slice(0, 3).join(", ")} +${c.sharedFiles.length - 3} more`}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
