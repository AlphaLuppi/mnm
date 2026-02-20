"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiffViewer } from "@/components/shared/diff-viewer";
import { DiffNavigator } from "@/components/specs/diff-navigator";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SpecDiffViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: { filePath: string; oldSha: string; newSha: string }[];
  initialIndex?: number;
}

export function SpecDiffViewer({
  open,
  onOpenChange,
  files,
  initialIndex = 0,
}: SpecDiffViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const currentFile = files[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] h-[85vh] flex flex-col">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center justify-between">
            <span className="font-mono text-sm truncate">
              {currentFile?.filePath ?? "Diff Viewer"}
            </span>
          </DialogTitle>
          <DiffNavigator
            files={files.map((f) => f.filePath)}
            currentIndex={currentIndex}
            onNavigate={setCurrentIndex}
          />
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {currentFile && (
            <DiffContent
              filePath={currentFile.filePath}
              oldSha={currentFile.oldSha}
              newSha={currentFile.newSha}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiffContent({
  filePath,
  oldSha,
  newSha,
}: {
  filePath: string;
  oldSha: string;
  newSha: string;
}) {
  const { data, error, isLoading } = useSWR(
    `/api/git/diff?file=${encodeURIComponent(filePath)}&base=${oldSha}&head=${newSha}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <p className="text-sm text-destructive p-4">
        Failed to load diff: {data?.error?.message ?? "Unknown error"}
      </p>
    );
  }

  // Reconstruct old/new content from parsed diff for the DiffViewer
  // The diff API returns parsed hunks; we'll render using old/new content approach
  const oldLines: string[] = [];
  const newLines: string[] = [];

  if (data?.hunks) {
    for (const hunk of data.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "removed") {
          oldLines.push(line.content);
        } else if (line.type === "added") {
          newLines.push(line.content);
        } else {
          oldLines.push(line.content);
          newLines.push(line.content);
        }
      }
    }
  }

  return (
    <DiffViewer
      oldContent={oldLines.join("\n")}
      newContent={newLines.join("\n")}
      oldTitle={`${filePath} @ ${oldSha.slice(0, 7)}`}
      newTitle={`${filePath} @ ${newSha.slice(0, 7)}`}
    />
  );
}
