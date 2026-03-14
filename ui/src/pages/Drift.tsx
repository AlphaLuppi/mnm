import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import {
  useDriftResults,
  useDriftResolve,
  useDriftScan,
  useDriftScanStatus,
  useDriftCancelScan,
} from "../hooks/useDriftResults";
import {
  useDriftAlerts,
  useDriftAlertResolve,
  useDriftMonitoringStatus,
} from "../hooks/useDriftAlerts";
import { DriftAlertCard } from "../components/DriftAlertCard";
import { DriftAlertPanel } from "../components/DriftAlertPanel";
import { DriftMonitorToggle } from "../components/DriftMonitorToggle";
import { PageSkeleton } from "../components/PageSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "../lib/utils";
import {
  Radar,
  Play,
  Square,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type { DriftItem, DriftReport, DriftAlertType } from "@mnm/shared";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- Execution alerts filter types ---

interface ExecutionFilters {
  severity?: string;
  alertType?: string;
  status?: string; // "active" | "resolved"
}

const ALERT_TYPE_OPTIONS: { value: DriftAlertType; label: string }[] = [
  { value: "time_exceeded", label: "Time Exceeded" },
  { value: "stagnation", label: "Stagnation" },
  { value: "retry_excessive", label: "Excessive Retries" },
  { value: "stage_skipped", label: "Stage Skipped" },
  { value: "sequence_violation", label: "Sequence Violation" },
];

export function Drift() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [ignoredDriftIds, setIgnoredDriftIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("mnm:ignored-drifts");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Execution alerts filters
  const [execFilters, setExecFilters] = useState<ExecutionFilters>({});

  useEffect(() => {
    setBreadcrumbs([{ label: "Drift Detection" }]);
  }, [setBreadcrumbs]);

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Auto-select first project
  useEffect(() => {
    if (projects?.length && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // ========== Document Drift (existing) ==========

  const { data: reports, isLoading: driftLoading } = useDriftResults(
    selectedProjectId || undefined,
    selectedCompanyId ?? undefined,
  );

  const { data: scanStatus } = useDriftScanStatus(
    selectedProjectId || undefined,
    selectedCompanyId ?? undefined,
  );

  const scanMutation = useDriftScan(
    selectedProjectId || undefined,
    selectedCompanyId ?? undefined,
  );

  const cancelMutation = useDriftCancelScan(
    selectedProjectId || undefined,
    selectedCompanyId ?? undefined,
  );

  const resolveMutation = useDriftResolve(
    selectedProjectId || undefined,
    selectedCompanyId ?? undefined,
  );

  // Flatten all drifts from all reports
  const allDrifts = useMemo(() => {
    if (!reports?.length) return [];
    const drifts: (DriftItem & { reportId: string; checkedAt: string })[] = [];
    for (const report of reports) {
      for (const drift of report.drifts) {
        if (!ignoredDriftIds.has(drift.id)) {
          drifts.push({
            ...drift,
            reportId: report.id,
            checkedAt: report.checkedAt,
          });
        }
      }
    }
    return drifts;
  }, [reports, ignoredDriftIds]);

  // Stats for document drifts
  const pendingCount = allDrifts.filter(
    (d) => d.decision === "pending",
  ).length;
  const criticalCount = allDrifts.filter(
    (d) => d.severity === "critical" && d.decision === "pending",
  ).length;
  const resolvedCount = allDrifts.filter(
    (d) => d.decision !== "pending",
  ).length;

  function handleScan() {
    scanMutation.mutate({ scope: "all" });
  }

  function handleCancel() {
    cancelMutation.mutate();
  }

  function handleAccept(drift: DriftItem) {
    resolveMutation.mutate({ driftId: drift.id, decision: "accepted" });
  }

  function handleReject(drift: DriftItem) {
    resolveMutation.mutate({ driftId: drift.id, decision: "rejected" });
  }

  function handleIgnore(drift: DriftItem) {
    setIgnoredDriftIds((prev) => {
      const next = new Set(prev);
      next.add(drift.id);
      localStorage.setItem("mnm:ignored-drifts", JSON.stringify([...next]));
      return next;
    });
  }

  // After scan completes, refresh results
  useEffect(() => {
    if (
      scanStatus &&
      !scanStatus.scanning &&
      scanStatus.lastScanAt &&
      selectedProjectId
    ) {
      qc.invalidateQueries({
        queryKey: queryKeys.drift.results(selectedProjectId),
      });
    }
  }, [scanStatus?.scanning, scanStatus?.lastScanAt, selectedProjectId, qc]);

  // ========== Execution Drift Alerts (DRIFT-S03) ==========

  const alertsQuery = useDriftAlerts(selectedCompanyId ?? undefined, {
    severity: execFilters.severity,
  });

  const { data: monitoringStatus } = useDriftMonitoringStatus(
    selectedCompanyId ?? undefined,
  );

  const alertResolveMutation = useDriftAlertResolve(
    selectedCompanyId ?? undefined,
  );

  // Client-side filter for alertType and status (server only supports severity)
  const filteredAlerts = useMemo(() => {
    const alerts = alertsQuery.data?.data ?? [];
    return alerts
      .filter((a) => {
        if (execFilters.alertType && a.alertType !== execFilters.alertType)
          return false;
        if (execFilters.status === "active" && a.resolved) return false;
        if (execFilters.status === "resolved" && !a.resolved) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [alertsQuery.data, execFilters]);

  // Active (unresolved) alert count for the tab badge
  const activeAlertCount = useMemo(() => {
    const alerts = alertsQuery.data?.data ?? [];
    return alerts.filter((a) => !a.resolved).length;
  }, [alertsQuery.data]);

  function handleAlertResolve(
    alertId: string,
    resolution: "acknowledged" | "ignored" | "remediated",
    note?: string,
  ) {
    alertResolveMutation.mutate({ alertId, resolution, note });
  }

  function clearExecFilters() {
    setExecFilters({});
  }

  const hasExecFilters =
    execFilters.severity || execFilters.alertType || execFilters.status;

  const isMonitoringActive = monitoringStatus?.active ?? false;

  // ========== Render ==========

  if (projectsLoading) return <PageSkeleton />;

  const isScanning = scanStatus?.scanning ?? false;
  const hasResults = allDrifts.length > 0;
  const hasEverScanned = !!scanStatus?.lastScanAt;

  return (
    <div className="space-y-6" data-testid="drift-s03-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Drift Detection</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Project selector */}
          {projects && projects.length > 1 && (
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tabs: Documents | Execution Alerts */}
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger
            value="documents"
            data-testid="drift-s03-tab-documents"
          >
            Documents
          </TabsTrigger>
          <TabsTrigger
            value="execution"
            data-testid="drift-s03-tab-execution"
            className="flex items-center gap-1.5"
          >
            Execution Alerts
            {activeAlertCount > 0 && (
              <span
                data-testid="drift-s03-tab-execution-count"
                className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-medium leading-none"
              >
                {activeAlertCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ========== Tab: Documents (existing content) ========== */}
        <TabsContent value="documents">
          <div className="space-y-6 pt-4">
            {/* Scan controls */}
            <div className="flex items-center justify-end gap-3">
              {isScanning ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                >
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Scan
                </Button>
              ) : (
                <Button
                  onClick={handleScan}
                  disabled={!selectedProjectId || scanMutation.isPending}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Scan for Drift
                </Button>
              )}
            </div>

            {/* Scan progress */}
            {isScanning && scanStatus && (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {scanStatus.progress ?? "Scanning..."}
                    </p>
                    {scanStatus.total > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.round((scanStatus.completed / scanStatus.total) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {scanStatus.completed} / {scanStatus.total} pairs
                          analyzed
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Last scan info + stats */}
            {hasEverScanned && !isScanning && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last scanned: {timeAgo(scanStatus!.lastScanAt!)}
                </span>
                {scanStatus!.lastScanIssueCount !== null && (
                  <span>
                    {scanStatus!.lastScanIssueCount} issue
                    {scanStatus!.lastScanIssueCount !== 1 ? "s" : ""} found
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {pendingCount} pending
                    {criticalCount > 0 && ` (${criticalCount} critical)`}
                  </span>
                )}
                {resolvedCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {resolvedCount} resolved
                  </span>
                )}
              </div>
            )}

            {/* Empty state */}
            {!hasResults && !isScanning && !driftLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-muted/50 rounded-full p-5 mb-5">
                  <Search className="h-10 w-10 text-muted-foreground/50" />
                </div>
                {hasEverScanned ? (
                  <>
                    <h3 className="text-sm font-medium mb-1">
                      No drift detected
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Your planning artifacts are aligned. Run another scan
                      after making changes to verify consistency.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-medium mb-1">
                      No drift scans yet
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-4">
                      Run a scan to check for misalignment between your planning
                      artifacts (PRD, Architecture, Product Brief).
                    </p>
                    <Button
                      onClick={handleScan}
                      disabled={!selectedProjectId}
                    >
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Scan for Drift
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Drift results */}
            {hasResults && !driftLoading && (
              <div className="space-y-3">
                {allDrifts.map((drift) => (
                  <DriftAlertCard
                    key={drift.id}
                    drift={drift}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onIgnore={handleIgnore}
                  />
                ))}
              </div>
            )}

            {driftLoading && <PageSkeleton />}
          </div>
        </TabsContent>

        {/* ========== Tab: Execution Alerts (DRIFT-S03) ========== */}
        <TabsContent value="execution">
          <div className="space-y-4 pt-4">
            {/* Monitor toggle */}
            <DriftMonitorToggle companyId={selectedCompanyId ?? undefined} />

            {/* Filters */}
            <div
              data-testid="drift-s03-filters"
              className="flex flex-wrap items-center gap-2"
            >
              <Select
                value={execFilters.severity ?? ""}
                onValueChange={(v) =>
                  setExecFilters((f) => ({
                    ...f,
                    severity: v || undefined,
                  }))
                }
              >
                <SelectTrigger
                  data-testid="drift-s03-filter-severity"
                  className="w-[140px] h-8 text-xs"
                >
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={execFilters.alertType ?? ""}
                onValueChange={(v) =>
                  setExecFilters((f) => ({
                    ...f,
                    alertType: v || undefined,
                  }))
                }
              >
                <SelectTrigger
                  data-testid="drift-s03-filter-type"
                  className="w-[180px] h-8 text-xs"
                >
                  <SelectValue placeholder="Alert Type" />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={execFilters.status ?? ""}
                onValueChange={(v) =>
                  setExecFilters((f) => ({
                    ...f,
                    status: v || undefined,
                  }))
                }
              >
                <SelectTrigger
                  data-testid="drift-s03-filter-status"
                  className="w-[130px] h-8 text-xs"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              {hasExecFilters && (
                <Button
                  data-testid="drift-s03-filter-clear"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={clearExecFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Loading */}
            {alertsQuery.isLoading && (
              <div data-testid="drift-s03-loading">
                <PageSkeleton />
              </div>
            )}

            {/* Error */}
            {alertsQuery.error && (
              <div
                data-testid="drift-s03-error"
                className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300"
              >
                Failed to load drift alerts. Please try again.
              </div>
            )}

            {/* Empty state: monitoring off */}
            {!alertsQuery.isLoading &&
              !alertsQuery.error &&
              !isMonitoringActive &&
              filteredAlerts.length === 0 && (
                <div
                  data-testid="drift-s03-empty-monitoring-off"
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="bg-muted/50 rounded-full p-5 mb-5">
                    <ShieldAlert className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">
                    Drift monitoring is not active
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Enable drift monitoring to detect execution deviations in
                    real-time (time exceeded, stagnation, sequence violations).
                  </p>
                </div>
              )}

            {/* Empty state: no alerts */}
            {!alertsQuery.isLoading &&
              !alertsQuery.error &&
              isMonitoringActive &&
              filteredAlerts.length === 0 && (
                <div
                  data-testid="drift-s03-empty-no-alerts"
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-full p-5 mb-5">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">
                    No drift alerts detected
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Drift monitoring is active. Alerts will appear here when
                    execution deviations are detected.
                  </p>
                </div>
              )}

            {/* Alerts list */}
            {!alertsQuery.isLoading && filteredAlerts.length > 0 && (
              <div data-testid="drift-s03-alerts-list" className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <DriftAlertPanel
                    key={alert.id}
                    alert={alert}
                    onResolve={handleAlertResolve}
                    isResolving={alertResolveMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
