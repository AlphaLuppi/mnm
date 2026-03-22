import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Rocket, Loader2, Check, Sparkles, Search, Clock } from "lucide-react";

// Sentinel for "auto-create workspace-scoped agent on launch"
const SENTINEL_GHOST = "__ghost__";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { workspaceContextApi } from "../api/workspaceContext";
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


interface LaunchAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId?: string;
  storyTitle: string;
  storyContent: string;
  /** Optional instruction pre-filled in the prompt field */
  defaultPrompt?: string;
  /** Optional agent ID to pre-select when the dialog opens */
  defaultAgentId?: string;
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
  defaultAgentId,
  onIssueCreated,
}: LaunchAgentDialogProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [workflowType, setWorkflowType] = useState<string>("");
  const [prompt, setPrompt] = useState<string>(defaultPrompt ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [selectedWsSlug, setSelectedWsSlug] = useState<string>("");
  const [workflowSearch, setWorkflowSearch] = useState<string>("");

  const { data: assignmentsData } = useQuery({
    queryKey: ["workspace-assignments", projectId],
    queryFn: () => workspaceContextApi.getAssignments(projectId!, companyId),
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
    queryKey: ["workspace-workflows", projectId ?? companyId],
    queryFn: () => workspaceContextApi.getWorkflows(projectId!, companyId),
    enabled: open && !!projectId,
  });

  // Fetch discovered workspace agents for ghost agent creation details
  const { data: discoveredData } = useQuery({
    queryKey: ["workspace-agents-discovery", projectId],
    queryFn: () => workspaceContextApi.getAgents(projectId!, companyId),
    enabled: open && !!projectId,
  });
  const discoveredAgents = discoveredData?.agents ?? [];

  const workflowTypes = (workflowsData?.workflows ?? []).map((w) => ({
    value: w.name,
    label: w.name,
    description: w.description,
    agentRole: w.agentRole,
  }));

  const activeAgents = agents.filter((a) => a.status !== "terminated");

  // Pre-select agent when dialog opens with a defaultAgentId
  useEffect(() => {
    if (open && defaultAgentId) {
      setSelectedAgentId(defaultAgentId);
    }
  }, [open, defaultAgentId]);

  // When workflow changes, auto-select the workspace role and corresponding agent
  useEffect(() => {
    if (!workflowType) return;
    const workflow = workflowTypes.find((w) => w.value === workflowType);
    const agentRole = workflow?.agentRole;
    if (agentRole) {
      setSelectedWsSlug(agentRole);
      const assignedAgentId = bmadAssignments[agentRole];
      if (assignedAgentId && activeAgents.some((a) => a.id === assignedAgentId)) {
        setSelectedAgentId(assignedAgentId);
      } else {
        // No assignment → ghost: will be auto-created as workspace agent on launch
        setSelectedAgentId(SENTINEL_GHOST);
      }
    } else {
      setSelectedWsSlug("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowType, workflowsData, assignmentsData]);

  // Ghost agent info when no assignment exists for the selected workspace role
  const ghostWsAgent = selectedAgentId === SENTINEL_GHOST && selectedWsSlug
    ? discoveredAgents.find((a) => a.slug === selectedWsSlug)
    : null;

  // Get workspace roles for the selected agent (for the role selector UI)
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedAgentWsRoles = (() => {
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
      if (selectedAgentId === SENTINEL_GHOST && !ghostWsAgent) {
        pushToast({
          title: "No agent workspace found",
          body: "No bmad-agent-*.md file found for this role. Select an agent manually.",
          tone: "error",
        });
        setSubmitting(false);
        return;
      }
      if (selectedAgentId === SENTINEL_GHOST && !workspaceId) {
        pushToast({
          title: "Workspace not found",
          body: "No workspace configured for this project.",
          tone: "error",
        });
        setSubmitting(false);
        return;
      }

      if (selectedAgentId === SENTINEL_GHOST && ghostWsAgent && workspaceId && projectId) {
          : "general";

        const newAgent = await agentsApi.create(companyId, {
          name: `${ghostWsAgent.personaName} (workspace)`,
          title: ghostWsAgent.title ?? null,
          role,
          capabilities: ghostWsAgent.capabilities ?? null,
          adapterType: "claude_local",
          adapterConfig: {},
          runtimeConfig: {},
          budgetMonthlyCents: 0,
          scopedToWorkspaceId: workspaceId,
          metadata: {
            bmad: {
              slug: selectedWsSlug,
              roles: [{
                slug: selectedWsSlug,
                personaName: ghostWsAgent.personaName,
                capabilities: ghostWsAgent.capabilities,
                icon: ghostWsAgent.icon,
              }],
            },
          },
        });
        actualAgentId = newAgent.id;

        // Persist assignment so next launch uses this scoped agent directly
        await workspaceContextApi.saveAssignments(projectId, { ...bmadAssignments, [selectedWsSlug]: newAgent.id }, companyId);
        queryClient.invalidateQueries({ queryKey: agentQueryKey });
        queryClient.invalidateQueries({ queryKey: ["workspace-assignments", projectId] });
      }

      let wsCtxPrefix = "";
      if (selectedWsSlug && projectId) {
        const [personaResult, workflowResult] = await Promise.allSettled([
          workspaceContextApi.getCommand(projectId, `bmad-agent-${selectedWsSlug}`, companyId),
          workspaceContextApi.getCommand(projectId, `bmad-${workflowType}`, companyId),
        ]);
        const parts: string[] = [];
        if (personaResult.status === "fulfilled") parts.push(personaResult.value);
        if (workflowResult.status === "fulfilled") parts.push(workflowResult.value);
        if (parts.length > 0) wsCtxPrefix = parts.join("\n\n---\n\n") + "\n\n---\n\n";
      }

      const body = wsCtxPrefix + (prompt.trim() ? `# Instruction\n\n${prompt.trim()}\n\n---\n\n` : "") + storyContent;

      const issue = await issuesApi.create(companyId, {
        title: `[${workflowType}] ${storyTitle}`,
        body,
        status: "todo",
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
      setWorkflowType("");
      setPrompt(defaultPrompt ?? "");
      setSelectedWsSlug("");
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
                  {ghostWsAgent && (
                    <SelectItem value={SENTINEL_GHOST}>
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        {ghostWsAgent.icon && <span>{ghostWsAgent.icon}</span>}
                        Create {ghostWsAgent.personaName} (workspace)
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

          {/* Workspace role selector — shown when the selected agent has multiple workspace roles */}
          {selectedAgentWsRoles.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace role</label>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgentWsRoles.map((role) => (
                  <button
                    key={role.slug}
                    type="button"
                    onClick={() => setSelectedWsSlug(role.slug)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1",
                      selectedWsSlug === role.slug
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
                  onClick={() => setSelectedWsSlug("")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    selectedWsSlug === ""
                      ? "border-foreground bg-foreground text-background"
                      : "border-border border-dashed hover:border-foreground/40 hover:bg-accent/50 text-muted-foreground",
                  )}
                >
                  None
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
                placeholder="Search workflows…"
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
            {selectedWsSlug && selectedAgentId !== SENTINEL_GHOST && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-violet-600 dark:text-violet-400">
                <Sparkles className="h-3 w-3" />
                Workspace context will be injected ({selectedWsSlug})
              </div>
            )}
            {selectedAgentId === SENTINEL_GHOST && ghostWsAgent && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Workspace agent will be created for {ghostWsAgent.personaName}
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
            disabled={!selectedAgentId || (selectedAgentId === SENTINEL_GHOST && !ghostWsAgent) || submitting}
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
