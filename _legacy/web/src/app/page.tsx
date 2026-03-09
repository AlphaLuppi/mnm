"use client";

import Link from "next/link";
import {
  FileText,
  Bot,
  GitCompare,
  GitBranch,
  CheckCircle2,
  Terminal,
  Users,
  Loader2,
  Search,
  Workflow,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/use-dashboard";
import type { ProviderState, ProviderSession } from "@/lib/providers/types";

function formatTimeAgo(epoch: number): string {
  const diff = Date.now() - epoch;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SessionCard({ session }: { session: ProviderSession }) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${session.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`}
          />
          <code className="text-xs">{session.id.slice(0, 8)}</code>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(session.lastActivity)}
        </span>
      </div>
      {session.branch && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <span>{session.branch}</span>
        </div>
      )}
      {session.agents.length > 0 && (
        <div className="space-y-1 pl-3 border-l-2 border-muted">
          {session.agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Bot className="h-3 w-3" />
              <span>{agent.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ state }: { state: ProviderState }) {
  const activeSessions = state.sessions.filter((s) => s.isActive);
  const recentSessions = state.sessions.slice(0, 5);
  const agentCommands = state.commands.filter((c) => c.category === "agent");
  const workflowCommands = state.commands.filter(
    (c) => c.category === "workflow"
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <CardTitle className="text-base">Claude Code</CardTitle>
          </div>
          {state.presence.version && (
            <Badge variant="outline" className="text-xs font-mono">
              {state.presence.version}
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            {state.presence.installed ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
            )}
            {state.presence.installed ? "Installed" : "Not installed"}
          </span>
          <span className="flex items-center gap-1">
            {state.presence.configured ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
            )}
            {state.presence.configured ? "Configured" : "Not configured"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <strong>{activeSessions.length}</strong> active session
            {activeSessions.length !== 1 ? "s" : ""}
          </span>
          <span>
            <strong>{state.teams.length}</strong> team
            {state.teams.length !== 1 ? "s" : ""}
          </span>
        </div>

        {recentSessions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {activeSessions.length > 0 ? "Active Sessions" : "Recent Sessions"}
            </h4>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {state.teams.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Teams</h4>
            {state.teams.map((team) => (
              <div key={team.name} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{team.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {team.members.length} member
                    {team.members.length !== 1 ? "s" : ""}
                    {team.taskCount
                      ? ` / ${team.taskCount} task${team.taskCount !== 1 ? "s" : ""}`
                      : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {state.commands.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {state.commands.length} command{state.commands.length !== 1 ? "s" : ""}{" "}
            available
            {agentCommands.length > 0 &&
              ` (${agentCommands.length} agent${agentCommands.length !== 1 ? "s" : ""}`}
            {workflowCommands.length > 0 &&
              `${agentCommands.length > 0 ? ", " : " ("}${workflowCommands.length} workflow${workflowCommands.length !== 1 ? "s" : ""}`}
            {(agentCommands.length > 0 || workflowCommands.length > 0) && ")"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { dashboard, isLoading } = useDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to MnM -- Product-First Agent Development Environment
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Specs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                dashboard?.specs?.total ?? "--"
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              indexed specifications
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                dashboard?.agents?.running ?? 0
              )}
            </p>
            <p className="text-xs text-muted-foreground">running agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                dashboard?.workflows?.total ?? 0
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              <Link href="/workflows" className="hover:underline">
                discovered workflows
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discovery</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                dashboard?.discovery?.total ?? 0
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              artifacts discovered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second row: Drift + Git */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Code Drift</CardTitle>
            <GitCompare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                dashboard?.drift?.pending ?? 0
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              <Link href="/drift" className="hover:underline">
                pending code-vs-spec detections
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cross-Doc Drift
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                dashboard?.crossDocDrift?.open ?? 0
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              <Link href="/drift" className="hover:underline">
                open spec inconsistencies
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Git</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboard?.git ? (
              <>
                <p className="text-2xl font-bold font-mono">
                  {dashboard.git.branch}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {dashboard.git.head} {dashboard.git.message}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "--"
                  )}
                </p>
                <p className="text-xs text-muted-foreground">no repository</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {dashboard?.providers?.map((provider) => (
        <ProviderCard key={provider.provider} state={provider} />
      ))}
    </div>
  );
}
