import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, Users, Link2, ArrowLeft } from "lucide-react";
import { bmadApi, type DiscoveredBmadAgent } from "../api/bmad";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import type { Agent } from "@mnm/shared";

const ROLE_LABELS: Record<string, string> = {
  engineer: "Engineer", pm: "Product Manager", cto: "Architect", qa: "QA",
  designer: "Designer", researcher: "Analyst", general: "General", ceo: "Master",
};

// Smart role matching: BMAD role → MnM role that best fits
const BMAD_TO_MNM_ROLE: Record<string, string[]> = {
  dev: ["engineer"],
  "quick-flow-solo-dev": ["engineer", "cto"],
  architect: ["cto", "engineer"],
  pm: ["pm"],
  qa: ["qa"],
  "ux-designer": ["designer"],
  analyst: ["researcher"],
  sm: ["general", "pm"],
  "tech-writer": ["general"],
  "bmad-master": ["ceo"],
};

function findSuggestedAgent(bmadRole: string, agents: Agent[]): Agent | null {
  const preferredMnmRoles = BMAD_TO_MNM_ROLE[bmadRole] ?? [];
  for (const mnmRole of preferredMnmRoles) {
    const match = agents.find((a) => a.role === mnmRole && a.status !== "terminated");
    if (match) return match;
  }
  return null;
}

// "__new__" sentinel means "create a new MnM agent"
// "__skip__" sentinel means "skip this BMAD agent"
const SENTINEL_NEW = "__new__";
const SENTINEL_SKIP = "__skip__";

// Suppress unused import warning — DiscoveredBmadAgent is used via bmadApi response type
void (null as unknown as DiscoveredBmadAgent);

interface BmadAgentSyncProps {
  projectId: string;
  companyId: string;
}

