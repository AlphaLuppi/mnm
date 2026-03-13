"use client";

import { useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  oldLine: string | null;
  newLine: string | null;
  oldNum: number | null;
  newNum: number | null;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const actions: ("equal" | "delete" | "insert")[] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      actions.unshift("equal");
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      actions.unshift("delete");
      i--;
    } else {
      actions.unshift("insert");
      j--;
    }
  }
  while (i > 0) {
    actions.unshift("delete");
    i--;
  }
  while (j > 0) {
    actions.unshift("insert");
    j--;
  }

  let oldIdx = 0,
    newIdx = 0;
  for (const action of actions) {
    if (action === "equal") {
      result.push({
        type: "unchanged",
        oldLine: oldLines[oldIdx],
        newLine: newLines[newIdx],
        oldNum: oldIdx + 1,
        newNum: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
    } else if (action === "delete") {
      result.push({
        type: "removed",
        oldLine: oldLines[oldIdx],
        newLine: null,
        oldNum: oldIdx + 1,
        newNum: null,
      });
      oldIdx++;
    } else {
      result.push({
        type: "added",
        oldLine: null,
        newLine: newLines[newIdx],
        oldNum: null,
        newNum: newIdx + 1,
      });
      newIdx++;
    }
  }

  return result;
}

export function DiffViewer({
  oldContent,
  newContent,
  oldTitle = "Original",
  newTitle = "Modified",
}: DiffViewerProps) {
  const lines = computeDiff(oldContent, newContent);
  const additions = lines.filter((l) => l.type === "added").length;
  const deletions = lines.filter((l) => l.type === "removed").length;

  const scrollRef = useRef<HTMLDivElement>(null);

  const lineClass = useCallback((type: DiffLine["type"]) => {
    switch (type) {
      case "added":
        return "bg-green-500/10 dark:bg-green-500/15";
      case "removed":
        return "bg-red-500/10 dark:bg-red-500/15";
      default:
        return "";
    }
  }, []);

  return (
    <div className="flex h-full flex-col rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
            +{additions}
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400">
            -{deletions}
          </Badge>
        </div>
      </div>

      {/* Side-by-side diff */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="grid grid-cols-2 divide-x">
          {/* Column headers */}
          <div className="border-b bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
            {oldTitle}
          </div>
          <div className="border-b bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
            {newTitle}
          </div>

          {/* Lines */}
          {lines.map((line, idx) => (
            <div key={idx} className="contents">
              {/* Old side */}
              <div
                className={cn(
                  "flex font-mono text-xs",
                  line.type === "removed" && "bg-red-500/10 dark:bg-red-500/15"
                )}
              >
                <span className="w-10 shrink-0 select-none px-2 py-0.5 text-right text-muted-foreground/50">
                  {line.oldNum ?? ""}
                </span>
                <span className="whitespace-pre px-2 py-0.5">
                  {line.oldLine ?? ""}
                </span>
              </div>

              {/* New side */}
              <div
                className={cn(
                  "flex font-mono text-xs",
                  line.type === "added" && "bg-green-500/10 dark:bg-green-500/15"
                )}
              >
                <span className="w-10 shrink-0 select-none px-2 py-0.5 text-right text-muted-foreground/50">
                  {line.newNum ?? ""}
                </span>
                <span className="whitespace-pre px-2 py-0.5">
                  {line.newLine ?? ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
