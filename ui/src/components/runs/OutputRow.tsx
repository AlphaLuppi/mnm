/**
 * ARTIFACT-VIEWER T4.1 — `OutputRow` extracted from `GovernedWorkflowRunDetail`.
 *
 * Renders a single persisted step output (`OutputPersisted`) in a compact
 * single-line row. Reused on the run detail page (per-step output list) and
 * inside `RunArtifactsTree`.
 *
 * Optional `onClick` handler — when provided, the row becomes a focusable
 * button that opens the artifact in `ArtifactViewer` (T4.2). When omitted,
 * the row stays purely informational (legacy behaviour matches the original
 * inline implementation in `GovernedWorkflowRunDetail.tsx`).
 *
 * `selected` mirrors the visual highlight when the row corresponds to the
 * permalink target (`?step=<stepName>&output=<outputName>` query params).
 */
import { useState } from "react";
import { ExternalLink, FileText, Folder, Link as LinkIcon, Check } from "lucide-react";
import { safeExternalHref } from "../../lib/safeHref";
import { cn } from "../../lib/utils";
import type { OutputPersisted } from "@mnm/shared";

interface OutputRowProps {
  output: OutputPersisted;
  onClick?: (output: OutputPersisted) => void;
  selected?: boolean;
  /**
   * When provided, renders a "Copy permalink" icon button that copies a
   * stable URL pointing to this artifact (`?step=&output=` query-param
   * variant — works inside the run detail page even before T5 ships its
   * `/artifacts/<step>/<output>` route segment).
   */
  permalink?: string;
}

export function OutputRow({ output, onClick, selected, permalink }: OutputRowProps) {
  const interactive = !!onClick;
  const [copied, setCopied] = useState(false);

  const handleCopyPermalink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!permalink) return;
    const absolute = new URL(permalink, window.location.origin).toString();
    void navigator.clipboard.writeText(absolute).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const permalinkBtn = permalink ? (
    <button
      type="button"
      onClick={handleCopyPermalink}
      title="Copier permalink"
      aria-label="Copier permalink"
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
    </button>
  ) : null;

  const baseClasses = cn(
    "w-full text-left text-sm",
    interactive &&
      "rounded-md px-2 py-1 -mx-2 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring transition-colors cursor-pointer",
    selected && "bg-primary/10 ring-1 ring-primary/40",
  );

  const handleClick = onClick
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        onClick(output);
      }
    : undefined;

  if (output.kind === "external_url") {
    return (
      <div className={baseClasses} onClick={handleClick} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}>
        <div className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{output.name}</span>
          {/* When non-interactive, keep the legacy direct anchor so users can
              still open the URL. When interactive, the parent dispatches via
              ArtifactViewer which itself renders an external_url card. */}
          {interactive ? (
            <span className="text-muted-foreground truncate text-xs">{output.url}</span>
          ) : (
            <a
              href={safeExternalHref(output.url)}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline truncate"
            >
              {output.url}
            </a>
          )}
          {permalinkBtn}
        </div>
      </div>
    );
  }

  if (output.kind === "git_file") {
    return (
      <div className={baseClasses} onClick={handleClick} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{output.name}</span>
          <span className="font-mono text-xs text-muted-foreground truncate">{output.path}</span>
          <span className="text-xs text-muted-foreground ml-auto">{output.bytes} bytes</span>
          {permalinkBtn}
        </div>
      </div>
    );
  }

  // git_folder
  return (
    <div className={baseClasses} onClick={handleClick} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}>
      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium">{output.name}</span>
        <span className="font-mono text-xs text-muted-foreground truncate">{output.path}</span>
        <span className="text-xs text-muted-foreground ml-auto">{output.files.length} files</span>
        {permalinkBtn}
      </div>
      {!interactive && (
        <ul className="mt-1 ml-6 list-disc text-xs text-muted-foreground space-y-0.5">
          {output.files.map((f) => (
            <li key={f} className="font-mono">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Build a stable permalink for a (run, step, output) triple.
 *
 * Format: `/workflows/<name>/runs/<runId>/artifacts/<stepName>/<outputName>`.
 * `stepName` and `outputName` are URI-encoded — `stepName` may contain `/`
 * (e.g. composite sub-step path) so encoding is non-optional.
 */
export function artifactPermalink(args: {
  workflowName: string;
  runId: string;
  stepName: string;
  outputName: string;
}): string {
  const { workflowName, runId, stepName, outputName } = args;
  return `/workflows/${encodeURIComponent(workflowName)}/runs/${runId}/artifacts/${encodeURIComponent(
    stepName,
  )}/${encodeURIComponent(outputName)}`;
}
