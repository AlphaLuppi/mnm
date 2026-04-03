import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { routinesApi, type RoutineListItem } from "../api/routines";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { PriorityIcon } from "../components/PriorityIcon";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { relativeTime, cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CalendarClock,
  Plus,
  Play,
  Clock,
  Webhook,
  Terminal,
} from "lucide-react";
import type { Agent, Project } from "@mnm/shared";

type StatusFilter = "all" | "active" | "paused" | "archived";

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

function triggerSummary(triggers: RoutineListItem["triggers"]): string {
  if (!triggers || triggers.length === 0) return "No triggers";
  const enabled = triggers.filter((t) => t.enabled);
  if (enabled.length === 0) return `${triggers.length} trigger${triggers.length !== 1 ? "s" : ""} (all disabled)`;
  const parts: string[] = [];
  const schedules = enabled.filter((t) => t.kind === "schedule");
  const webhooks = enabled.filter((t) => t.kind === "webhook");
  const apis = enabled.filter((t) => t.kind === "api");
  if (schedules.length > 0) parts.push(`${schedules.length} schedule`);
  if (webhooks.length > 0) parts.push(`${webhooks.length} webhook`);
  if (apis.length > 0) parts.push(`${apis.length} API`);
  return parts.join(", ");
}

function triggerKindIcon(kind: string) {
  if (kind === "schedule") return Clock;
  if (kind === "webhook") return Webhook;
  return Terminal;
}

export function Routines() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [runNowRoutine, setRunNowRoutine] = useState<RoutineListItem | null>(null);

  const { data: routines, isLoading, error } = useQuery({
    queryKey: queryKeys.routines.list(selectedCompanyId!),
    queryFn: () => routinesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
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

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Routines" }]);
  }, [setBreadcrumbs]);

  const filtered = useMemo(() => {
    if (!routines) return [];
    if (statusFilter === "all") return routines;
    return routines.filter((r) => r.status === statusFilter);
  }, [routines, statusFilter]);

  const statusMutation = useMutation({
    mutationFn: ({ routineId, status }: { routineId: string; status: string }) =>
      routinesApi.update(selectedCompanyId!, routineId, { status: status as "active" | "paused" | "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) });
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ routineId, variables }: { routineId: string; variables?: Record<string, unknown> }) =>
      routinesApi.run(selectedCompanyId!, routineId, {
        source: "manual",
        ...(variables ? { variables } : {}),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.runs(selectedCompanyId!, vars.routineId) });
      setRunNowRoutine(null);
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={CalendarClock} message="Select a company to view routines." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Routines</h1>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger size="sm" className="h-7 text-xs w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Routine
        </Button>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">{filtered.length} routine{filtered.length !== 1 ? "s" : ""}</p>
      )}

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {routines && routines.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          message="Create your first routine to automate recurring tasks."
          action="New Routine"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {routines && routines.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No routines match the selected filter.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="border border-border">
          {filtered.map((routine) => {
            const agent = agentMap.get(routine.assigneeAgentId);
            return (
              <EntityRow
                key={routine.id}
                title={routine.title}
                subtitle={agent ? `Assigned to ${agent.name}` : undefined}
                to={`/routines/${routine.id}`}
                leading={<PriorityIcon priority={routine.priority} />}
                trailing={
                  <div className="flex items-center gap-3">
                    {/* Triggers summary */}
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      {triggerSummary(routine.triggers)}
                    </span>

                    {/* Last run */}
                    {routine.lastRun && (
                      <span
                        className={cn(
                          "hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                          runStatusBadgeColors[routine.lastRun.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {routine.lastRun.status.replace("_", " ")}
                      </span>
                    )}

                    {/* Last triggered */}
                    <span className="hidden sm:inline text-xs text-muted-foreground w-16 text-right">
                      {routine.lastTriggeredAt ? relativeTime(routine.lastTriggeredAt) : "never"}
                    </span>

                    {/* Status badge */}
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
                        statusBadgeColors[routine.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {routine.status}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {routine.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          title="Run now"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (routine.variables && routine.variables.length > 0) {
                              setRunNowRoutine(routine);
                            } else {
                              runMutation.mutate({ routineId: routine.id });
                            }
                          }}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Create Routine Dialog */}
      {createOpen && (
        <CreateRoutineDialog
          companyId={selectedCompanyId}
          agents={agents ?? []}
          projects={projects ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            navigate(`/routines/${id}`);
          }}
        />
      )}

      {/* Run Now Dialog (for routines with variables) */}
      {runNowRoutine && (
        <RunNowDialog
          routine={runNowRoutine}
          isRunning={runMutation.isPending}
          onRun={(variables) => runMutation.mutate({ routineId: runNowRoutine.id, variables })}
          onClose={() => setRunNowRoutine(null)}
        />
      )}
    </div>
  );
}

// ── Create Routine Dialog ────────────────────────────────────────────────────

function CreateRoutineDialog({
  companyId,
  agents,
  projects,
  onClose,
  onCreated,
}: {
  companyId: string;
  agents: Agent[];
  projects: Project[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [priority, setPriority] = useState("medium");

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof routinesApi.create>[1]) =>
      routinesApi.create(companyId, data),
    onSuccess: (routine) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.list(companyId) });
      onCreated(routine.id);
    },
  });

  const canSubmit = title.trim().length > 0 && assigneeAgentId.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Routine</DialogTitle>
          <DialogDescription>
            Set up a recurring automated task assigned to an agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="routine-title">Title</Label>
            <Input
              id="routine-title"
              placeholder="Daily code review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-desc">Description</Label>
            <Input
              id="routine-desc"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Assignee Agent</Label>
            <Select value={assigneeAgentId} onValueChange={setAssigneeAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
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
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
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
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                title: title.trim(),
                description: description.trim() || null,
                assigneeAgentId,
                projectId: projectId && projectId !== "__none__" ? projectId : null,
                priority: priority as "urgent" | "high" | "medium" | "low" | "none",
                status: "active" as const,
                concurrencyPolicy: "coalesce_if_active" as const,
                catchUpPolicy: "skip_missed" as const,
                variables: [],
              })
            }
          >
            {createMutation.isPending ? "Creating..." : "Create"}
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

