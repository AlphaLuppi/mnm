import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WidgetPlacement } from "@mnm/shared";
import { dashboardApi } from "../api/dashboard";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { userWidgetsApi } from "../api/user-widgets";
import { viewPresetsApi } from "../api/view-presets";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useViewPreset } from "../hooks/useViewPreset";
import { useUserWidgets } from "../hooks/useUserWidgets";
import { queryKeys } from "../lib/queryKeys";
import { useDriftScanStatus } from "../hooks/useDriftResults";
import { useDashboardLiveIndicator } from "../hooks/useDashboardLiveIndicator";
import { EmptyState } from "../components/EmptyState";
import { UnifiedDashboardGrid } from "../components/UnifiedDashboardGrid";
import { AddWidgetDialog } from "../components/AddWidgetDialog";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { Bot, LayoutDashboard, Radar } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const { layout, grid } = useViewPreset();
  const [driftPromptDismissed, setDriftPromptDismissed] = useState(() =>
    localStorage.getItem("mnm:drift-prompt-hidden") === "true",
  );
  const [driftSessionDismissed, setDriftSessionDismissed] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);

  // Custom widgets
  const { widgets: customWidgets, createWidget, updateWidget, deleteWidget } = useUserWidgets();
  const qc = useQueryClient();
  const generateWidget = useMutation({
    mutationFn: (prompt: string) => userWidgetsApi.generate(selectedCompanyId!, prompt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.userWidgets.list(selectedCompanyId!) });
    },
  });

  // V2 grid layout state
  const [localGrid, setLocalGrid] = useState<WidgetPlacement[] | null>(null);
  const currentGrid = localGrid ?? grid;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLayoutMutation = useMutation({
    mutationFn: (layout: WidgetPlacement[]) =>
      viewPresetsApi.updateOverrides(selectedCompanyId!, { dashboard: { layout } }),
  });

  // Sync server grid to local state
  useEffect(() => {
    if (grid.length > 0 && localGrid === null) {
      setLocalGrid(grid);
    }
  }, [grid, localGrid]);

  const handleLayoutChange = useCallback(
    (updated: WidgetPlacement[]) => {
      setLocalGrid(updated);
      // Debounced save (1s)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveLayoutMutation.mutate(updated);
      }, 1000);
    },
    [saveLayoutMutation],
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      if (widgetId.startsWith("preset:")) {
        // Hide preset widget in layout
        const updated = currentGrid.map((p) =>
          p.widgetId === widgetId ? { ...p, hidden: true } : p,
        );
        handleLayoutChange(updated);
      } else {
        deleteWidget.mutate(widgetId);
        // Also remove from local grid
        const updated = currentGrid.filter((p) => p.widgetId !== widgetId);
        handleLayoutChange(updated);
      }
    },
    [currentGrid, handleLayoutChange, deleteWidget],
  );

  // DASH-S03: Real-time live indicator
  const { isLive, isFlashing, lastRefreshAt } = useDashboardLiveIndicator();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const firstProjectId = projects?.[0]?.id;
  const { data: driftStatus } = useDriftScanStatus(firstProjectId, selectedCompanyId ?? undefined);
  const showDriftPrompt =
    !!firstProjectId &&
    !driftPromptDismissed &&
    !driftSessionDismissed &&
    driftStatus !== undefined &&
    !driftStatus.scanning &&
    !driftStatus.lastScanAt;

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to MnM. Set up your first company and agent to get started."
          action="Get Started"
          onAction={() => navigate("/onboarding")}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {/* DASH-S03: Live indicator */}
      <div data-testid="dash-s03-live-indicator" className="flex items-center gap-2">
        <span data-testid="dash-s03-live-dot" className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            isFlashing
              ? "animate-ping bg-green-400"
              : isLive
                ? "animate-ping bg-green-400/50"
                : "bg-muted-foreground/40",
          )} />
          <span className={cn(
            "relative inline-flex rounded-full h-2.5 w-2.5",
            isLive ? "bg-green-500" : "bg-muted-foreground/40",
          )} />
        </span>
        <span data-testid="dash-s03-live-label" className={cn(
          "text-xs font-medium",
          isFlashing ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
        )}>
          Live
        </span>
        {lastRefreshAt && (
          <span data-testid="dash-s03-last-refresh" className="text-xs text-muted-foreground">
            Last updated {timeAgo(lastRefreshAt.toISOString())}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {hasNoAgents && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => navigate(`/onboarding?step=2&companyId=${selectedCompanyId}`)}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      {showDriftPrompt && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-500/25 dark:bg-blue-950/60">
          <div className="flex items-center gap-2.5">
            <Radar className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Would you like to scan for spec drift?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => navigate("/drift")}>
              Scan Now
            </Button>
            <button
              onClick={() => setDriftSessionDismissed(true)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              Later
            </button>
            <button
              onClick={() => {
                setDriftPromptDismissed(true);
                localStorage.setItem("mnm:drift-prompt-hidden", "true");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Don't ask again
            </button>
          </div>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {/* V2: Unified dashboard grid — drag & drop, resize */}
      <UnifiedDashboardGrid
        companyId={selectedCompanyId!}
        placements={currentGrid}
        userWidgets={customWidgets ?? []}
        onLayoutChange={handleLayoutChange}
        onDeleteWidget={handleDeleteWidget}
        onResizeWidget={(widgetId, span) => {
          const w = span * 3;
          const updated = currentGrid.map((p) =>
            p.widgetId === widgetId ? { ...p, w } : p,
          );
          handleLayoutChange(updated);
        }}
      />

      <AddWidgetDialog
        open={addWidgetOpen}
        onOpenChange={setAddWidgetOpen}
        onCreateWidget={(data) => createWidget.mutateAsync(data).then(() => setAddWidgetOpen(false))}
        onGenerateWidget={(prompt) => generateWidget.mutateAsync(prompt).then(() => setAddWidgetOpen(false))}
      />
    </div>
  );
}
