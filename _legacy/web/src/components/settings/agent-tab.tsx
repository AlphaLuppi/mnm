"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MnMConfig } from "@/lib/core/config";

interface AgentTabProps {
  config: MnMConfig;
  onUpdate: (patch: Record<string, unknown>) => void;
}

export function AgentTab({ config, onUpdate }: AgentTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="agent-type">Default Agent Type</Label>
          <Select
            value={config.defaultAgentType}
            onValueChange={(v) => onUpdate({ defaultAgentType: v })}
          >
            <SelectTrigger className="w-44" id="agent-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tdd">TDD</SelectItem>
              <SelectItem value="implementation">Implementation</SelectItem>
              <SelectItem value="e2e">E2E Testing</SelectItem>
              <SelectItem value="review">Code Review</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="max-agents">Max Concurrent Agents</Label>
            <p className="text-xs text-muted-foreground">1-10 agents</p>
          </div>
          <Input
            id="max-agents"
            type="number"
            min={1}
            max={10}
            className="w-20"
            value={config.maxConcurrentAgents}
            onChange={(e) =>
              onUpdate({
                maxConcurrentAgents: Math.min(
                  10,
                  Math.max(1, parseInt(e.target.value) || 1)
                ),
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="timeout">Agent Timeout (seconds)</Label>
            <p className="text-xs text-muted-foreground">
              Max time before auto-termination
            </p>
          </div>
          <Input
            id="timeout"
            type="number"
            min={30}
            max={3600}
            className="w-24"
            value={config.agentTimeoutSeconds}
            onChange={(e) =>
              onUpdate({
                agentTimeoutSeconds: Math.min(
                  3600,
                  Math.max(30, parseInt(e.target.value) || 300)
                ),
              })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
