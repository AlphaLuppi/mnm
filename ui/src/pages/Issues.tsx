import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useSearchParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { IssuesList } from "../components/IssuesList";
import { Button } from "@/components/ui/button";
import { CircleDot, Inbox } from "lucide-react";
import { cn } from "../lib/utils";

export function Issues() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showPool, setShowPool] = useState(searchParams.get("pool") === "true");

  const initialSearch = searchParams.get("q") ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((search: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmedSearch = search.trim();
      const currentSearch = new URLSearchParams(window.location.search).get("q") ?? "";
      if (currentSearch === trimmedSearch) return;

      const url = new URL(window.location.href);
      if (trimmedSearch) {
        url.searchParams.set("q", trimmedSearch);
      } else {
        url.searchParams.delete("q");
      }

      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }, 300);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Issues" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), { pool: showPool }],
    queryFn: () => issuesApi.list(selectedCompanyId!, showPool ? { pool: true } : undefined),
    enabled: !!selectedCompanyId,
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  // "Take" action: self-assign a pool issue to the current user
  const takeIssue = useMutation({
    mutationFn: (issueId: string) =>
      issuesApi.update(issueId, { assigneeUserId: "me", status: "todo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleDot} message="Select a company to view issues." />;
  }

  return (
    <div className="space-y-4">
      {/* Tab bar: All Issues / Pool */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          className={cn(
            "px-3 py-1.5 text-sm font-medium border-b-2 transition-colors",
            !showPool
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setShowPool(false)}
        >
          All Issues
        </button>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors",
            showPool
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setShowPool(true)}
        >
          <Inbox className="h-3.5 w-3.5" />
          Pool
        </button>
      </div>

      <IssuesList
        issues={issues ?? []}
        isLoading={isLoading}
        error={error as Error | null}
        agents={agents}
        liveIssueIds={liveIssueIds}
        viewStateKey={showPool ? "mnm:pool-view" : "mnm:issues-view"}
        initialAssignees={searchParams.get("assignee") ? [searchParams.get("assignee")!] : undefined}
        initialSearch={initialSearch}
        onSearchChange={handleSearchChange}
        onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
        poolMode={showPool}
        onTakeIssue={showPool ? (id) => takeIssue.mutate(id) : undefined}
      />
    </div>
  );
}
