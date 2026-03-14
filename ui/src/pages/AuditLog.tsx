import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Search,
  Download,
  ShieldCheck,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  AUDIT_ACTOR_TYPES,
  AUDIT_SEVERITY_LEVELS,
  AUDIT_TARGET_TYPES,
  AUDIT_ACTIONS,
  type AuditEvent,
  type AuditVerifyResult,
} from "@mnm/shared";
import { auditApi, type AuditFilters } from "../api/audit";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { usePermissions } from "../hooks/usePermissions";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { AuditEventDetail } from "../components/AuditEventDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 50;

function severityVariant(severity: string): "secondary" | "outline" | "destructive" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "error":
      return "destructive";
    case "warning":
      return "outline";
    default:
      return "secondary";
  }
}

function truncateId(id: string): string {
  if (id.length > 16) return id.slice(0, 8) + "...";
  return id;
}

export function AuditLog() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { hasPermission } = usePermissions();
  const canExport = hasPermission("audit:export");

  // Breadcrumbs
  useEffect(() => {
    setBreadcrumbs([{ label: "Audit Log" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actorType, setActorType] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [targetType, setTargetType] = useState<string>("all");
  const [targetId, setTargetId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail modal state
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Verify state
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Export loading
  const [exportLoading, setExportLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Reset page when filters change
  const resetPage = useCallback(() => setPage(0), []);

  // Build filters for API
  const filters: AuditFilters = useMemo(() => ({
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(actorType !== "all" && { actorType }),
    ...(severity !== "all" && { severity }),
    ...(action !== "all" && { action }),
    ...(targetType !== "all" && { targetType }),
    ...(targetId && { targetId }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortOrder,
  }), [debouncedSearch, actorType, severity, action, targetType, targetId, dateFrom, dateTo, page, sortOrder]);

  // Export filters (same but without pagination)
  const exportFilters = useMemo(() => {
    const { limit, offset, sortOrder: _so, ...rest } = filters;
    return rest;
  }, [filters]);

  // Query audit events
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.audit.list(selectedCompanyId!, filters as unknown as Record<string, unknown>),
    queryFn: () => auditApi.list(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  const events = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  // Handle verify
  const handleVerify = async () => {
    if (!selectedCompanyId) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const result = await auditApi.verify(selectedCompanyId);
      setVerifyResult(result);
    } catch {
      setVerifyResult({ valid: false, eventsChecked: 0, firstEventId: null, lastEventId: null, brokenAt: "unknown" });
    } finally {
      setVerifyLoading(false);
    }
  };

  // Handle export
  const handleExportCsv = async () => {
    if (!selectedCompanyId) return;
    setExportLoading(true);
    try {
      await auditApi.exportCsv(selectedCompanyId, exportFilters);
    } catch {
      // silently fail — user sees no download
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportJson = async () => {
    if (!selectedCompanyId) return;
    setExportLoading(true);
    try {
      await auditApi.exportJson(selectedCompanyId, exportFilters);
    } catch {
      // silently fail
    } finally {
      setExportLoading(false);
    }
  };

  // Handle row click
  const handleRowClick = (event: AuditEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  };

  // Handle row keyboard
  const handleRowKeyDown = (e: React.KeyboardEvent, event: AuditEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick(event);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setActorType("all");
    setSeverity("all");
    setAction("all");
    setTargetType("all");
    setTargetId("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    setSortOrder("desc");
  };

  // Filter change handlers that reset page
  const handleActorTypeChange = (val: string) => { setActorType(val); resetPage(); };
  const handleSeverityChange = (val: string) => { setSeverity(val); resetPage(); };
  const handleActionChange = (val: string) => { setAction(val); resetPage(); };
  const handleTargetTypeChange = (val: string) => { setTargetType(val); resetPage(); };
  const handleTargetIdChange = (e: React.ChangeEvent<HTMLInputElement>) => { setTargetId(e.target.value); resetPage(); };
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => { setDateFrom(e.target.value); resetPage(); };
  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => { setDateTo(e.target.value); resetPage(); };

  if (isLoading) {
    return (
      <div data-testid="obs-s04-loading">
        <PageSkeleton variant="list" />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="obs-s04-error-state" className="p-4 text-sm text-destructive">
        Failed to load audit events: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div data-testid="obs-s04-page" className="space-y-4">
      {/* Header */}
      <div data-testid="obs-s04-header" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 data-testid="obs-s04-title" className="text-lg font-semibold">
          Audit Log
        </h1>
        <div className="flex items-center gap-2">
          <Button
            data-testid="obs-s04-verify-button"
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={verifyLoading}
          >
            {verifyLoading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-1.5" />
            )}
            Verify Integrity
          </Button>
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-testid="obs-s04-export-menu"
                  variant="outline"
                  size="sm"
                  disabled={exportLoading}
                >
                  {exportLoading ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1.5" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  data-testid="obs-s04-export-csv"
                  onClick={handleExportCsv}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="obs-s04-export-json"
                  onClick={handleExportJson}
                >
                  Export JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Verify result */}
      {verifyResult && (
        <div
          data-testid="obs-s04-verify-result"
          className={`rounded-md border px-4 py-3 text-sm ${
            verifyResult.valid
              ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {verifyResult.valid
            ? `Hash chain verified: ${verifyResult.eventsChecked} events checked`
            : `Hash chain broken at event ${verifyResult.brokenAt ?? "unknown"}`}
        </div>
      )}

      {/* Filters */}
      <div data-testid="obs-s04-filters" className="space-y-2">
        {/* Row 1 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="obs-s04-filter-search"
              placeholder="Search audit events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
              aria-label="Search audit events"
            />
          </div>

          <Select value={actorType} onValueChange={handleActorTypeChange}>
            <SelectTrigger
              data-testid="obs-s04-filter-actor-type"
              size="sm"
              className="w-[130px]"
              aria-label="Filter by actor type"
            >
              <SelectValue placeholder="Actor Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {AUDIT_ACTOR_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={severity} onValueChange={handleSeverityChange}>
            <SelectTrigger
              data-testid="obs-s04-filter-severity"
              size="sm"
              className="w-[130px]"
              aria-label="Filter by severity"
            >
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              {AUDIT_SEVERITY_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            data-testid="obs-s04-filter-date-from"
            type="datetime-local"
            value={dateFrom}
            onChange={handleDateFromChange}
            className="h-8 w-[180px]"
            aria-label="Date from"
          />

          <Input
            data-testid="obs-s04-filter-date-to"
            type="datetime-local"
            value={dateTo}
            onChange={handleDateToChange}
            className="h-8 w-[180px]"
            aria-label="Date to"
          />
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={action} onValueChange={handleActionChange}>
            <SelectTrigger
              data-testid="obs-s04-filter-action"
              size="sm"
              className="w-[200px]"
              aria-label="Filter by action"
            >
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={targetType} onValueChange={handleTargetTypeChange}>
            <SelectTrigger
              data-testid="obs-s04-filter-target-type"
              size="sm"
              className="w-[150px]"
              aria-label="Filter by target type"
            >
              <SelectValue placeholder="Target Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All targets</SelectItem>
              {AUDIT_TARGET_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            data-testid="obs-s04-filter-target-id"
            placeholder="Target ID..."
            value={targetId}
            onChange={handleTargetIdChange}
            className="h-8 w-[180px]"
            aria-label="Filter by target ID"
          />

          <Button
            data-testid="obs-s04-filter-clear"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <div data-testid="obs-s04-empty-state">
          <EmptyState
            icon={ScrollText}
            message="No audit events recorded yet."
          />
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table data-testid="obs-s04-table" className="w-full text-sm">
            <thead data-testid="obs-s04-table-header">
              <tr className="border-b border-border bg-muted/30">
                <th
                  data-testid="obs-s04-col-timestamp"
                  className="text-left px-4 py-2.5 font-medium text-muted-foreground"
                >
                  <button
                    data-testid="obs-s04-sort-order"
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                  >
                    Timestamp
                    <ArrowUpDown className="h-3 w-3" />
                    <span className="text-xs">({sortOrder})</span>
                  </button>
                </th>
                <th
                  data-testid="obs-s04-col-action"
                  className="text-left px-4 py-2.5 font-medium text-muted-foreground"
                >
                  Action
                </th>
                <th
                  data-testid="obs-s04-col-actor"
                  className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell"
                >
                  Actor
                </th>
                <th
                  data-testid="obs-s04-col-target"
                  className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell"
                >
                  Target
                </th>
                <th
                  data-testid="obs-s04-col-severity"
                  className="text-left px-4 py-2.5 font-medium text-muted-foreground"
                >
                  Severity
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  data-testid={`obs-s04-row-${event.id}`}
                  role="button"
                  tabIndex={0}
                  className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(event)}
                  onKeyDown={(e) => handleRowKeyDown(e, event)}
                >
                  <td
                    data-testid={`obs-s04-cell-timestamp-${event.id}`}
                    className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap"
                  >
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td
                    data-testid={`obs-s04-cell-action-${event.id}`}
                    className="px-4 py-2.5 font-mono text-xs"
                  >
                    {event.action}
                  </td>
                  <td
                    data-testid={`obs-s04-cell-actor-${event.id}`}
                    className="px-4 py-2.5 hidden md:table-cell"
                  >
                    <span className="text-xs">
                      <span className="text-muted-foreground">{event.actorType}</span>
                      {" "}
                      <span className="font-mono">{truncateId(event.actorId)}</span>
                    </span>
                  </td>
                  <td
                    data-testid={`obs-s04-cell-target-${event.id}`}
                    className="px-4 py-2.5 hidden lg:table-cell"
                  >
                    <span className="text-xs">
                      <span className="text-muted-foreground">{event.targetType}</span>
                      {" "}
                      <span className="font-mono">{truncateId(event.targetId)}</span>
                    </span>
                  </td>
                  <td
                    data-testid={`obs-s04-cell-severity-${event.id}`}
                    className="px-4 py-2.5"
                  >
                    <Badge
                      variant={severityVariant(event.severity)}
                      className={event.severity === "critical" ? "font-bold" : undefined}
                    >
                      {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div
          data-testid="obs-s04-pagination"
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span data-testid="obs-s04-pagination-info" className="text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {total} events
          </span>
          <div className="flex items-center gap-2">
            <Button
              data-testid="obs-s04-pagination-prev"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span data-testid="obs-s04-pagination-page" className="text-sm text-muted-foreground">
              Page {page + 1}
            </span>
            <Button
              data-testid="obs-s04-pagination-next"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <AuditEventDetail
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
