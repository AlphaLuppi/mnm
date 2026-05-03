/**
 * ARTIFACT-VIEWER T4.1 — `RunArtifactsTree`.
 *
 * Hierarchical view of a run's artifacts: each step is a top-level node,
 * its outputs are leaves underneath. Designed to recurse on composite
 * sub-runs once the meta-workflow `uses:` feature (T5) ships — for now
 * it gracefully degrades to a flat list when no `composite_run_id` /
 * `parent_step_execution_id` is present on step rows.
 *
 * The recursion API is intentionally narrow: pass a `loadSubRun` callback
 * that returns the children for a given step (typically a React Query
 * fetch) — when omitted the tree never recurses.
 *
 * Selection state is driven by the parent so the same tree can drive a
 * permalink-aware viewer (`?step=&output=`).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { OutputRow } from "./OutputRow";
import type { OutputPersisted } from "@mnm/shared";
import type { StepWithGates } from "../../api/governed-workflows";

interface SelectedArtifact {
  stepName: string;
  outputName: string;
}

interface RunArtifactsTreeProps {
  steps: StepWithGates[];
  selected?: SelectedArtifact | null;
  onSelect?: (stepName: string, output: OutputPersisted) => void;
  /**
   * Optional async loader for composite sub-run children. Returns the
   * sub-run's `StepWithGates[]` once expanded. When undefined, expansion
   * is a no-op (V0 behaviour pre-T5).
   */
  loadSubRun?: (parentStep: StepWithGates) => Promise<StepWithGates[]>;
  /** Internal — recursion depth guard for pathological data. */
  depth?: number;
}

const MAX_DEPTH = 8;

function StateIcon({ state }: { state: string }) {
  if (state === "succeeded") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (state === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (state === "cancelled") return <Ban className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getOutputs(step: StepWithGates): OutputPersisted[] {
  if (!step.artifactsJson || typeof step.artifactsJson !== "object") return [];
  const outputs = (step.artifactsJson as { outputs?: unknown }).outputs;
  return Array.isArray(outputs) ? (outputs as OutputPersisted[]) : [];
}

/**
 * Heuristic detection of a composite step. Once the T5 schema lands the
 * step row will carry `composite_run_id` (and optionally a `type`
 * discriminator). Until then we look for either field and fall back to
 * "no children" — the tree degrades to a flat list.
 */
function isComposite(step: StepWithGates): boolean {
  const anyStep = step as unknown as { compositeRunId?: string | null; type?: string };
  return !!anyStep.compositeRunId || anyStep.type === "composite";
}

function StepNode({
  step,
  selected,
  onSelect,
  loadSubRun,
  depth = 0,
}: {
  step: StepWithGates;
  selected?: SelectedArtifact | null;
  onSelect?: (stepName: string, output: OutputPersisted) => void;
  loadSubRun?: (parentStep: StepWithGates) => Promise<StepWithGates[]>;
  depth?: number;
}) {
  const outputs = getOutputs(step);
  const hasChildren = isComposite(step) && !!loadSubRun && depth < MAX_DEPTH;
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<StepWithGates[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleToggle = () => {
    if (!hasChildren) return;
    const next = !expanded;
    setExpanded(next);
    if (next && !children && !loading && loadSubRun) {
      setLoading(true);
      setLoadError(null);
      loadSubRun(step)
        .then((rows) => setChildren(rows))
        .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false));
    }
  };

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-1.5">
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/60"
            onClick={handleToggle}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" aria-hidden />
        )}
        <StateIcon state={step.state} />
        <span className="text-xs font-medium truncate">{step.stepIdInJson}</span>
        {outputs.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-1">({outputs.length})</span>
        )}
      </div>

      {outputs.length > 0 && (
        <ul className="ml-6 space-y-0.5">
          {outputs.map((o) => {
            const isSelected =
              selected?.stepName === step.stepIdInJson && selected?.outputName === o.name;
            return (
              <li key={o.name}>
                <OutputRow
                  output={o}
                  selected={isSelected}
                  onClick={onSelect ? () => onSelect(step.stepIdInJson, o) : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}

      {hasChildren && expanded && (
        <div className="ml-6 border-l border-border pl-3 space-y-1">
          {loading && <p className="text-xs text-muted-foreground">Loading sub-run…</p>}
          {loadError && (
            <p className="text-xs text-destructive">Failed to load sub-run: {loadError}</p>
          )}
          {children && children.length === 0 && (
            <p className="text-xs text-muted-foreground">No nested steps.</p>
          )}
          {children && children.length > 0 && (
            <RunArtifactsTree
              steps={children}
              selected={selected}
              onSelect={onSelect}
              loadSubRun={loadSubRun}
              depth={depth + 1}
            />
          )}
        </div>
      )}
    </li>
  );
}

export function RunArtifactsTree({
  steps,
  selected,
  onSelect,
  loadSubRun,
  depth = 0,
}: RunArtifactsTreeProps) {
  if (steps.length === 0) {
    return <p className="text-xs text-muted-foreground">No steps recorded.</p>;
  }

  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <StepNode
          key={step.id}
          step={step}
          selected={selected}
          onSelect={onSelect}
          loadSubRun={loadSubRun}
          depth={depth}
        />
      ))}
    </ul>
  );
}
