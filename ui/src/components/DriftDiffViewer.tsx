import type { DriftItem } from "@mnm/shared";

interface DriftDiffViewerProps {
  drift: DriftItem;
}

export function DriftDiffViewer({ drift }: DriftDiffViewerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Source: {drift.sourceDoc.split("/").pop()}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {drift.sourceExcerpt || "(no excerpt)"}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Target: {drift.targetDoc.split("/").pop()}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {drift.targetExcerpt || "(no excerpt)"}
        </p>
      </div>
    </div>
  );
}
