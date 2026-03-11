import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Loader2, Sparkles, Users, Link2, ArrowLeft, Clock, Globe, Lock } from "lucide-react";
import { workspaceContextApi, type DiscoveredWorkspaceAgent } from "../api/workspaceContext";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import type { Agent } from "@mnm/shared";

// Suppress unused import warning — DiscoveredWorkspaceAgent is used via workspaceContextApi response type
void (null as unknown as DiscoveredWorkspaceAgent);

type MappingMode = "global" | "workspace" | "new-global";

interface AgentMappingState {
  mode: MappingMode;
  agentId?: string;   // for "global": existing agent id
  config?: string;    // for "global": workspace-specific instruction
}

interface WorkspaceAgentSyncProps {
  projectId: string;
  companyId: string;
}

function findSuggestedAgent(mnmRole: string, agents: Agent[]): Agent | null {
  return agents.find((a) => a.role === mnmRole && a.status !== "terminated") ?? null;
}

export function WorkspaceAgentSync({ projectId, companyId }: WorkspaceAgentSyncProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"card" | "assigning">("card");
  const [mappings, setMappings] = useState<Record<string, AgentMappingState>>({});
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set());

  const { data: discoveredData, isLoading } = useQuery({
    queryKey: ["workspace-agents-discovery", projectId],
    queryFn: () => workspaceContextApi.getAgents(projectId, companyId),
  });

  const { data: savedAssignmentsData } = useQuery({
    queryKey: ["workspace-assignments", projectId],
    queryFn: () => workspaceContextApi.getAssignments(projectId, companyId),
  });

  const workspaceId = savedAssignmentsData?.workspaceId ?? null;

  // Load agents: global + scoped for this workspace once workspaceId is known
  const { data: existingAgents = [] } = useQuery({
    queryKey: workspaceId
      ? queryKeys.agents.listForWorkspace(companyId, workspaceId)
      : queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId, workspaceId ? { workspaceId } : undefined),
  });

  const discovered = discoveredData?.agents ?? [];
  const savedAssignments = savedAssignmentsData?.assignments ?? {};

  // Global agents only (not scoped to any workspace)
  const globalAgents = useMemo(
    () => existingAgents.filter((a) => a.status !== "terminated" && !a.scopedToWorkspaceId),
    [existingAgents],
  );

  // Workspace-scoped agents for this workspace
  const scopedAgents = useMemo(
    () => existingAgents.filter((a) => workspaceId && a.scopedToWorkspaceId === workspaceId),
    [existingAgents, workspaceId],
  );

  const assignedSlugs = useMemo(() => {
    const slugs = new Set<string>(Object.keys(savedAssignments));
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

  function openAssigning() {
    const initial: Record<string, AgentMappingState> = {};
    for (const agent of discovered) {
      const existingAssignedId = savedAssignments[agent.slug];
      if (existingAssignedId && existingAgents.some((a) => a.id === existingAssignedId)) {
        const isScoped = existingAgents.find((a) => a.id === existingAssignedId)?.scopedToWorkspaceId;
        initial[agent.slug] = isScoped
          ? { mode: "workspace" }
          : { mode: "global", agentId: existingAssignedId, config: "" };
      } else {
        // Suggest a global agent if role matches, else default to workspace-only
        const suggested = agent.role !== "general" ? findSuggestedAgent(agent.role, globalAgents) : null;
        initial[agent.slug] = suggested
          ? { mode: "global", agentId: suggested.id, config: "" }
          : { mode: "workspace" };
      }
    }
    setMappings(initial);
    setExpandedConfigs(new Set());
    setStep("assigning");
  }

  function setMode(slug: string, mode: MappingMode) {
    setMappings((prev) => ({
      ...prev,
      [slug]: mode === "global"
        ? { mode, agentId: prev[slug]?.agentId ?? "", config: prev[slug]?.config ?? "" }
        : { mode },
    }));
  }

  function setAgentId(slug: string, agentId: string) {
    setMappings((prev) => ({ ...prev, [slug]: { ...prev[slug], mode: "global", agentId, config: prev[slug]?.config ?? "" } }));
  }

  function setConfig(slug: string, config: string) {
    setMappings((prev) => ({ ...prev, [slug]: { ...prev[slug], config } }));
  }

  function toggleConfig(slug: string) {
    setExpandedConfigs((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  // Every discovered agent must be fully configured before confirming
  const canSave = useMemo(
    () => discovered.every((wsAgent) => {
      const m = mappings[wsAgent.slug];
      if (!m) return false;
      if (m.mode === "global") return !!m.agentId;
      return true; // workspace / new-global always valid
    }),
    [discovered, mappings],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allAssignments: Record<string, string> = { ...savedAssignments };
      const workspaceSlugs: string[] = [];
      const newGlobalSlugs: string[] = [];
      const workspaceConfigs: Record<string, string> = {};

      for (const [slug, mapping] of Object.entries(mappings)) {
        if (mapping.mode === "global" && mapping.agentId) {
          allAssignments[slug] = mapping.agentId;
          // Add workspace-specific instruction if provided
          if (mapping.config?.trim()) workspaceConfigs[mapping.agentId] = mapping.config.trim();
          // Merge discovered agent role into the global agent's bmad metadata
          const wsAgent = discovered.find((a) => a.slug === slug)!;
          const agent = globalAgents.find((a) => a.id === mapping.agentId);
          if (agent && wsAgent) {
            const existingMeta = (agent.metadata ?? {}) as Record<string, unknown>;
            const existingBmad = (existingMeta.bmad ?? {}) as Record<string, unknown>;
            const existingRoles = (existingBmad.roles ?? []) as Array<{ slug: string }>;
            if (!existingRoles.some((r) => r.slug === slug)) {
              await agentsApi.update(mapping.agentId, {
                metadata: {
                  ...existingMeta,
                  bmad: {
                    ...existingBmad,
                    roles: [...existingRoles, { slug, personaName: wsAgent.personaName, capabilities: wsAgent.capabilities, icon: wsAgent.icon }],
                  },
                },
              }, companyId);
            }
          }
        } else if (mapping.mode === "workspace") {
          workspaceSlugs.push(slug);
        } else if (mapping.mode === "new-global") {
          newGlobalSlugs.push(slug);
        }
      }

      // Create workspace-scoped agents
      if (workspaceSlugs.length > 0) {
        const result = await workspaceContextApi.importAgents(projectId, workspaceSlugs, workspaceId, companyId);
        Object.assign(allAssignments, result.assignments);
      }

      // Create new global agents (workspaceId: null → no scope)
      if (newGlobalSlugs.length > 0) {
        const result = await workspaceContextApi.importAgents(projectId, newGlobalSlugs, null, companyId);
        Object.assign(allAssignments, result.assignments);
      }

      // Persist all assignments
      await workspaceContextApi.saveAssignments(projectId, allAssignments, companyId);

      // Persist workspace-specific agent configs if any
      if (workspaceId && Object.keys(workspaceConfigs).length > 0) {
        const { data: project } = { data: null as null }; // will use updateWorkspace directly
        void project;
        // We patch via the assignments endpoint's workspace metadata; use updateWorkspace
        const existingMeta = (savedAssignmentsData as unknown as { metadata?: Record<string, unknown> })?.metadata ?? {};
        await projectsApi.updateWorkspace(projectId, workspaceId, {
          metadata: { ...existingMeta, agentWorkspaceConfigs: workspaceConfigs },
        }, companyId);
      }
    },
    onSuccess: () => {
      pushToast({ title: "Agents configured", body: "Workspace agents are ready.", tone: "success" });
      setStep("card");
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      if (workspaceId) queryClient.invalidateQueries({ queryKey: queryKeys.agents.listForWorkspace(companyId, workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["workspace-assignments", projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
    onError: (err) => {
      pushToast({ title: "Failed to save", body: err instanceof Error ? err.message : "Unknown error", tone: "error" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Scanning workspace for agents...
      </div>
    );
  }

  if (discovered.length === 0) return null;

  // ── Assignment step ──────────────────────────────────────────────────
  if (step === "assigning") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStep("card")} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold flex-1">Configure workspace agents</h3>
        </div>

        <div className="space-y-3">
          {discovered.map((wsAgent) => {
            const mapping = mappings[wsAgent.slug] ?? { mode: "workspace" };
            const configExpanded = expandedConfigs.has(wsAgent.slug);
            const incomplete = mapping.mode === "global" && !mapping.agentId;

            return (
              <div key={wsAgent.slug} className={cn("rounded-lg border p-3 space-y-2.5", incomplete ? "border-amber-400/70 bg-amber-500/5" : "border-border")}>
                {/* Agent header */}
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{wsAgent.icon ?? "🤖"}</span>
                  <span className="text-sm font-semibold">{wsAgent.personaName}</span>
                  <span className="text-xs font-mono text-muted-foreground">{wsAgent.commandName}</span>
                </div>

                {/* Mode selector */}
                <div className="flex gap-1.5 flex-wrap">
                  {(["global", "workspace", "new-global"] as MappingMode[]).map((mode) => {
                    const label = mode === "global" ? "Agent global" : mode === "workspace" ? "Workspace only" : "Nouvel agent global";
                    const Icon = mode === "global" ? Link2 : mode === "workspace" ? Lock : Globe;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setMode(wsAgent.slug, mode)}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                          mapping.mode === mode
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground/40 hover:bg-accent/50 text-muted-foreground",
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Global: agent picker + optional workspace config */}
                {mapping.mode === "global" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                    <select
                      className={cn("flex-1 rounded border bg-background px-2 py-1 text-xs outline-none", incomplete ? "border-amber-400" : "border-border")}
                      value={mapping.agentId ?? ""}
                      onChange={(e) => setAgentId(wsAgent.slug, e.target.value)}
                    >
                      <option value="">— Choisir un agent global —</option>
                      {globalAgents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    {incomplete && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">requis</span>
                    )}
                    </div>
                    {/* Workspace config toggle */}
                    {mapping.agentId && (
                      <button
                        type="button"
                        onClick={() => toggleConfig(wsAgent.slug)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        {configExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Config workspace pour cet agent
                        {mapping.config?.trim() && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-violet-500 inline-block" />}
                      </button>
                    )}
                    {configExpanded && (
                      <textarea
                        rows={3}
                        placeholder={"Ex : Pour ce workspace, toujours écrire les tests avant le code. Utilise le pattern adapté au projet."}
                        value={mapping.config ?? ""}
                        onChange={(e) => setConfig(wsAgent.slug, e.target.value)}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none resize-none font-mono placeholder:text-muted-foreground/60"
                      />
                    )}
                  </div>
                )}

                {/* Workspace / new-global: description */}
                {mapping.mode === "workspace" && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    Un agent scopé à ce workspace sera créé et restera privé au projet.
                  </p>
                )}
                {mapping.mode === "new-global" && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3 shrink-0" />
                    Un nouvel agent global sera créé et disponible pour tous les projets.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setStep("card")} disabled={saveMutation.isPending}>
            Annuler
          </Button>
          <div className="flex-1" />
          <Button size="sm" disabled={saveMutation.isPending || !canSave} onClick={() => saveMutation.mutate()} className="gap-1.5" title={!canSave ? "Tous les agents doivent être assignés" : undefined}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Confirmer
          </Button>
        </div>
      </div>
    );
  }

  // ── Card step ────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-violet-500/10 p-2 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">Workspace agents detected</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {discovered.length} agent{discovered.length > 1 ? "s" : ""} found in your workspace.
            {allAssigned ? " All configured." : ` ${unassigned.length} not yet configured.`}
          </p>
        </div>
        <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {discovered.map((agent) => {
          const assignedAgentId = savedAssignments[agent.slug];
          const assignedAgent = assignedAgentId ? existingAgents.find((a) => a.id === assignedAgentId) : null;
          const isAssigned = assignedSlugs.has(agent.slug);
          const scopedAgent = scopedAgents.find((a) => {
            const bmadMeta = (a.metadata as Record<string, unknown> | null)?.bmad as Record<string, unknown> | undefined;
            return bmadMeta?.slug === agent.slug;
          });

          return (
            <div key={agent.slug} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs bg-muted/40">
              <span>{agent.icon ?? "🤖"}</span>
              <span className="font-medium">{agent.personaName}</span>
              <span className="text-muted-foreground font-mono">{agent.commandName}</span>
              <div className="flex-1" />
              {assignedAgent ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Link2 className="h-3 w-3" />
                  {assignedAgent.name}
                  {assignedAgent.scopedToWorkspaceId
                    ? <span className="text-[9px] opacity-60 ml-0.5">workspace</span>
                    : <span className="text-[9px] opacity-60 ml-0.5">global</span>}
                </span>
              ) : scopedAgent ? (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Check className="h-3 w-3" />{scopedAgent.name}
                  <span className="text-[9px] opacity-60 ml-0.5">workspace</span>
                </span>
              ) : isAssigned ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><Check className="h-3 w-3" /> Linked</span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 italic"><Clock className="h-3 w-3" /> Not configured</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1" />
        <Button size="sm" variant={allAssigned ? "outline" : "default"} onClick={openAssigning} className="gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          {allAssigned ? "Modifier la configuration" : "Configurer les agents"}
        </Button>
      </div>
    </div>
  );
}