// ── Run Now Dialog (variables form) ──────────────────────────────────────────

function RunNowDialog({
  routine,
  isRunning,
  onRun,
  onClose,
}: {
  routine: RoutineListItem;
  isRunning: boolean;
  onRun: (variables: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const v of routine.variables ?? []) {
      initial[v.name] = v.defaultValue != null ? String(v.defaultValue) : "";
    }
    return initial;
  });

  function handleSubmit() {
    const resolved: Record<string, unknown> = {};
    for (const v of routine.variables ?? []) {
      const raw = values[v.name] ?? "";
      if (v.type === "number") {
        resolved[v.name] = raw ? Number(raw) : undefined;
      } else if (v.type === "boolean") {
        resolved[v.name] = raw === "true";
      } else {
        resolved[v.name] = raw || undefined;
      }
    }
    onRun(resolved);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run "{routine.title}"</DialogTitle>
          <DialogDescription>
            Provide values for the routine variables before running.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(routine.variables ?? []).map((v) => (
            <div key={v.name} className="space-y-1">
              <Label className="text-xs">
                {v.label || v.name}
                {v.required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              {v.type === "select" && v.options.length > 0 ? (
                <Select
                  value={values[v.name] ?? ""}
                  onValueChange={(val) => setValues((prev) => ({ ...prev, [v.name]: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {v.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : v.type === "boolean" ? (
                <Select
                  value={values[v.name] ?? "false"}
                  onValueChange={(val) => setValues((prev) => ({ ...prev, [v.name]: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={v.type === "number" ? "number" : "text"}
                  value={values[v.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                  placeholder={v.label || v.name}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isRunning}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {isRunning ? "Running..." : "Run Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
