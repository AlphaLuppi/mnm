"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAgents } from "@/hooks/use-agents";
import { AvailableAgents } from "@/components/agents/available-agents";
import { AgentTable } from "@/components/agents/agent-table";
import { LaunchAgentDialog } from "@/components/agents/launch-agent-dialog";
import {
  ConflictWarnings,
  detectClientConflicts,
} from "@/components/agents/conflict-warnings";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentsPage() {
  const { agents, isLoading, mutate } = useAgents();
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [initialAgentType, setInitialAgentType] = useState<string | undefined>();

  const conflicts = detectClientConflicts(agents);

  function handleLaunch(agentType: string) {
    setInitialAgentType(agentType);
    setLaunchDialogOpen(true);
  }

  async function handleAgentAction(
    agentId: string,
    action: "pause" | "resume" | "terminate"
  ) {
    await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Dashboard</h1>
        <p className="text-muted-foreground">
          Manage AI agents for your development workflow
        </p>
      </div>

      <Separator />

      <section>
        <h2 className="text-lg font-semibold mb-4">Available Agents</h2>
        <AvailableAgents onLaunch={handleLaunch} />
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-semibold mb-4">Running Agents</h2>

        <ConflictWarnings conflicts={conflicts} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {agents.filter(
                (a) => a.status === "running" || a.status === "paused"
              ).length}{" "}
              active /{" "}
              {agents.length} total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <AgentTable agents={agents} onAction={handleAgentAction} />
            )}
          </CardContent>
        </Card>
      </section>

      <LaunchAgentDialog
        open={launchDialogOpen}
        onOpenChange={setLaunchDialogOpen}
        initialAgentType={initialAgentType}
        onLaunched={() => mutate()}
      />
    </div>
  );
}
