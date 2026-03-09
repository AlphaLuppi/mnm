"use client";

import useSWR from "swr";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Eye, FileText } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SpecChange {
  id: string;
  filePath: string;
  oldCommitSha: string | null;
  newCommitSha: string;
  changeSummary: string;
  detectedAt: number;
  userViewed: number;
}

interface ChangeSummaryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeSummaryPanel({
  open,
  onOpenChange,
}: ChangeSummaryPanelProps) {
  const { data, mutate } = useSWR(
    open ? "/api/git/changes" : null,
    fetcher
  );

  const changes: SpecChange[] = data?.changes ?? [];
  const unviewed = changes.filter((c) => c.userViewed === 0);
  const viewed = changes.filter((c) => c.userViewed === 1);

  async function markViewed(id: string) {
    await fetch(`/api/git/changes/${id}`, { method: "PATCH" });
    await mutate();
  }

  async function markAllViewed() {
    await fetch("/api/git/changes/bulk-view", { method: "PATCH" });
    await mutate();
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Spec Changes</span>
            {unviewed.length > 0 && (
              <Button variant="outline" size="sm" onClick={markAllViewed}>
                <Check className="mr-1 h-3 w-3" />
                Mark All Viewed
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-6rem)] mt-4">
          {changes.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No spec changes detected yet.
            </p>
          )}

          {unviewed.length > 0 && (
            <div className="space-y-2 mb-6">
              <h4 className="text-sm font-medium text-muted-foreground">
                New ({unviewed.length})
              </h4>
              {unviewed.map((change) => (
                <ChangeCard
                  key={change.id}
                  change={change}
                  onMarkViewed={() => markViewed(change.id)}
                />
              ))}
            </div>
          )}

          {viewed.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Previously Viewed ({viewed.length})
              </h4>
              {viewed.map((change) => (
                <ChangeCard key={change.id} change={change} />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ChangeCard({
  change,
  onMarkViewed,
}: {
  change: SpecChange;
  onMarkViewed?: () => void;
}) {
  const shortSha = change.newCommitSha?.slice(0, 7) ?? "";

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-mono truncate">{change.filePath}</span>
        </div>
        {shortSha && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            {shortSha}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{change.changeSummary}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(change.detectedAt)}
        </span>
        <div className="flex items-center gap-1">
          {change.oldCommitSha && change.newCommitSha && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
              <a
                href={`/api/git/diff?file=${encodeURIComponent(change.filePath)}&base=${change.oldCommitSha}&head=${change.newCommitSha}`}
                target="_blank"
                rel="noopener"
              >
                <Eye className="mr-1 h-3 w-3" />
                View Diff
              </a>
            </Button>
          )}
          {onMarkViewed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={onMarkViewed}
            >
              <Check className="mr-1 h-3 w-3" />
              Viewed
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}
