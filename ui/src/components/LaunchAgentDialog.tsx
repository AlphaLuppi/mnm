import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Rocket, Loader2, Check, Sparkles, Search, Clock } from "lucide-react";

// Sentinel for "auto-create workspace-scoped agent on launch"
const SENTINEL_GHOST = "__ghost__";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { bmadApi } from "../api/bmad";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "../lib/utils";
// Note: Select is kept for the agent picker above

const FALLBACK_WORKFLOWS = [
  { value: "dev-story", label: "dev-story", description: "Execute story implementation following a context filled story spec file." },
  { value: "correct-course", label: "correct-course", description: "Fix a deviation from the original spec or architecture." },
  { value: "code-review", label: "code-review", description: "Review code quality, style, and adherence to specs." },
  { value: "custom", label: "custom", description: "Free-form task — describe the instruction manually." },
];

interface LaunchAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId?: string;
  storyTitle: string;
  storyContent: string;
  /** Optional instruction pre-filled in the prompt field */
  defaultPrompt?: string;
  onIssueCreated?: (issueId: string) => void;
}

export function LaunchAgentDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  storyTitle,
  storyContent,
  defaultPrompt,
  onIssueCreated,
}: LaunchAgentDialogProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [workflowType, setWorkflowType] = useState<string>(defaultPrompt ? "custom" : "dev-story");
  const [prompt, setPrompt] = useState<string>(defaultPrompt ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [selectedBmadSlug, setSelectedBmadSlug] = useState<string>("");
  const [workflowSearch, setWorkflowSearch] = useState<string>("");

  const { data: assignmentsData } = useQuery({
    queryKey: ["bmad-assignments", projectId],
    queryFn: () => bmadApi.getAssignments(projectId!, companyId),
    enabled: open && !!projectId,
  });

  const bmadAssignments = assignmentsData?.assignments ?? {};
  // workspaceId derived from assignments response (primary workspace of the project)
  const workspaceId = assignmentsData?.workspaceId ?? undefined;

  const agentQueryKey = workspaceId
    ? queryKeys.agents.listForWorkspace(companyId, workspaceId)
    : queryKeys.agents.list(companyId);

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: agentQueryKey,
    queryFn: () => agentsApi.list(companyId, workspaceId ? { workspaceId } : undefined),
    enabled: open && !!companyId,
  });

  const { data: workflowsData } = useQuery({
    queryKey: ["bmad-workflows", projectId ?? companyId],
    queryFn: () => bmadApi.getWorkflows(projectId!, companyId),
    enabled: open && !!projectId,
  });

  // Fetch discovered BMAD agents for ghost agent creation details
  const { data: discoveredData } = useQuery({
    queryKey: ["bmad-agents-discovery", projectId],
    queryFn: () => bmadApi.getAgents(projectId!, companyId),
    enabled: open && !!projectId,
  });
  const discoveredAgents = discoveredData?.agents ?? [];

  const workflowTypes = workflowsData?.workflows.length
    ? workflowsData.workflows.map((w) => ({ value: w.name, label: w.name, description: w.description, agentRole: w.agentRole }))
    : FALLBACK_WORKFLOWS.map((w) => ({ ...w, agentRole: undefined }));

  const activeAgents = agents.filter((a) => a.status !== "terminated");

  // When workflow changes, auto-select the BMAD role and corresponding agent
  useEffect(() => {
    if (!workflowType) return;
    const workflow = workflowTypes.find((w) => w.value === workflowType);
    const agentRole = workflow?.agentRole;
    if (agentRole) {
      setSelectedBmadSlug(agentRole);
      const assignedAgentId = bmadAssignments[agentRole];
      if (assignedAgentId && activeAgents.some((a) => a.id === assignedAgentId)) {
        setSelectedAgentId(assignedAgentId);
      } else {
        // No assignment → ghost: will be auto-created as workspace agent on launch
        setSelectedAgentId(SENTINEL_GHOST);
      }
    } else {
      setSelectedBmadSlug("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowType, workflowsData, assignmentsData]);

  // Ghost agent info when no assignment exists for the selected BMAD role
  const ghostBmadAgent = selectedAgentId === SENTINEL_GHOST && selectedBmadSlug
    ? discoveredAgents.find((a) => a.slug === selectedBmadSlug)
    : null;

  // Get BMAD roles for the selected agent (for the role selector UI)
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedAgentBmadRoles = (() => {
    if (!selectedAgent) return [];
    const bmadMeta = (selectedAgent.metadata as Record<string, unknown> | null)?.bmad as Record<string, unknown> | undefined;
    const roles = bmadMeta?.roles as Array<{ slug: string; personaName?: string; icon?: string | null }> | undefined;
    return roles ?? [];
  })();

  const handleSubmit = async () => {
    if (!selectedAgentId) return;
    setSubmitting(true);

    try {
      let actualAgentId = selectedAgentId;

      // Lazy creation: ghost selected → create a workspace-scoped agent
      if (selectedAgentId === SENTINEL_GHOST && ghostBmadAgent && workspaceId && projectId) {
        const { AGENT_ROLES } = await import("@mnm/shared");
        const validRoles = new Set(AGENT_ROLES);
        const role = validRoles.has(ghostBmadAgent.role as typeof AGENT_ROLES[number])
          ? (ghostBmadAgent.role as typeof AGENT_ROLES[number])
          : "general";

        const newAgent = await agentsApi.create(companyId, {
          name: `${ghostBmadAgent.personaName} (BMAD)`,
          title: ghostBmadAgent.title ?? null,
          role,
          capabilities: ghostBmadAgent.capabilities ?? null,
          adapterType: "claude_local",
          adapterConfig: {},
          runtimeConfig: {},
          budgetMonthlyCents: 0,
          scopedToWorkspaceId: workspaceId,
          metadata: {
            bmad: {
              slug: selectedBmadSlug,
              roles: [{
                slug: selectedBmadSlug,
                personaName: ghostBmadAgent.personaName,
                capabilities: ghostBmadAgent.capabilities,
                icon: ghostBmadAgent.icon,
              }],
            },
          },
        });
        actualAgentId = newAgent.id;

        // Persist assignment so next launch uses this scoped agent directly
        await bmadApi.saveAssignments(projectId, { ...bmadAssignments, [selectedBmadSlug]: newAgent.id }, companyId);
        queryClient.invalidateQueries({ queryKey: agentQueryKey });
        queryClient.invalidateQueries({ queryKey: ["bmad-assignments", projectId] });
      }

      let bmadPrefix = "";
      if (selectedBmadSlug && projectId) {
        const [personaResult, workflowResult] = await Promise.allSettled([
          bmadApi.getCommand(projectId, `bmad-agent-${selectedBmadSlug}`, companyId),
          bmadApi.getCommand(projectId, `bmad-${workflowType}`, companyId),
        ]);
        const parts: string[] = [];
        if (personaResult.status === "fulfilled") parts.push(personaResult.value);
        if (workflowResult.status === "fulfilled") parts.push(workflowResult.value);
        if (parts.length > 0) bmadPrefix = parts.join("\n\n---\n\n") + "\n\n---\n\n";
      }

      const body = bmadPrefix + (prompt.trim() ? `# Instruction\n\n${prompt.trim()}\n\n---\n\n` : "") + storyContent;

      const issue = await issuesApi.create(companyId, {
        title: `[${workflowType}] ${storyTitle}`,
        body,
        assigneeAgentId: actualAgentId,
        ...(projectId ? { projectId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      });
      onIssueCreated?.(issue.id);
      pushToast({
        title: "Agent launched",
        body: `Issue created and assigned to agent for "${storyTitle}"`,
        tone: "success",
      });
      onOpenChange(false);
      setSelectedAgentId("");
      setWorkflowType(defaultPrompt ? "custom" : "dev-story");
      setPrompt(defaultPrompt ?? "");
      setSelectedBmadSlug("");
    } catch (err) {
      pushToast({
        title: "Failed to launch agent",
        body: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Lancer un agent
          </DialogTitle>
          <DialogDescription>
            Select an agent and workflow type to assign this story.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Instruction</label>
            <Textarea
              placeholder="Ex: Génère les epics de ce PRD dans _bmad-output/implementation-artifacts/"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="resize-none text-sm"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Agent</label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents...
              </div>
            ) : (
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {/* Ghost option — auto-create workspace agent on launch */}
                  {ghostBmadAgent && (
                    <SelectItem value={SENTINEL_GHOST}>
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        {ghostBmadAgent.icon && <span>{ghostBmadAgent.icon}</span>}
                        Create {ghostBmadAgent.personaName} (workspace)
                      </span>
                    </SelectItem>
                  )}
                  {activeAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-1.5">
                        {agent.name}
                        {agent.scopedToWorkspaceId && (
                          <span className="text-[10px] text-muted-foreground bg-muted rounded px-1">ws</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* BMAD role selector — shown when the selected agent has multiple BMAD roles */}
          {selectedAgentBmadRoles.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">BMAD role</label>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgentBmadRoles.map((role) => (
                  <button
                    key={role.slug}
                    type="button"
                    onClick={() => setSelectedBmadSlug(role.slug)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1",
                      selectedBmadSlug === role.slug
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/40 hover:bg-accent/50",
                    )}
                  >
                    {role.icon && <span>{role.icon}</span>}
                    {role.personaName ?? role.slug}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedBmadSlug("")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    selectedBmadSlug === ""
                      ? "border-foreground bg-foreground text-background"
                      : "border-border border-dashed hover:border-foreground/40 hover:bg-accent/50 text-muted-foreground",
                  )}
                >
                  Aucun
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Workflow</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher un workflow…"
                value={workflowSearch}
                onChange={(e) => setWorkflowSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <ScrollArea className="max-h-48 rounded-md border border-border">
              <div className="p-1 space-y-0.5">
                {workflowTypes.filter((wt) =>
                  wt.value.toLowerCase().includes(workflowSearch.toLowerCase()) ||
                  ("description" in wt && wt.description?.toLowerCase().includes(workflowSearch.toLowerCase()))
                ).map((wt) => {
                  const selected = workflowType === wt.value;
                  return (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => setWorkflowType(wt.value)}
                      className={cn(
                        "w-full text-left rounded-md px-3 py-2.5 transition-colors flex items-start gap-3 cursor-pointer",
                        selected
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent/50 text-foreground/80",
                      )}
                    >
                      <span className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                      )}>
                        {selected && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
                      </span>
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-mono font-medium leading-none">{wt.value}</span>
                        {"description" in wt && wt.description && (
                          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {wt.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Story</p>
            <p className="text-sm font-medium truncate">{storyTitle}</p>
            {selectedBmadSlug && selectedAgentId !== SENTINEL_GHOST && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-violet-600 dark:text-violet-400">
                <Sparkles className="h-3 w-3" />
                BMAD context will be injected ({selectedBmadSlug})
              </div>
            )}
            {selectedAgentId === SENTINEL_GHOST && ghostBmadAgent && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Workspace agent will be created for {ghostBmadAgent.personaName}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAgentId || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Launch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
