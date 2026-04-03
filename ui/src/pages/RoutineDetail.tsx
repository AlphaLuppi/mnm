import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { routinesApi, type RoutineDetail as RoutineDetailType, type RoutineTrigger, type RoutineRun } from "../api/routines";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PriorityIcon } from "../components/PriorityIcon";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { relativeTime, cn, formatDateTime } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CalendarClock,
  Play,
  Plus,
  Trash2,
  Clock,
  Webhook,
  Terminal,
  ExternalLink,
  Pencil,
} from "lucide-react";
import type { Agent, Project } from "@mnm/shared";

const statusBadgeColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  archived: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

const runStatusBadgeColors: Record<string, string> = {
  received: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  issue_created: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  skipped: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  coalesced: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

function triggerKindLabel(kind: string) {
  if (kind === "schedule") return "Schedule";
  if (kind === "webhook") return "Webhook";
  return "API";
}

function TriggerKindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "schedule") return <Clock className={className} />;
  if (kind === "webhook") return <Webhook className={className} />;
  return <Terminal className={className} />;
}

export function RoutineDetail() {
  const { id: routineId } = useParams<{ id: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: routine, isLoading, error } = useQuery({
    queryKey: queryKeys.routines.detail(selectedCompanyId!, routineId!),
    queryFn: () => routinesApi.get(selectedCompanyId!, routineId!),
    enabled: !!selectedCompanyId && !!routineId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.routines.runs(selectedCompanyId!, routineId!),
    queryFn: () => routinesApi.listRuns(selectedCompanyId!, routineId!, 50),
    enabled: !!selectedCompanyId && !!routineId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Routines", href: "/routines" },
      { label: routine?.title ?? "..." },
    ]);
  }, [setBreadcrumbs, routine?.title]);

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (error || !routine) {
    return (
      <EmptyState
        icon={CalendarClock}
        message={error ? (error as Error).message : "Routine not found."}
      />
    );
  }

  const assigneeAgent = agentMap.get(routine.assigneeAgentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <button
          onClick={() => navigate("/routines")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Routines
        </button>

        <div className="flex items-center gap-3">
          <PriorityIcon priority={routine.priority} />
          <h1 className="text-lg font-semibold">{routine.title}</h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusBadgeColors[routine.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {routine.status}
          </span>
        </div>

        {routine.description && (
          <p className="text-sm text-muted-foreground">{routine.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {assigneeAgent && <span>Agent: {assigneeAgent.name}</span>}
          {routine.lastTriggeredAt && <span>Last triggered: {relativeTime(routine.lastTriggeredAt)}</span>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="triggers">
            Triggers
            {routine.triggers.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                {routine.triggers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="runs">
            Runs
            {(runs?.length ?? routine.recentRuns.length) > 0 && (
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                {runs?.length ?? routine.recentRuns.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            routine={routine}
            agents={agents ?? []}
            projects={projects ?? []}
            companyId={selectedCompanyId!}
          />
        </TabsContent>

        <TabsContent value="triggers">
          <TriggersTab
            routine={routine}
            companyId={selectedCompanyId!}
          />
        </TabsContent>

        <TabsContent value="runs">
          <RunsTab
            runs={runs ?? routine.recentRuns}
            routineId={routineId!}
            companyId={selectedCompanyId!}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  routine,
  agents,
  projects,
  companyId,
}: {
  routine: RoutineDetailType;
  agents: Agent[];
  projects: Project[];
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(routine.title);
  const [description, setDescription] = useState(routine.description ?? "");
  const [assigneeAgentId, setAssigneeAgentId] = useState(routine.assigneeAgentId);
  const [projectId, setProjectId] = useState(routine.projectId ?? "");
  const [priority, setPriority] = useState(routine.priority);
  const [status, setStatus] = useState<string>(routine.status);
  const [concurrencyPolicy, setConcurrencyPolicy] = useState<string>(routine.concurrencyPolicy);
  const [catchUpPolicy, setCatchUpPolicy] = useState<string>(routine.catchUpPolicy);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof routinesApi.update>[2]) =>
      routinesApi.update(companyId, routine.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(companyId, routine.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(companyId) });
      setEditing(false);
    },
  });

  const runMutation = useMutation({
    mutationFn: () => routinesApi.run(companyId, routine.id, { source: "manual" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(companyId, routine.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.runs(companyId, routine.id) });
    },
  });

  function handleSave() {
    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      assigneeAgentId,
      projectId: projectId && projectId !== "__none__" ? projectId : null,
      priority: priority as "urgent" | "high" | "medium" | "low" | "none",
      status: status as "active" | "paused" | "archived",
      concurrencyPolicy: concurrencyPolicy as "coalesce_if_active" | "skip_if_active" | "always_enqueue",
      catchUpPolicy: catchUpPolicy as "skip_missed" | "enqueue_missed_with_cap",
    });
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Routine Details</h2>
        <div className="flex items-center gap-2">
          {routine.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {runMutation.isPending ? "Running..." : "Run Now"}
            </Button>
          )}
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {updateMutation.error && (
        <p className="text-sm text-destructive">{(updateMutation.error as Error).message}</p>
      )}

      {runMutation.isSuccess && (
        <p className="text-sm text-green-600">Run triggered successfully.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Title</Label>
          {editing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <p className="text-sm">{routine.title}</p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          {editing ? (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusBadgeColors[routine.status] ?? "bg-muted text-muted-foreground",
              )}
            >
              {routine.status}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Description</Label>
          {editing ? (
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
          ) : (
            <p className="text-sm text-muted-foreground">{routine.description || "No description"}</p>
          )}
        </div>

        {/* Assignee Agent */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Assignee Agent</Label>
          {editing ? (
            <Select value={assigneeAgentId} onValueChange={setAssigneeAgentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter((a) => a.status !== "terminated")
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">
              {agents.find((a) => a.id === routine.assigneeAgentId)?.name ?? routine.assigneeAgentId}
            </p>
          )}
        </div>

        {/* Project */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          {editing ? (
            <Select value={projectId || "__none__"} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">
              {routine.projectId
                ? projects.find((p) => p.id === routine.projectId)?.name ?? routine.projectId
                : "None"}
            </p>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          {editing ? (
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <PriorityIcon priority={routine.priority} showLabel />
          )}
        </div>

        {/* Concurrency Policy */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Concurrency Policy</Label>
          {editing ? (
            <Select value={concurrencyPolicy} onValueChange={setConcurrencyPolicy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coalesce_if_active">Coalesce if active</SelectItem>
                <SelectItem value="skip_if_active">Skip if active</SelectItem>
                <SelectItem value="always_enqueue">Always enqueue</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{routine.concurrencyPolicy.replace(/_/g, " ")}</p>
          )}
        </div>

        {/* Catch-Up Policy */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Catch-Up Policy</Label>
          {editing ? (
            <Select value={catchUpPolicy} onValueChange={setCatchUpPolicy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip_missed">Skip missed</SelectItem>
                <SelectItem value="enqueue_missed_with_cap">Enqueue missed (with cap)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{routine.catchUpPolicy.replace(/_/g, " ")}</p>
          )}
        </div>
      </div>

      {/* Variables */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Variables</h3>
        {routine.variables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variables defined.</p>
        ) : (
          <div className="border border-border">
            <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
              <span>Name</span>
              <span>Label</span>
              <span>Type</span>
              <span>Default</span>
              <span>Required</span>
            </div>
            {routine.variables.map((v) => (
              <div key={v.name} className="grid grid-cols-5 gap-2 px-4 py-2 text-sm border-b border-border last:border-b-0">
                <span className="font-mono text-xs">{v.name}</span>
                <span>{v.label || "--"}</span>
                <span className="text-muted-foreground">{v.type}</span>
                <span className="text-muted-foreground">{v.defaultValue != null ? String(v.defaultValue) : "--"}</span>
                <span>{v.required ? "Yes" : "No"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground border-t border-border pt-4">
        <div>
          <span className="block font-medium text-foreground">Created</span>
          {formatDateTime(routine.createdAt)}
        </div>
        <div>
          <span className="block font-medium text-foreground">Updated</span>
          {formatDateTime(routine.updatedAt)}
        </div>
        <div>
          <span className="block font-medium text-foreground">Last Triggered</span>
          {routine.lastTriggeredAt ? formatDateTime(routine.lastTriggeredAt) : "Never"}
        </div>
        <div>
          <span className="block font-medium text-foreground">Last Enqueued</span>
          {routine.lastEnqueuedAt ? formatDateTime(routine.lastEnqueuedAt) : "Never"}
        </div>
      </div>
    </div>
  );
}

// ── Triggers Tab ─────────────────────────────────────────────────────────────

function TriggersTab({
  routine,
  companyId,
}: {
  routine: RoutineDetailType;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<RoutineTrigger | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (triggerId: string) =>
      routinesApi.deleteTrigger(companyId, triggerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(companyId, routine.id) });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ triggerId, enabled }: { triggerId: string; enabled: boolean }) =>
      routinesApi.updateTrigger(companyId, triggerId, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(companyId, routine.id) });
    },
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Triggers</h2>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Trigger
        </Button>
      </div>

      {routine.triggers.length === 0 ? (
        <EmptyState
          icon={Clock}
          message="No triggers configured. Add a schedule, webhook, or API trigger."
          action="Add Trigger"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="border border-border">
          {routine.triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
            >
              <TriggerKindIcon kind={trigger.kind} className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {trigger.label || triggerKindLabel(trigger.kind)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      trigger.enabled
                        ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                    )}
                  >
                    {trigger.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {trigger.kind === "schedule" && trigger.cronExpression && (
                    <span className="font-mono">{trigger.cronExpression}</span>
                  )}
                  {trigger.kind === "schedule" && trigger.timezone && (
                    <span>{trigger.timezone}</span>
                  )}
                  {trigger.kind === "schedule" && trigger.nextRunAt && (
                    <span>Next: {relativeTime(trigger.nextRunAt)}</span>
                  )}
                  {trigger.kind === "webhook" && trigger.publicId && (
                    <span className="font-mono truncate max-w-[200px]">
                      .../{trigger.publicId}/fire
                    </span>
                  )}
                  {trigger.lastFiredAt && (
                    <span>Last fired: {relativeTime(trigger.lastFiredAt)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() =>
                    toggleMutation.mutate({
                      triggerId: trigger.id,
                      enabled: !trigger.enabled,
                    })
                  }
                >
                  {trigger.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setEditingTrigger(trigger)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this trigger?")) {
                      deleteMutation.mutate(trigger.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Trigger Dialog */}
      {createOpen && (
        <CreateTriggerDialog
          companyId={companyId}
          routineId={routine.id}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {/* Edit Trigger Dialog */}
      {editingTrigger && (
        <EditTriggerDialog
          companyId={companyId}
          routineId={routine.id}
          trigger={editingTrigger}
          onClose={() => setEditingTrigger(null)}
        />
      )}
    </div>
  );
}

// ── Create Trigger Dialog ────────────────────────────────────────────────────

function CreateTriggerDialog({
  companyId,
  routineId,
  onClose,
}: {
  companyId: string;
  routineId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"schedule" | "webhook" | "api">("schedule");
  const [label, setLabel] = useState("");
  const [cronExpression, setCronExpression] = useState("0 0 9 * * 1-5");
  const [timezone, setTimezone] = useState("UTC");

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof routinesApi.createTrigger>[2]) =>
      routinesApi.createTrigger(companyId, routineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(companyId, routineId) });
      onClose();
    },
  });

  function handleSubmit() {
    const base = { label: label.trim() || null };
    if (kind === "schedule") {
      createMutation.mutate({ ...base, kind: "schedule", cronExpression, timezone });
    } else if (kind === "webhook") {
      createMutation.mutate({ ...base, kind: "webhook", signingMode: "bearer" as const, replayWindowSec: 300 });
    } else {
      createMutation.mutate({ ...base, kind: "api" });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Trigger</DialogTitle>
          <DialogDescription>
            Configure how this routine gets triggered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="schedule">Schedule (cron)</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Every weekday at 9am"
            />
          </div>

          {kind === "schedule" && (
            <>
              <div className="space-y-2">
                <Label>Cron Expression</Label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 0 9 * * 1-5"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  6-field cron: sec min hour day month weekday
                </p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Trigger"}
          </Button>
        </DialogFooter>

        {createMutation.error && (
          <p className="text-sm text-destructive mt-2">
            {(createMutation.error as Error).message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Trigger Dialog ──────────────────────────────────────────────────────

function EditTriggerDialog({
  companyId,
  routineId,
  trigger,
  onClose,
}: {
  companyId: string;
  routineId: string;
  trigger: RoutineTrigger;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(trigger.label ?? "");
  const [cronExpression, setCronExpression] = useState(trigger.cronExpression ?? "");
  const [timezone, setTimezone] = useState(trigger.timezone ?? "UTC");

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof routinesApi.updateTrigger>[2]) =>
      routinesApi.updateTrigger(companyId, trigger.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.detail(companyId, routineId) });
      onClose();
    },
  });

  function handleSave() {
    const payload: Record<string, unknown> = {
      label: label.trim() || null,
    };
    if (trigger.kind === "schedule") {
      if (cronExpression) payload.cronExpression = cronExpression;
      if (timezone) payload.timezone = timezone;
    }
    updateMutation.mutate(payload as Parameters<typeof routinesApi.updateTrigger>[2]);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Trigger</DialogTitle>
          <DialogDescription>
            Update the {triggerKindLabel(trigger.kind)} trigger settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label..."
            />
          </div>

          {trigger.kind === "schedule" && (
            <>
              <div className="space-y-2">
                <Label>Cron Expression</Label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  6-field cron: sec min hour day month weekday
                </p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>

        {updateMutation.error && (
          <p className="text-sm text-destructive mt-2">
            {(updateMutation.error as Error).message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Runs Tab ─────────────────────────────────────────────────────────────────

function RunsTab({
  runs,
  routineId,
  companyId,
}: {
  runs: RoutineRun[];
  routineId: string;
  companyId: string;
}) {
  if (runs.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState
          icon={Play}
          message="No runs yet. Trigger the routine manually or wait for a scheduled run."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-sm font-medium">Recent Runs</h2>
      <div className="border border-border">
        {/* Header */}
        <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
          <span>Status</span>
          <span>Source</span>
          <span>Triggered</span>
          <span>Completed</span>
          <span>Linked Issue</span>
          <span>Details</span>
        </div>

        {runs.map((run) => (
          <div
            key={run.id}
            className="grid grid-cols-6 gap-2 px-4 py-2.5 text-sm border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
          >
            {/* Status */}
            <span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                  runStatusBadgeColors[run.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {run.status.replace("_", " ")}
              </span>
            </span>

            {/* Source */}
            <span className="text-xs text-muted-foreground">{run.source}</span>

            {/* Triggered */}
            <span className="text-xs text-muted-foreground">
              {relativeTime(run.triggeredAt)}
            </span>

            {/* Completed */}
            <span className="text-xs text-muted-foreground">
              {run.completedAt ? relativeTime(run.completedAt) : "--"}
            </span>

            {/* Linked Issue */}
            <span>
              {run.linkedIssueId ? (
                <Link
                  to={`/issues/${run.linkedIssueId}`}
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  Issue
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">--</span>
              )}
            </span>

            {/* Details */}
            <span className="text-xs text-muted-foreground truncate">
              {run.failureReason
                ? run.failureReason
                : run.coalescedIntoRunId
                  ? "Coalesced"
                  : "--"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
