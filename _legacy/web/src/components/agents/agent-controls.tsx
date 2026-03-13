"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pause, Play, Square } from "lucide-react";
import type { Agent } from "@/lib/core/types";

interface AgentControlsProps {
  agent: Agent;
  onAction: (action: "pause" | "resume" | "terminate") => Promise<void>;
}

export function AgentControls({ agent, onAction }: AgentControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const isActive = agent.status === "running" || agent.status === "paused";

  async function handleAction(action: "pause" | "resume" | "terminate") {
    setLoading(action);
    try {
      await onAction(action);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      {agent.status === "running" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("pause")}
          disabled={loading !== null}
        >
          <Pause className="h-4 w-4 mr-1" />
          {loading === "pause" ? "..." : "Pause"}
        </Button>
      )}
      {agent.status === "paused" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("resume")}
          disabled={loading !== null}
        >
          <Play className="h-4 w-4 mr-1" />
          {loading === "resume" ? "..." : "Resume"}
        </Button>
      )}
      {isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={loading !== null}>
              <Square className="h-4 w-4 mr-1" />
              Terminate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Terminate {agent.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will stop the agent and release all file locks. The agent
                record will be preserved for history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleAction("terminate")}>
                Terminate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
