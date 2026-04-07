import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../../api/issues";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { StatusIcon } from "../StatusIcon";
import { PriorityIcon } from "../PriorityIcon";
import { Identity } from "../Identity";
import { timeAgo } from "../../lib/timeAgo";
import type { WidgetProps } from "./types";

export default function RecentIssuesWidget({ companyId }: WidgetProps) {
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const recentIssues = useMemo(
    () => [...(issues ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10),
    [issues],
  );

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card h-full flex flex-col overflow-hidden">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 shrink-0">Recent Tasks</h3>
      {recentIssues.length === 0 ? (
        <div className="rounded-md p-4"><p className="text-sm text-muted-foreground">No tasks yet.</p></div>
      ) : (
        <div className="divide-y divide-border overflow-hidden flex-1 min-h-0 overflow-y-auto">
          {recentIssues.map((issue) => (
            <Link
              key={issue.id}
              to={`/issues/${issue.identifier ?? issue.id}`}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
            >
              <div className="flex gap-2 min-w-0">
                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <PriorityIcon priority={issue.priority} />
                    <StatusIcon status={issue.status} />
                  </div>
                  <p className="min-w-0 flex-1 truncate">
                    <span>{issue.title}</span>
                    {issue.assigneeAgentId && (() => {
                      const name = agentName(issue.assigneeAgentId);
                      return name ? <span className="hidden sm:inline"><Identity name={name} size="sm" className="ml-2 inline-flex" /></span> : null;
                    })()}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5 hidden sm:block">{timeAgo(issue.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
