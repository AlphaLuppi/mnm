"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommitHorizontal, User, Calendar } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CommitAssociation {
  id: string;
  commitSha: string;
  specId: string;
  referenceType: string;
  commitMessage: string;
  commitAuthor: string | null;
  commitDate: string | null;
}

interface CommitListProps {
  specId: string;
}

export function CommitList({ specId }: CommitListProps) {
  const { data } = useSWR(`/api/specs/${specId}/commits`, fetcher);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);

  const commits: CommitAssociation[] = data?.commits ?? [];

  if (commits.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        Related Commits ({commits.length})
      </h3>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left font-medium">SHA</th>
              <th className="p-2 text-left font-medium">Message</th>
              <th className="p-2 text-left font-medium">Author</th>
              <th className="p-2 text-left font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {commits.map((commit) => (
              <tr key={commit.id} className="border-b last:border-0">
                <td className="p-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 font-mono text-xs"
                    onClick={() => setSelectedSha(commit.commitSha)}
                  >
                    {commit.commitSha.slice(0, 7)}
                  </Button>
                </td>
                <td className="p-2 text-xs truncate max-w-[200px]">
                  {commit.commitMessage.split("\n")[0]}
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {commit.commitAuthor ?? "-"}
                </td>
                <td className="p-2">
                  <Badge variant="outline" className="text-[10px]">
                    {commit.referenceType}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSha && (
        <CommitDetailDialog
          sha={selectedSha}
          open={!!selectedSha}
          onOpenChange={(open) => {
            if (!open) setSelectedSha(null);
          }}
        />
      )}
    </div>
  );
}

function CommitDetailDialog({
  sha,
  open,
  onOpenChange,
}: {
  sha: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useSWR(
    open ? `/api/git/commits/${sha}` : null,
    fetcher
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[70vw] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            Commit {sha.slice(0, 7)}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading commit details...</p>
        )}

        {data && !data.error && (
          <div className="space-y-3 flex-1 min-h-0">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{data.hash}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{data.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{data.date}</span>
              </div>
            </div>

            <div className="rounded-md border p-3 bg-muted/30">
              <pre className="whitespace-pre-wrap text-sm">{data.message}</pre>
            </div>

            {data.diff && (
              <ScrollArea className="flex-1 rounded-md border">
                <pre className="p-3 font-mono text-xs whitespace-pre">
                  {data.diff}
                </pre>
              </ScrollArea>
            )}
          </div>
        )}

        {data?.error && (
          <p className="text-sm text-destructive">
            Error: {data.error.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