export function BmadAgentSync({ projectId, companyId }: BmadAgentSyncProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"card" | "assigning">("card");
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const { data: discoveredData, isLoading } = useQuery({
    queryKey: ["bmad-agents-discovery", projectId],
    queryFn: () => bmadApi.getAgents(projectId, companyId),
  });

  const { data: existingAgents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });

  const { data: savedAssignmentsData } = useQuery({
    queryKey: ["bmad-assignments", projectId],
    queryFn: () => bmadApi.getAssignments(projectId, companyId),
  });

  const discovered = discoveredData?.agents ?? [];
  const savedAssignments = savedAssignmentsData?.assignments ?? {};

  // Agents that can be selected (not terminated)
  const selectableAgents = useMemo(
    () => existingAgents.filter((a) => a.status !== "terminated"),
    [existingAgents],
  );

  // Check which BMAD slugs are already assigned (have an assignment OR were previously imported)
  const assignedSlugs = useMemo(() => {
    const slugs = new Set<string>(Object.keys(savedAssignments));
    // Also check agents with bmad metadata (previously imported)
    for (const agent of existingAgents) {
      const bmadMeta = (agent.metadata as Record<string, unknown> | null)?.bmad as Record<string, unknown> | undefined;
      if (bmadMeta?.slug) slugs.add(String(bmadMeta.slug));
      const roles = bmadMeta?.roles as Array<{ slug: string }> | undefined;
      if (roles) for (const r of roles) slugs.add(r.slug);
    }
    return slugs;
  }, [existingAgents, savedAssignments]);

  const unassigned = discovered.filter((a) => !assignedSlugs.has(a.slug));
  const allAssigned = discovered.length > 0 && unassigned.length === 0;

  // Initialize assignments with smart defaults when opening assignment step
  function openAssigning() {
    const initial: Record<string, string> = {};
    for (const agent of discovered) {
      if (assignedSlugs.has(agent.slug)) {
        // Already assigned — find the agent
        initial[agent.slug] = savedAssignments[agent.slug] ?? SENTINEL_SKIP;
      } else {
        const suggested = findSuggestedAgent(agent.role, selectableAgents);
        initial[agent.slug] = suggested?.id ?? SENTINEL_NEW;
      }
    }
    setAssignments(initial);
    setStep("assigning");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalAssignments: Record<string, string> = {};

      for (const [slug, value] of Object.entries(assignments)) {
        if (value === SENTINEL_SKIP) continue;

        let targetAgentId: string;
        const bmadAgent = discovered.find((a) => a.slug === slug)!;

        if (value === SENTINEL_NEW) {
          // Create new MnM agent
          const { AGENT_ROLES } = await import("@mnm/shared");
          const validRoles = new Set(AGENT_ROLES);
          const role = validRoles.has(bmadAgent.role as typeof AGENT_ROLES[number])
            ? (bmadAgent.role as typeof AGENT_ROLES[number])
            : "general";
          const newAgent = await agentsApi.create(companyId, {
            name: `${bmadAgent.personaName} (BMAD)`,
            title: bmadAgent.title,
            role,
            capabilities: bmadAgent.capabilities ?? null,
            adapterType: "claude_local",
            adapterConfig: {},
            runtimeConfig: {},
            status: "idle",
            budgetMonthlyCents: 0,
            spentMonthlyCents: 0,
            lastHeartbeatAt: null,
            metadata: {
              bmad: {
                slug,
                roles: [{
                  slug,
                  personaName: bmadAgent.personaName,
                  capabilities: bmadAgent.capabilities,
                  icon: bmadAgent.icon,
                }],
              },
            },
          });
          targetAgentId = newAgent.id;
        } else {
          targetAgentId = value;
          // Merge BMAD role into existing agent metadata
          const agent = selectableAgents.find((a) => a.id === targetAgentId);
          if (agent) {
            const existingMeta = (agent.metadata ?? {}) as Record<string, unknown>;
            const existingBmad = (existingMeta.bmad ?? {}) as Record<string, unknown>;
            const existingRoles = (existingBmad.roles ?? []) as Array<{ slug: string }>;
            if (!existingRoles.some((r) => r.slug === slug)) {
              await agentsApi.update(targetAgentId, {
                metadata: {
                  ...existingMeta,
                  bmad: {
                    ...existingBmad,
                    roles: [
                      ...existingRoles,
                      {
                        slug,
                        personaName: bmadAgent.personaName,
                        capabilities: bmadAgent.capabilities,
                        icon: bmadAgent.icon,
                      },
                    ],
                  },
                },
              }, companyId);
            }
          }
        }

        finalAssignments[slug] = targetAgentId;
      }

      await bmadApi.saveAssignments(projectId, finalAssignments, companyId);
    },
    onSuccess: () => {
      pushToast({
        title: "Assignments saved",
        body: "BMAD agents are now linked to your MnM agents.",
        tone: "success",
      });
      setStep("card");
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      queryClient.invalidateQueries({ queryKey: ["bmad-assignments", projectId] });
    },
    onError: (err) => {
      pushToast({
        title: "Failed to save assignments",
        body: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Scanning workspace for BMAD agents...
      </div>
    );
  }

  if (discovered.length === 0) return null;

  // --- Assignment step ---
  if (step === "assigning") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep("card")}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold flex-1">Assign BMAD agents to your MnM agents</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose which MnM agent handles each BMAD role. The chosen agent will receive the BMAD persona context when launched.
        </p>

        <div className="space-y-3">
          {discovered.map((bmadAgent) => {
            const currentValue = assignments[bmadAgent.slug] ?? SENTINEL_NEW;
            const isAlreadyAssigned = assignedSlugs.has(bmadAgent.slug) && currentValue !== SENTINEL_NEW && currentValue !== SENTINEL_SKIP;

            return (
              <div key={bmadAgent.slug} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{bmadAgent.icon ?? "🤖"}</span>
                  <span className="text-sm font-semibold">{bmadAgent.personaName}</span>
                  <span className="text-xs font-mono text-muted-foreground">{bmadAgent.commandName}</span>
                  {isAlreadyAssigned && (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium ml-auto">
                      <Check className="h-3 w-3" /> Assigned
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {/* Existing MnM agents */}
                  {selectableAgents.map((agent) => {
                    const suggested = findSuggestedAgent(bmadAgent.role, selectableAgents)?.id === agent.id;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setAssignments((prev) => ({ ...prev, [bmadAgent.slug]: agent.id }))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1",
                          currentValue === agent.id
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground/40 hover:bg-accent/50",
                        )}
                      >
                        {agent.name}
                        {suggested && currentValue !== agent.id && (
                          <span className="text-[9px] text-muted-foreground opacity-70">★</span>
                        )}
                      </button>
                    );
                  })}
                  {/* Create new */}
                  <button
                    type="button"
                    onClick={() => setAssignments((prev) => ({ ...prev, [bmadAgent.slug]: SENTINEL_NEW }))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      currentValue === SENTINEL_NEW
                        ? "border-foreground bg-foreground text-background"
                        : "border-border border-dashed hover:border-foreground/40 hover:bg-accent/50 text-muted-foreground",
                    )}
                  >
                    + Créer un agent
                  </button>
                  {/* Skip */}
                  <button
                    type="button"
                    onClick={() => setAssignments((prev) => ({ ...prev, [bmadAgent.slug]: SENTINEL_SKIP }))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      currentValue === SENTINEL_SKIP
                        ? "border-foreground bg-foreground text-background"
                        : "border-border border-dashed hover:border-foreground/40 hover:bg-accent/50 text-muted-foreground",
                    )}
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep("card")}
            disabled={saveMutation.isPending}
          >
            Annuler
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="gap-1.5"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Sauvegarder
          </Button>
        </div>
      </div>
    );
  }

  // --- Card step ---
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-violet-500/10 p-2 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">BMAD agents detected</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {discovered.length} agent{discovered.length > 1 ? "s" : ""} found in your workspace.
            {allAssigned
              ? " All assigned to MnM agents."
              : ` ${unassigned.length} not yet assigned.`}
          </p>
        </div>
        <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {/* Quick summary of assignments */}
      <div className="grid grid-cols-1 gap-1.5">
        {discovered.map((agent) => {
          const assignedAgentId = savedAssignments[agent.slug];
          const assignedAgent = assignedAgentId ? existingAgents.find((a) => a.id === assignedAgentId) : null;
          const isAssigned = assignedSlugs.has(agent.slug);

          return (
            <div
              key={agent.slug}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs bg-muted/40"
            >
              <span>{agent.icon ?? "🤖"}</span>
              <span className="font-medium">{agent.personaName}</span>
              <span className="text-muted-foreground font-mono">{agent.commandName}</span>
              <div className="flex-1" />
              {assignedAgent ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Link2 className="h-3 w-3" />
                  {assignedAgent.name}
                </span>
              ) : isAssigned ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> Linked
                </span>
              ) : (
                <span className="text-muted-foreground/60 italic">non assigné</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1" />
        <Button
          size="sm"
          variant={allAssigned ? "outline" : "default"}
          onClick={openAssigning}
          className="gap-1.5"
        >
          <Link2 className="h-3.5 w-3.5" />
          {allAssigned ? "Modifier les assignments" : "Assigner les agents"}
        </Button>
      </div>
    </div>
  );
}

// Re-export ROLE_LABELS for potential reuse
export { ROLE_LABELS };
