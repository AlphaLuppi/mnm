import type { Agent } from "@/lib/core/types";

export interface Conflict {
  agentA: { id: string; name: string };
  agentB: { id: string; name: string };
  sharedFiles: string[];
}

export function detectConflicts(agents: Agent[]): Conflict[] {
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

export function checkNewAgentConflicts(
  scope: string[],
  runningAgents: Agent[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const agent of runningAgents) {
    if (agent.status !== "running" && agent.status !== "paused") continue;
    const agentScope = parseScopeJson(agent.scope);
    const shared = scope.filter((f) => agentScope.includes(f));

    if (shared.length > 0) {
      conflicts.push({
        agentA: { id: "new", name: "New Agent" },
        agentB: { id: agent.id, name: agent.name },
        sharedFiles: shared,
      });
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
