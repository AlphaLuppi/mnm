/**
 * OBS-05: TraceDetailPanel — Right panel placeholder
 *
 * Shows selected node detail: gold annotation, observation IO, metadata.
 * Placeholder for now — will be fully built in OBS-06.
 */

import { useMemo } from "react";
import {
  BookOpen, Code, Terminal, MessageSquare, Play, Trophy, HelpCircle,
  Eye, Sparkles, Clock, DollarSign,
  CheckCircle, XCircle, AlertTriangle, MinusCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "../../lib/utils";
import { useTraceData, type TreeNode } from "../../context/TraceDataContext";
import { useTraceSelection } from "../../context/TraceSelectionContext";
import type { TracePhaseType, GoldVerdict } from "../../api/traces";

// ─── Phase type config (matches TraceTreeView) ──────────────────────────────

const PHASE_LABELS: Record<TracePhaseType, { label: string; color: string; icon: React.ElementType }> = {
  COMPREHENSION: { label: "Comprehension", color: "text-blue-400", icon: BookOpen },
  IMPLEMENTATION: { label: "Implementation", color: "text-emerald-400", icon: Code },
  VERIFICATION: { label: "Verification", color: "text-amber-400", icon: Terminal },
  COMMUNICATION: { label: "Communication", color: "text-purple-400", icon: MessageSquare },
  INITIALIZATION: { label: "Initialization", color: "text-slate-400", icon: Play },
  RESULT: { label: "Result", color: "text-cyan-400", icon: Trophy },
  UNKNOWN: { label: "Unknown", color: "text-muted-foreground", icon: HelpCircle },
};

const VERDICT_LABELS: Record<GoldVerdict, { label: string; color: string; icon: React.ElementType }> = {
  success: { label: "Success", color: "text-emerald-400", icon: CheckCircle },
  partial: { label: "Partial", color: "text-amber-400", icon: AlertTriangle },
  failure: { label: "Failure", color: "text-red-400", icon: XCircle },
  neutral: { label: "Neutral", color: "text-muted-foreground", icon: MinusCircle },
};

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m${sec}s` : `${min}m`;
}

function truncateJson(value: unknown, maxLen = 800): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n...[truncated]";
}

// ─── Phase detail ────────────────────────────────────────────────────────────

function PhaseDetail({ node }: { node: TreeNode }) {
  const phaseType = (node.phaseType ?? "UNKNOWN") as TracePhaseType;
  const config = PHASE_LABELS[phaseType] ?? PHASE_LABELS.UNKNOWN;
  const Icon = config.icon;
  const goldPhase = node.goldPhase;
  const silverPhase = node.phase;

  return (
    <div className="space-y-4 p-4">
      {/* Phase header */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", config.color)} />
        <h3 className={cn("text-sm font-semibold", config.color)}>{config.label}</h3>
        <span className="text-xs text-muted-foreground">
          {node.observationCount} observations
        </span>
      </div>

      {/* Metrics row */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDurationMs(node.totalDurationMs)}
        </span>
        {node.totalCost > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${node.totalCost.toFixed(4)}
          </span>
        )}
      </div>

      {/* Gold annotation */}
      {goldPhase && (
        <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
              Gold Analysis
            </span>
            <div className="flex-1" />
            {/* Verdict */}
            {(() => {
              const vCfg = VERDICT_LABELS[goldPhase.verdict] ?? VERDICT_LABELS.neutral;
              const VIcon = vCfg.icon;
              return (
                <Badge variant="outline" className={cn("text-[10px] gap-1", vCfg.color)}>
                  <VIcon className="h-3 w-3" />
                  {vCfg.label}
                </Badge>
              );
            })()}
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {goldPhase.annotation}
          </p>
          {/* Relevance */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Relevance:</span>
            <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(100, goldPhase.relevanceScore)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {goldPhase.relevanceScore}/100
            </span>
          </div>
          {/* Key observations */}
          {goldPhase.keyObservationIds.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Key observations: {goldPhase.keyObservationIds.length}
            </div>
          )}
        </div>
      )}

      {/* Silver summary */}
      {silverPhase && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Silver Summary
            </span>
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed pl-4">
            {silverPhase.summary}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Observation detail ──────────────────────────────────────────────────────

function ObservationDetail({ node }: { node: TreeNode }) {
  const obs = node.observation;
  if (!obs) return null;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold font-mono">{obs.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{obs.type}</Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              obs.status === "completed" ? "text-success" : obs.status === "failed" || obs.status === "error" ? "text-error" : "",
            )}
          >
            {obs.status}
          </Badge>
          {obs.model && (
            <span className="text-[10px]">{obs.model}</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {obs.durationMs != null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDurationMs(obs.durationMs)}
          </span>
        )}
        {obs.totalTokens != null && obs.totalTokens > 0 && (
          <span>{obs.totalTokens.toLocaleString()} tokens</span>
        )}
        {obs.costUsd != null && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${obs.costUsd}
          </span>
        )}
      </div>

      {/* Input */}
      {obs.input != null && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Input
          </span>
          <pre className="text-[11px] bg-muted/30 rounded-md border border-border/50 p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono text-foreground/70">
            {truncateJson(obs.input)}
          </pre>
        </div>
      )}

      {/* Output */}
      {obs.output != null && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Output
          </span>
          <pre className="text-[11px] bg-muted/30 rounded-md border border-border/50 p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono text-foreground/70">
            {truncateJson(obs.output)}
          </pre>
        </div>
      )}

      {/* Metadata */}
      {obs.metadata != null && Object.keys(obs.metadata).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Metadata
          </span>
          <pre className="text-[11px] bg-muted/30 rounded-md border border-border/50 p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono text-foreground/70">
            {truncateJson(obs.metadata)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function TraceDetailPanel() {
  const { nodeMap } = useTraceData();
  const { selectedNodeId } = useTraceSelection();

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodeMap.get(selectedNodeId) ?? null;
  }, [selectedNodeId, nodeMap]);

  if (!selectedNode) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2"
        data-testid="detail-panel-empty"
      >
        <Eye className="h-8 w-8 text-muted-foreground/30" />
        <span>Select a node to view details</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" data-testid="detail-panel">
      {selectedNode.type === "phase" ? (
        <PhaseDetail node={selectedNode} />
      ) : (
        <ObservationDetail node={selectedNode} />
      )}
    </div>
  );
}
