import { FlaskConical } from "lucide-react";

export function TestsPane() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <FlaskConical className="h-8 w-8" />
      <p className="text-sm font-medium">Tests &amp; Validation</p>
      <p className="text-xs text-center max-w-[200px]">
        Test results, validation checks, and quality metrics will appear here.
      </p>
    </div>
  );
}
