/**
 * OBS-05: TraceTreeView — Virtualized indented tree with phase grouping
 *
 * Langfuse-style tree view for the LEFT panel of the split layout.
 * Shows trace observations grouped by silver phases, with gold annotations.
 * Uses @tanstack/react-virtual for 200+ node performance.
 *
 * Structure:
 *   Phase group headers (collapsible)
 *     -> Observation nodes (indented, with connector lines)
 *       -> Gold annotations (relevance bar, verdict badge)
 */

import { useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BookOpen,
  Code,
  Search,
  MessageSquare,
  Play,
  Trophy,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Wrench,
  Brain,
  Circle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Clock,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "../../lib/utils";
import { useTraceData, type TreeNode } from "../../context/TraceDataContext";
import { useTraceSelection } from "../../context/TraceSelectionContext";
import type { TracePhaseType, GoldVerdict, ObservationType } from "../../api/traces";

// ─── Phase type configuration ────────────────────────────────────────────────

interface PhaseConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  barColor: string;
  icon: React.ElementType;
}

const PHASE_CONFIG: Record<TracePhaseType, PhaseConfig> = {
  COMPREHENSION: {
    label: "Comprehension",
    color: "text-blue-400",
    bgColor: "bg-blue-500/8",
    borderColor: "border-l-blue-500",
    barColor: "bg-blue-500",
    icon: BookOpen,
  },
  IMPLEMENTATION: {
    label: "Implementation",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/8",
    borderColor: "border-l-emerald-500",
    barColor: "bg-emerald-500",
    icon: Code,
  },
  VERIFICATION: {
    label: "Verification",
    color: "text-amber-400",
    bgColor: "bg-amber-500/8",
    borderColor: "border-l-amber-500",
    barColor: "bg-amber-500",
    icon: Terminal,
  },
  COMMUNICATION: {
    label: "Communication",
    color: "text-purple-400",
    bgColor: "bg-purple-500/8",
    borderColor: "border-l-purple-500",
    barColor: "bg-purple-400",
    icon: MessageSquare,
  },
  INITIALIZATION: {
    label: "Initialization",
    color: "text-slate-400",
    bgColor: "bg-slate-500/8",
    borderColor: "border-l-slate-500",
    barColor: "bg-slate-500",
    icon: Play,
  },
  RESULT: {
    label: "Result",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/8",
    borderColor: "border-l-cyan-500",
    barColor: "bg-cyan-500",
    icon: Trophy,
  },
  UNKNOWN: {
    label: "Unknown",
    color: "text-muted-foreground",
    bgColor: "bg-muted/20",
    borderColor: "border-l-muted-foreground",
    barColor: "bg-muted-foreground",
    icon: HelpCircle,
  },
};

