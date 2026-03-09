import { FileText } from "lucide-react";

export function ContextPane() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <FileText className="h-8 w-8" />
      <p className="text-sm font-medium">Context</p>
      <p className="text-xs text-center max-w-[200px]">
        Project specs, architecture docs, and requirements will appear here.
      </p>
    </div>
  );
}
