import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { feedbackApi } from "../api/feedback";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquareHeart,
  TrendingUp,
} from "lucide-react";

export function FeedbackDashboard() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Feedback" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: queryKeys.feedback.summary(selectedCompanyId!),
    queryFn: () => feedbackApi.getSummary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (isLoading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load feedback summary."}
      </div>
    );
  }

  if (!summary || summary.totalVotes === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={MessageSquareHeart}
          message="No feedback yet. Vote on agent comments in issues to see analytics here."
        />
      </div>
    );
  }

  const approvalRate =
    summary.totalVotes > 0
      ? Math.round((summary.upVotes / summary.totalVotes) * 100)
      : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-lg font-semibold">Feedback</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/60">
              <MessageSquareHeart className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Votes</p>
              <p className="text-xl font-semibold">{summary.totalVotes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10">
              <ThumbsUp className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Upvotes</p>
              <p className="text-xl font-semibold">{summary.upVotes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-500/10">
              <ThumbsDown className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Downvotes</p>
              <p className="text-xl font-semibold">{summary.downVotes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/60">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Approval Rate</p>
              <p className="text-xl font-semibold">{approvalRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-agent table */}
      {summary.byAgent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">By Agent</h2>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Up</span>
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> Down</span>
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Approval</th>
                </tr>
              </thead>
              <tbody>
                {summary.byAgent.map((agent) => (
                  <tr key={agent.agentId} className="border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2 font-medium">{agent.agentName}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{agent.totalVotes}</td>
                    <td className="px-4 py-2 text-right text-green-600">{agent.upVotes}</td>
                    <td className="px-4 py-2 text-right text-orange-600">{agent.downVotes}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={agent.approvalRate >= 70 ? "text-green-600" : agent.approvalRate >= 40 ? "text-yellow-600" : "text-orange-600"}>
                        {Math.round(agent.approvalRate)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent downvote reasons */}
      {summary.recentDownvoteReasons.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Recent Downvote Reasons</h2>
          <ul className="space-y-1.5">
            {summary.recentDownvoteReasons.map((reason, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground border border-border rounded-md px-3 py-2"
              >
                <ThumbsDown className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
