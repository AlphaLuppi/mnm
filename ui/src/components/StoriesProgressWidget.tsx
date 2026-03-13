import type { BmadEpic } from "@mnm/shared";
import { cn } from "../lib/utils";

interface StoriesProgressWidgetProps {
  epics: BmadEpic[];
  onEpicClick?: (epicNumber: number) => void;
}

export function StoriesProgressWidget({ epics, onEpicClick }: StoriesProgressWidgetProps) {
  if (epics.length === 0) {
    return (
      <div className="border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">No epics found.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Epic Progress
        </h3>
      </div>
      <div className="divide-y divide-border">
        {epics.map((epic) => {
          const pct = epic.progress.total > 0
            ? Math.round((epic.progress.done / epic.progress.total) * 100)
            : 0;
          const isClickable = !!onEpicClick;

          return (
            <div
              key={epic.number}
              className={cn(
                "px-4 py-3",
                isClickable && "cursor-pointer hover:bg-accent/50 transition-colors",
              )}
              onClick={isClickable ? () => onEpicClick(epic.number) : undefined}
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-sm font-medium truncate">
                  Epic {epic.number}{epic.title ? `: ${epic.title}` : ""}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {epic.progress.done}/{epic.progress.total} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct === 100 ? "bg-green-500" : pct > 0 ? "bg-blue-500" : "bg-muted-foreground/20",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
