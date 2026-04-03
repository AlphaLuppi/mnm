import { FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentModeSelectorProps {
  documentTitle: string;
  onSelectMode: (mode: "summary" | "deep_dive") => void;
  onDismiss: () => void;
}

export function DocumentModeSelector({
  documentTitle,
  onSelectMode,
  onDismiss,
}: DocumentModeSelectorProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm max-w-sm">
      <p className="text-sm font-medium mb-1">Document ready</p>
      <p className="text-xs text-muted-foreground mb-3 truncate">
        {documentTitle}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={() => onSelectMode("summary")}
        >
          <FileText className="h-3.5 w-3.5" />
          Resume rapide
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={() => onSelectMode("deep_dive")}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Deep dive
        </Button>
      </div>
      <button
        type="button"
        className="text-[10px] text-muted-foreground hover:text-foreground mt-2 block mx-auto"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
