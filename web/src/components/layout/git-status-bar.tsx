"use client";

import useSWR from "swr";
import { GitBranch, GitCommitHorizontal, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function GitStatusBar() {
  const { data, error } = useSWR("/api/git/status", fetcher, {
    refreshInterval: 10_000,
  });

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Git error</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" />
        <span className="font-mono">...</span>
      </div>
    );
  }

  if (!data.isRepo) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>No git repo</span>
      </div>
    );
  }

  const { branch, latestCommitSha, status } = data;
  const shortSha = latestCommitSha?.slice(0, 7) ?? "";
  const totalChanges = (status?.staged ?? 0) + (status?.unstaged ?? 0) + (status?.untracked ?? 0);

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5" />
        <span className="font-mono">{branch}</span>
      </div>
      {shortSha && (
        <div className="flex items-center gap-1.5">
          <GitCommitHorizontal className="h-3.5 w-3.5" />
          <span className="font-mono">{shortSha}</span>
        </div>
      )}
      {totalChanges > 0 && (
        <div className="flex items-center gap-1">
          {status.staged > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              +{status.staged}
            </Badge>
          )}
          {status.unstaged > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              ~{status.unstaged}
            </Badge>
          )}
          {status.untracked > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              ?{status.untracked}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