const VERDICT_CONFIG: Record<GoldVerdict, { label: string; color: string; icon: React.ElementType }> = {
  success: { label: "Success", color: "text-emerald-400", icon: CheckCircle },
  partial: { label: "Partial", color: "text-amber-400", icon: AlertTriangle },
  failure: { label: "Failure", color: "text-red-400", icon: XCircle },
  neutral: { label: "Neutral", color: "text-muted-foreground", icon: MinusCircle },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function obsTypeIcon(type: ObservationType) {
  switch (type) {
    case "span":
      return <Wrench className="h-3.5 w-3.5 text-info shrink-0" />;
    case "generation":
      return <Brain className="h-3.5 w-3.5 text-agent shrink-0" />;
    case "event":
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function obsStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-3 w-3 text-success shrink-0" />;
    case "failed":
    case "error":
      return <XCircle className="h-3 w-3 text-error shrink-0" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground shrink-0" />;
  }
}

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m${sec}s` : `${min}m`;
}

function getObsInputSummary(node: TreeNode): string {
  const obs = node.observation;
  if (!obs) return "";
  const input = obs.input;
  if (input == null) return "";

  // Extract meaningful short info from input
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    // Tool inputs: file_path, pattern, command
    if (typeof obj.file_path === "string") return obj.file_path.split("/").slice(-2).join("/");
    if (typeof obj.pattern === "string") return `"${String(obj.pattern).slice(0, 30)}"`;
    if (typeof obj.command === "string") return `"${String(obj.command).slice(0, 30)}"`;
  }
  if (typeof input === "string") return input.slice(0, 40);
  return "";
}

function getObsOutputSummary(node: TreeNode): string {
  const obs = node.observation;
  if (!obs) return "";
  const output = obs.output;
  if (output == null) return "";

  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;
    // Common output shapes
    if (typeof obj.text === "string") return obj.text.slice(0, 40);
    if (typeof obj.output === "string") return obj.output.slice(0, 40);
    if (obj.exitCode !== undefined) return `exit ${obj.exitCode}`;
    if (typeof obj.lines === "number") return `${obj.lines} lines`;
    if (typeof obj.matches === "number") return `${obj.matches} matches`;
  }
  if (typeof output === "string") return output.slice(0, 40);
  return "";
}

// ─── Relevance bar ───────────────────────────────────────────────────────────

function RelevanceBar({ score, barColor }: { score: number; barColor: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="h-1.5 w-10 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-5 text-right">{score}</span>
    </div>
  );
}

// ─── Verdict badge ───────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: GoldVerdict }) {
  const cfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.neutral;
  const Icon = cfg.icon;
  return (
    <span className={cn("flex items-center gap-0.5 shrink-0", cfg.color)}>
      <Icon className="h-3 w-3" />
    </span>
  );
}

// ─── Phase header row ────────────────────────────────────────────────────────

interface PhaseRowProps {
  node: TreeNode;
  isSelected: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

function PhaseRow({ node, isSelected, isCollapsed, onSelect, onToggle }: PhaseRowProps) {
  const phaseType = (node.phaseType ?? "UNKNOWN") as TracePhaseType;
  const config = PHASE_CONFIG[phaseType] ?? PHASE_CONFIG.UNKNOWN;
  const Icon = config.icon;
  const goldPhase = node.goldPhase;

  const handleClick = useCallback(() => {
    onSelect();
  }, [onSelect]);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle();
    },
    [onToggle],
  );

  return (
    <div
      data-testid={`tree-phase-${node.id}`}
      className={cn(
        "flex items-center gap-1.5 px-2 h-[42px] cursor-pointer transition-colors duration-100",
        "border-l-2",
        config.borderColor,
        config.bgColor,
        "hover:bg-accent/20",
        isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
      )}
      onClick={handleClick}
      role="treeitem"
      aria-expanded={!isCollapsed}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
        if (e.key === "ArrowRight" && isCollapsed) {
          e.preventDefault();
          onToggle();
        }
        if (e.key === "ArrowLeft" && !isCollapsed) {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Expand/collapse chevron */}
      <button
        className="w-4 h-4 flex items-center justify-center shrink-0"
        onClick={handleChevronClick}
        tabIndex={-1}
        aria-label={isCollapsed ? "Expand" : "Collapse"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Phase icon */}
      <Icon className={cn("h-4 w-4 shrink-0", config.color)} />

      {/* Phase label */}
      <span className={cn("text-xs font-semibold truncate", config.color)}>
        {config.label}
      </span>

      {/* Observation count + duration */}
      <span className="text-[10px] text-muted-foreground shrink-0 ml-0.5">
        ({node.observationCount} obs
        {node.totalDurationMs > 0 && `, ${formatDurationMs(node.totalDurationMs)}`})
      </span>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Gold annotations */}
      {goldPhase && (
        <>
          <RelevanceBar score={goldPhase.relevanceScore} barColor={config.barColor} />
          <VerdictBadge verdict={goldPhase.verdict} />
        </>
      )}
    </div>
  );
}

// ─── Observation row ─────────────────────────────────────────────────────────

interface ObservationRowProps {
  node: TreeNode;
  isSelected: boolean;
  isHighlight: boolean;
  isLastChild: boolean;
  siblingIndex: number;
  siblingCount: number;
  onSelect: () => void;
}

function ObservationRow({
  node,
  isSelected,
  isHighlight,
  isLastChild,
  onSelect,
}: ObservationRowProps) {
  const obs = node.observation;
  if (!obs) return null;

  const inputSummary = getObsInputSummary(node);
  const outputSummary = getObsOutputSummary(node);
  const isError = obs.status === "failed" || obs.status === "error";
  const indent = node.depth * 16;

  return (
    <div
      data-testid={`tree-obs-${node.id}`}
      className={cn(
        "flex items-center gap-1.5 h-[36px] cursor-pointer transition-colors duration-100",
        "hover:bg-accent/15",
        isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
        isHighlight && "bg-amber-500/5",
        isError && "text-red-400",
      )}
      style={{ paddingLeft: `${8 + indent}px`, paddingRight: 8 }}
      onClick={onSelect}
      role="treeitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Tree connector */}
      <span className="w-4 text-border shrink-0 flex items-center justify-center text-xs select-none">
        {isLastChild ? "\u2514" : "\u251C"}
      </span>

      {/* Type icon */}
      {obsTypeIcon(obs.type)}

      {/* Status icon */}
      {obsStatusIcon(obs.status)}

      {/* Observation name */}
      <span
        className={cn(
          "text-[11px] font-mono font-medium truncate",
          isError ? "text-red-400" : "text-foreground/80",
        )}
      >
        {obs.name}
      </span>

      {/* Input summary */}
      {inputSummary && (
        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[140px]">
          {inputSummary}
        </span>
      )}

      {/* Output summary (only if no input) */}
      {!inputSummary && outputSummary && (
        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[140px]">
          {"\u2192"} {outputSummary}
        </span>
      )}

      {/* Highlight sparkle */}
      {isHighlight && <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Duration */}
      {obs.durationMs != null && obs.durationMs > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {formatDurationMs(obs.durationMs)}
        </span>
      )}
    </div>
  );
}

// ─── Visible list computation ────────────────────────────────────────────────

interface FlatRow {
  node: TreeNode;
  isLastChild: boolean;
  siblingIndex: number;
  siblingCount: number;
}

function computeVisibleRows(roots: TreeNode[], collapsedNodes: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  const stack: Array<{ node: TreeNode; isLastChild: boolean; siblingIndex: number; siblingCount: number }> = [];

  // Push roots in reverse order
  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push({
      node: roots[i],
      isLastChild: i === roots.length - 1,
      siblingIndex: i,
      siblingCount: roots.length,
    });
  }

  while (stack.length > 0) {
    const item = stack.pop()!;
    rows.push(item);

    // Only push children if the node is NOT collapsed and has children
    if (!collapsedNodes.has(item.node.id) && item.node.children.length > 0) {
      const children = item.node.children;
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({
          node: children[i],
          isLastChild: i === children.length - 1,
          siblingIndex: i,
          siblingCount: children.length,
        });
      }
    }
  }

  return rows;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TraceTreeView() {
  const { roots, trace } = useTraceData();
  const {
    selectedNodeId,
    setSelectedNodeId,
    collapsedNodes,
    toggleCollapsed,
    expandAll,
    collapseAll,
  } = useTraceSelection();

  const parentRef = useRef<HTMLDivElement>(null);

  // Build the set of highlighted observation IDs from gold
  const highlightSet = useMemo(() => {
    return new Set(trace?.gold?.highlights ?? []);
  }, [trace]);

  // Compute visible rows respecting collapsed state
  const visibleRows = useMemo(
    () => computeVisibleRows(roots, collapsedNodes),
    [roots, collapsedNodes],
  );

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = visibleRows[index];
      return row.node.type === "phase" ? 42 : 36;
    },
    overscan: 10,
  });

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedNodeId(id === selectedNodeId ? null : id);
    },
    [selectedNodeId, setSelectedNodeId],
  );

  if (roots.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm text-muted-foreground"
        data-testid="tree-view-empty"
      >
        No observations to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="trace-tree-view">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Trace Tree
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({visibleRows.length}/{roots.reduce((acc, r) => acc + r.observationCount + (r.type === "phase" ? 1 : 0), 0)})
        </span>
        <div className="flex-1" />
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
          onClick={expandAll}
          data-testid="tree-expand-all"
        >
          Expand all
        </button>
        <span className="text-border">|</span>
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
          onClick={collapseAll}
          data-testid="tree-collapse-all"
        >
          Collapse all
        </button>
      </div>

      {/* Virtualized tree */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        role="tree"
        data-testid="tree-view-scroll"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = visibleRows[virtualRow.index];
            const { node, isLastChild, siblingIndex, siblingCount } = row;
            const isSelected = selectedNodeId === node.id;

            if (node.type === "phase") {
              return (
                <div
                  key={node.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <PhaseRow
                    node={node}
                    isSelected={isSelected}
                    isCollapsed={collapsedNodes.has(node.id)}
                    onSelect={() => handleSelect(node.id)}
                    onToggle={() => toggleCollapsed(node.id)}
                  />
                </div>
              );
            }

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ObservationRow
                  node={node}
                  isSelected={isSelected}
                  isHighlight={highlightSet.has(node.id)}
                  isLastChild={isLastChild}
                  siblingIndex={siblingIndex}
                  siblingCount={siblingCount}
                  onSelect={() => handleSelect(node.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
