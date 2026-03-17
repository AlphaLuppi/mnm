import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import {
  Search,
  Scan,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Bot,
  Clock,
  DollarSign,
  Loader2,
} from "lucide-react";
import { tracesApi, type TraceFilters, type TraceStatus } from "../api/traces";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
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
import { formatTokens, relativeTime, formatDuration, formatCost } from "../lib/utils";

const PAGE_SIZE = 25;

function statusVariant(status: TraceStatus): "secondary" | "outline" | "destructive" | "default" {
  switch (status) {
    case "running":
      return "default";
    case "completed":
      return "secondary";
    case "failed":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

function statusLabel(status: TraceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function Traces() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Traces" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const resetPage = useCallback(() => setPage(0), []);

  // Build filters
  const filters: TraceFilters = useMemo(
    () => ({
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter !== "all" && { status: statusFilter as TraceStatus }),
      ...(agentFilter !== "all" && { agentId: agentFilter }),
      limit: PAGE_SIZE,
      cursor: page > 0 ? String(page * PAGE_SIZE) : undefined,
    }),
    [debouncedSearch, statusFilter, agentFilter, page],
  );

  // Queries
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.traces.list(selectedCompanyId!, filters as unknown as Record<string, unknown>),
    queryFn: () => tracesApi.list(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(a.id, a.name);
    return map;
  }, [agents]);

  const traces = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setAgentFilter("all");
    setPage(0);
  };

  if (isLoading) {
    return (
      <div data-testid="trace-09-loading">
        <PageSkeleton variant="list" />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="trace-09-error" className="p-4 text-sm text-destructive">
        Failed to load traces: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div data-testid="trace-09-page" className="space-y-4">
      {/* Header */}
      <div data-testid="trace-09-header" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 data-testid="trace-09-title" className="text-lg font-semibold">
          Traces
        </h1>
      </div>

      {/* Filters */}
      <div data-testid="trace-09-filters" className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="trace-09-filter-search"
            placeholder="Search traces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
            aria-label="Search traces"
          />
        </div>

        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); resetPage(); }}>
          <SelectTrigger
            data-testid="trace-09-filter-status"
            size="sm"
            className="w-[130px]"
            aria-label="Filter by status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={agentFilter} onValueChange={(val) => { setAgentFilter(val); resetPage(); }}>
          <SelectTrigger
            data-testid="trace-09-filter-agent"
            size="sm"
            className="w-[160px]"
            aria-label="Filter by agent"
          >
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {(agents ?? []).map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          data-testid="trace-09-filter-clear"
          variant="ghost"
          size="sm"
          onClick={clearFilters}
        >
          Clear Filters
        </Button>
      </div>

      {/* Table */}
      {traces.length === 0 ? (
        <div data-testid="trace-09-empty">
          <EmptyState
            icon={Scan}
            message="No traces recorded yet. Traces appear when agents run."
          />
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table data-testid="trace-09-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Agent
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Duration
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Cost
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                  Tokens
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr
                  key={trace.id}
                  data-testid={`trace-09-row-${trace.id}`}
                  className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/traces/${trace.id}`}
                      className="flex items-center gap-2 no-underline text-inherit hover:text-foreground"
                      data-testid={`trace-09-link-${trace.id}`}
                    >
                      <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate max-w-[120px]">
                        {agentMap.get(trace.agentId) ?? trace.agentId.slice(0, 8)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/traces/${trace.id}`}
                      className="text-xs truncate max-w-[200px] block no-underline text-inherit hover:text-foreground"
                    >
                      {trace.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant(trace.status)}>
                      {trace.status === "running" && (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {statusLabel(trace.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(trace.totalDurationMs)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCost(trace.totalCostUsd)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {formatTokens(trace.totalTokensIn + trace.totalTokensOut)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {relativeTime(trace.startedAt)}
                    </span>
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
          data-testid="trace-09-pagination"
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span className="text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {total} traces
          </span>
          <div className="flex items-center gap-2">
            <Button
              data-testid="trace-09-pagination-prev"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1}
            </span>
            <Button
              data-testid="trace-09-pagination-next"
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
    </div>
  );
}
