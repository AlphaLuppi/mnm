import { Clock } from "lucide-react";

export function TimelineBar() {
  return (
    <div className="flex items-center gap-2 h-[40px] px-4 text-muted-foreground bg-muted/30">
      <Clock className="h-4 w-4 shrink-0" />
      <span className="text-xs">Timeline — sprint progress and milestones will appear here</span>
    </div>
  );
}
