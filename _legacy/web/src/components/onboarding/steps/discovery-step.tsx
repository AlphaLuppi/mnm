"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, FileText, Bot, GitBranch, Terminal } from "lucide-react";

interface DiscoverySummary {
  workflows: number;
  specs: number;
  agents: number;
  commands: number;
  total: number;
}

export function DiscoveryStep() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch("/api/discovery/scan", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        const s = data.summary ?? {};
        setSummary({
          workflows: s.workflows ?? 0,
          specs: s.specs ?? 0,
          agents: s.agents ?? 0,
          commands: s.commands ?? 0,
          total: s.total ?? 0,
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Discovery failed");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Running Auto-Discovery...</p>
        <p className="text-xs text-muted-foreground">
          Scanning your repository for workflows, specs, agents, and configurations
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Auto-Discovery</h2>
        <p className="text-sm text-red-500">
          Discovery encountered an issue: {error}
        </p>
        <p className="text-xs text-muted-foreground">
          You can re-run discovery later from the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <h2 className="text-xl font-semibold">Discovery Complete</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        MnM scanned your repository and found {summary?.total ?? 0} artifacts:
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-md border p-3">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-bold">{summary?.workflows ?? 0}</p>
            <p className="text-xs text-muted-foreground">Workflows</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border p-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-bold">{summary?.specs ?? 0}</p>
            <p className="text-xs text-muted-foreground">Specs</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border p-3">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-bold">{summary?.agents ?? 0}</p>
            <p className="text-xs text-muted-foreground">Agents</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border p-3">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-bold">{summary?.commands ?? 0}</p>
            <p className="text-xs text-muted-foreground">Commands</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        You can view all discovered artifacts from the dashboard and trigger re-scans anytime.
      </p>
    </div>
  );
}
