import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import type {
  AutomationCursor,
  AutomationCursorLevel,
  AutomationCursorPosition,
  EffectiveCursor,
} from "@mnm/shared";
import {
  AUTOMATION_CURSOR_LEVELS,
  AUTOMATION_CURSOR_POSITIONS,
} from "@mnm/shared";
import { automationCursorsApi } from "../api/automation-cursors";
import type { SetCursorBody, ResolveCursorBody } from "../api/automation-cursors";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { CursorPositionBadge } from "../components/CursorPositionBadge";
import { CursorHierarchyChain } from "../components/CursorHierarchyChain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { timeAgo } from "../lib/timeAgo";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Segment Control ---

function PositionSegment({
  value,
  onChange,
  disabled,
}: {
  value: AutomationCursorPosition;
  onChange: (pos: AutomationCursorPosition) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {AUTOMATION_CURSOR_POSITIONS.map((pos) => (
        <button
          key={pos}
          type="button"
          data-testid={`dual-s02-seg-${pos}`}
          disabled={disabled}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            value === pos
              ? pos === "manual"
                ? "bg-muted text-foreground"
                : pos === "assisted"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-background text-muted-foreground hover:bg-accent/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          onClick={() => onChange(pos)}
        >
          {capitalize(pos)}
        </button>
      ))}
    </div>
  );
}

// --- Add Cursor Dialog ---

function AddCursorDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (body: SetCursorBody) => void;
  saving: boolean;
}) {
  const [level, setLevel] = useState<AutomationCursorLevel>("company");
  const [targetId, setTargetId] = useState("");
  const [position, setPosition] = useState<AutomationCursorPosition>("assisted");
  const [ceiling, setCeiling] = useState<AutomationCursorPosition>("auto");

  function handleSave() {
    onSave({
      level,
      targetId: targetId.trim() || null,
      position,
      ceiling,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dual-s02-add-dialog" className="p-4 sm:p-6 gap-4 max-w-md">
        <DialogHeader>
          <DialogTitle>Add Automation Cursor</DialogTitle>
          <DialogDescription>
            Configure a cursor position for a specific level and target.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dialog-level">Level</Label>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as AutomationCursorLevel)}
            >
              <SelectTrigger
                id="dialog-level"
                data-testid="dual-s02-dialog-level"
                className="h-8 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_CURSOR_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {capitalize(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {level !== "company" && (
            <div className="space-y-1.5">
              <Label htmlFor="dialog-target-id">Target ID</Label>
              <Input
                id="dialog-target-id"
                data-testid="dual-s02-dialog-target-id"
                placeholder="UUID of the target"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Position</Label>
            <Select
              value={position}
              onValueChange={(v) => setPosition(v as AutomationCursorPosition)}
            >
              <SelectTrigger
                data-testid="dual-s02-dialog-position"
                className="h-8 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_CURSOR_POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {capitalize(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ceiling</Label>
            <Select
              value={ceiling}
              onValueChange={(v) => setCeiling(v as AutomationCursorPosition)}
            >
              <SelectTrigger
                data-testid="dual-s02-dialog-ceiling"
                className="h-8 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_CURSOR_POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {capitalize(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            data-testid="dual-s02-dialog-cancel"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            data-testid="dual-s02-dialog-save"
            disabled={saving}
            onClick={handleSave}
          >
            {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---

export function AutomationCursors() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Resolve section state
  const [resolveLevel, setResolveLevel] = useState<AutomationCursorLevel>("agent");
  const [resolveTargetId, setResolveTargetId] = useState("");
  const [resolveAgentId, setResolveAgentId] = useState("");
  const [resolveProjectId, setResolveProjectId] = useState("");
  const [resolveResult, setResolveResult] = useState<EffectiveCursor | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Automation Cursors" }]);
  }, [setBreadcrumbs]);

  // List cursors
  const cursorsQuery = useQuery({
    queryKey: queryKeys.automationCursors.list(selectedCompanyId!, {
      level: levelFilter || undefined,
    }),
    queryFn: () =>
      automationCursorsApi.list(selectedCompanyId!, {
        level: (levelFilter || undefined) as AutomationCursorLevel | undefined,
      }),
    enabled: !!selectedCompanyId,
  });

  const cursors = useMemo(
    () => (cursorsQuery.data ?? []) as AutomationCursor[],
    [cursorsQuery.data],
  );

  // Set (upsert) mutation
  const setCursorMutation = useMutation({
    mutationFn: (body: SetCursorBody) =>
      automationCursorsApi.set(selectedCompanyId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-cursors", selectedCompanyId],
      });
      setAddDialogOpen(false);
    },
  });

  // Update position inline
  const updatePositionMutation = useMutation({
    mutationFn: (vars: { cursor: AutomationCursor; position: AutomationCursorPosition }) =>
      automationCursorsApi.set(selectedCompanyId!, {
        level: vars.cursor.level as AutomationCursorLevel,
        targetId: vars.cursor.targetId,
        position: vars.position,
        ceiling: vars.cursor.ceiling as AutomationCursorPosition,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-cursors", selectedCompanyId],
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (cursorId: string) =>
      automationCursorsApi.delete(selectedCompanyId!, cursorId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["automation-cursors", selectedCompanyId],
      });
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: (body: ResolveCursorBody) =>
      automationCursorsApi.resolve(selectedCompanyId!, body),
    onSuccess: (data) => {
      setResolveResult(data);
    },
  });

  function handleResolve() {
    resolveMutation.mutate({
      level: resolveLevel,
      targetId: resolveTargetId.trim() || undefined,
      agentId: resolveAgentId.trim() || undefined,
      projectId: resolveProjectId.trim() || undefined,
    });
  }

  // Loading state
  if (cursorsQuery.isLoading && !cursorsQuery.data) {
    return (
      <div data-testid="dual-s02-loading">
        <PageSkeleton />
      </div>
    );
  }

  // Error state
  if (cursorsQuery.error && !cursorsQuery.data) {
    return (
      <div
        data-testid="dual-s02-error"
        className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-6 text-sm text-red-700 dark:text-red-300"
      >
        Failed to load automation cursors. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dual-s02-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 data-testid="dual-s02-title" className="text-lg font-semibold">
            Automation Cursors
          </h1>
          {cursors.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {cursors.length}
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          data-testid="dual-s02-add-btn"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Cursor
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger
            data-testid="dual-s02-filter-level"
            className="w-full sm:w-[160px] h-8 text-xs"
          >
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {AUTOMATION_CURSOR_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {capitalize(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {levelFilter && levelFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setLevelFilter("")}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Empty state */}
      {cursors.length === 0 && (
        <div
          data-testid="dual-s02-empty-state"
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="bg-muted/50 rounded-full p-5 mb-5">
            <SlidersHorizontal className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3
            data-testid="dual-s02-empty-title"
            className="text-sm font-medium mb-1"
          >
            No cursors configured
          </h3>
          <p
            data-testid="dual-s02-empty-description"
            className="text-xs text-muted-foreground max-w-sm"
          >
            {levelFilter && levelFilter !== "all"
              ? `No cursors at level "${levelFilter}". Try clearing the filter.`
              : "Automation cursors control the speed of agent execution. Add your first cursor to configure manual, assisted, or automatic modes."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add your first cursor
          </Button>
        </div>
      )}

      {/* Cursors table */}
      {cursors.length > 0 && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table data-testid="dual-s02-table" className="w-full text-sm">
            <thead>
              <tr
                data-testid="dual-s02-table-header"
                className="border-b text-left text-xs text-muted-foreground"
              >
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Ceiling</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cursors.map((cursor) => (
                <tr
                  key={cursor.id}
                  data-testid="dual-s02-table-row"
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Level */}
                  <td className="px-4 py-3">
                    <Badge
                      data-testid="dual-s02-level"
                      variant="outline"
                      className="text-xs"
                    >
                      {capitalize(cursor.level)}
                    </Badge>
                  </td>

                  {/* Target */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="dual-s02-target"
                      className="text-xs text-muted-foreground font-mono"
                    >
                      {cursor.targetId
                        ? `${cursor.targetId.substring(0, 8)}...`
                        : "—"}
                    </span>
                  </td>

                  {/* Position segment control */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CursorPositionBadge
                        position={cursor.position as AutomationCursorPosition}
                        data-testid="dual-s02-position-badge"
                      />
                      <PositionSegment
                        value={cursor.position as AutomationCursorPosition}
                        onChange={(pos) =>
                          updatePositionMutation.mutate({
                            cursor,
                            position: pos,
                          })
                        }
                        disabled={updatePositionMutation.isPending}
                      />
                    </div>
                  </td>

                  {/* Ceiling */}
                  <td className="px-4 py-3">
                    <CursorPositionBadge
                      position={cursor.ceiling as AutomationCursorPosition}
                      data-testid="dual-s02-ceiling-badge"
                    />
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-3">
                    <span
                      data-testid="dual-s02-updated-at"
                      className="text-xs text-muted-foreground"
                      title={cursor.updatedAt}
                    >
                      {timeAgo(cursor.updatedAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <Button
                      data-testid="dual-s02-delete-btn"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-red-600 hover:text-red-700 dark:text-red-400"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(cursor.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolve Effective Cursor section */}
      <div
        data-testid="dual-s02-resolve-section"
        className="rounded-lg border bg-card p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Resolve Effective Cursor</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Resolve the effective cursor position for a given context, applying
          hierarchical ceiling enforcement.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Level</Label>
            <Select
              value={resolveLevel}
              onValueChange={(v) => setResolveLevel(v as AutomationCursorLevel)}
            >
              <SelectTrigger
                data-testid="dual-s02-resolve-level"
                className="h-8 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_CURSOR_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {capitalize(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Target ID</Label>
            <Input
              data-testid="dual-s02-resolve-target-id"
              placeholder="Optional"
              value={resolveTargetId}
              onChange={(e) => setResolveTargetId(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Agent ID</Label>
            <Input
              data-testid="dual-s02-resolve-agent-id"
              placeholder="Optional"
              value={resolveAgentId}
              onChange={(e) => setResolveAgentId(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Project ID</Label>
            <Input
              data-testid="dual-s02-resolve-project-id"
              placeholder="Optional"
              value={resolveProjectId}
              onChange={(e) => setResolveProjectId(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          data-testid="dual-s02-resolve-btn"
          disabled={resolveMutation.isPending}
          onClick={handleResolve}
        >
          {resolveMutation.isPending && (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          )}
          <Search className="h-3 w-3 mr-1.5" />
          Resolve
        </Button>

        {/* Resolve result */}
        {resolveResult && (
          <div
            data-testid="dual-s02-resolve-result"
            className="rounded-md border bg-muted/20 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Effective:
                </span>
                <CursorPositionBadge
                  position={resolveResult.position}
                  data-testid="dual-s02-resolve-position"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Ceiling:</span>
                <CursorPositionBadge
                  position={resolveResult.ceiling}
                  data-testid="dual-s02-resolve-ceiling"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Resolved from:
                </span>
                <Badge
                  data-testid="dual-s02-resolve-from"
                  variant="outline"
                  className="text-xs"
                >
                  {capitalize(resolveResult.resolvedFrom)}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">
                Hierarchy Chain:
              </span>
              <CursorHierarchyChain
                hierarchy={resolveResult.hierarchy}
                resolvedFrom={resolveResult.resolvedFrom}
                data-testid="dual-s02-hierarchy-chain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Cursor Dialog */}
      <AddCursorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={(body) => setCursorMutation.mutate(body)}
        saving={setCursorMutation.isPending}
      />
    </div>
  );
}
