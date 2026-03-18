/**
 * OBS-07/08: TraceDetailPanel — Tabbed right panel for trace detail
 *
 * Shows selected node detail with tabs:
 *   - Phase node: Gold Analysis (default), Scores, Metadata
 *   - Observation node: Input/Output (default), Scores, Metadata
 *
 * OBS-07: I/O tab with Formatted/JSON/Raw toggle + tool-specific rendering
 * OBS-08: Gold tab with verdict, annotation, relevance, AC status, key obs
 */

import { useState, useMemo, useCallback } from "react";
import {
  BookOpen, Code, Terminal, MessageSquare, Play, Trophy, HelpCircle,
  Eye, Sparkles, Clock, DollarSign, Copy, Check,
  CheckCircle, XCircle, AlertTriangle, MinusCircle,
  FileText, Hash, Cpu, ChevronDown, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";
import { useTraceData, type TreeNode } from "../../context/TraceDataContext";
import { useTraceSelection } from "../../context/TraceSelectionContext";
import type { TracePhaseType, GoldVerdict, TraceGoldPhase, TraceObservation } from "../../api/traces";

// ─── Phase type config ────────────────────────────────────────────────────────

const PHASE_LABELS: Record<TracePhaseType, { label: string; color: string; icon: React.ElementType }> = {
  COMPREHENSION: { label: "Comprehension", color: "text-blue-400", icon: BookOpen },
  IMPLEMENTATION: { label: "Implementation", color: "text-emerald-400", icon: Code },
  VERIFICATION: { label: "Verification", color: "text-amber-400", icon: Terminal },
  COMMUNICATION: { label: "Communication", color: "text-purple-400", icon: MessageSquare },
  INITIALIZATION: { label: "Initialization", color: "text-slate-400", icon: Play },
  RESULT: { label: "Result", color: "text-cyan-400", icon: Trophy },
  UNKNOWN: { label: "Unknown", color: "text-muted-foreground", icon: HelpCircle },
};

const VERDICT_LABELS: Record<GoldVerdict, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  success: { label: "Success", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  partial: { label: "Partial", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle },
  failure: { label: "Failure", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", icon: XCircle },
  neutral: { label: "Neutral", color: "text-muted-foreground", bgColor: "bg-muted/20 border-border", icon: MinusCircle },
};

const PHASE_BAR_COLORS: Record<string, string> = {
  COMPREHENSION: "bg-blue-500",
  IMPLEMENTATION: "bg-emerald-500",
  VERIFICATION: "bg-amber-500",
  COMMUNICATION: "bg-purple-400",
  INITIALIZATION: "bg-slate-500",
  RESULT: "bg-cyan-500",
  UNKNOWN: "bg-neutral-500",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m${sec}s` : `${min}m`;
}

function parseCost(cost: number | string | null | undefined): number {
  if (cost == null) return 0;
  if (typeof cost === "number") return cost;
  const parsed = parseFloat(cost);
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  );
}

// ─── JSON Tree Viewer ─────────────────────────────────────────────────────────

function JsonTreeNode({ label, value, depth = 0 }: { label?: string; value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
        {label && <span className="text-blue-400">{label}:</span>}
        <span className="text-muted-foreground italic">null</span>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
        {label && <span className="text-blue-400">{label}:</span>}
        <span className="text-amber-400">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
        {label && <span className="text-blue-400">{label}:</span>}
        <span className="text-emerald-400">{value}</span>
      </div>
    );
  }

  if (typeof value === "string") {
    const truncated = value.length > 200 ? value.slice(0, 200) + "..." : value;
    return (
      <div className="flex items-start gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
        {label && <span className="text-blue-400 shrink-0">{label}:</span>}
        <span className="text-foreground/70 break-all">"{truncated}"</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
          {label && <span className="text-blue-400">{label}:</span>}
          <span className="text-muted-foreground">[]</span>
        </div>
      );
    }
    return (
      <div style={{ paddingLeft: `${depth * 12}px` }}>
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-white/5 rounded px-0.5"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {label && <span className="text-blue-400">{label}:</span>}
          <span className="text-muted-foreground">[{value.length}]</span>
        </div>
        {expanded && value.map((item, i) => (
          <JsonTreeNode key={i} label={String(i)} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12}px` }}>
          {label && <span className="text-blue-400">{label}:</span>}
          <span className="text-muted-foreground">{"{}"}</span>
        </div>
      );
    }
    return (
      <div style={{ paddingLeft: `${depth * 12}px` }}>
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-white/5 rounded px-0.5"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {label && <span className="text-blue-400">{label}:</span>}
          <span className="text-muted-foreground">{`{${entries.length}}`}</span>
        </div>
        {expanded && entries.map(([k, v]) => (
          <JsonTreeNode key={k} label={k} value={v} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: `${depth * 12}px` }}>
      {label && <span className="text-blue-400">{label}:</span>}
      <span className="text-foreground/70">{String(value)}</span>
    </div>
  );
}

// ─── OBS-07: Formatted IO Renderers ──────────────────────────────────────────

function FormattedToolRead({ input, output }: { input: unknown; output: unknown }) {
  const inp = input as Record<string, unknown> | null;
  const out = output as Record<string, unknown> | null;
  const filePath = typeof inp?.file_path === "string" ? inp.file_path : null;
  const lineCount = typeof out?.lines === "number" ? out.lines : null;

  return (
    <div className="space-y-2">
      {filePath && (
        <div className="flex items-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2">
          <FileText className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-mono text-blue-300 break-all">{filePath}</span>
        </div>
      )}
      {lineCount != null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Hash className="h-3 w-3" />
          <span>{lineCount} lines read</span>
        </div>
      )}
      {inp?.offset != null && (
        <div className="text-xs text-muted-foreground">
          Offset: {String(inp.offset)}, Limit: {String(inp?.limit ?? "default")}
        </div>
      )}
    </div>
  );
}

function FormattedToolEdit({ input, output }: { input: unknown; output: unknown }) {
  const inp = input as Record<string, unknown> | null;
  const filePath = typeof inp?.file_path === "string" ? inp.file_path : null;
  const oldString = typeof inp?.old_string === "string" ? inp.old_string : null;
  const newString = typeof inp?.new_string === "string" ? inp.new_string : null;

  return (
    <div className="space-y-2">
      {filePath && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <Code className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-mono text-emerald-300 break-all">{filePath}</span>
        </div>
      )}
      {oldString != null && newString != null && (
        <div className="rounded-md border border-border/50 overflow-hidden text-[11px] font-mono">
          <div className="bg-red-500/10 px-3 py-1.5 border-b border-border/30">
            <span className="text-red-400 select-none mr-1">-</span>
            <span className="text-red-300/80 break-all whitespace-pre-wrap">{oldString}</span>
          </div>
          <div className="bg-emerald-500/10 px-3 py-1.5">
            <span className="text-emerald-400 select-none mr-1">+</span>
            <span className="text-emerald-300/80 break-all whitespace-pre-wrap">{newString}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FormattedToolBash({ input, output }: { input: unknown; output: unknown }) {
  const inp = input as Record<string, unknown> | null;
  const out = output as Record<string, unknown> | null;
  const command = typeof inp?.command === "string" ? inp.command : null;
  const cmdOutput = typeof out?.output === "string" ? out.output : null;
  const exitCode = out?.exitCode;

  return (
    <div className="space-y-2">
      {command && (
        <div className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Command</span>
          </div>
          <pre className="text-sm font-mono text-emerald-300 whitespace-pre-wrap break-all">{command}</pre>
        </div>
      )}
      {cmdOutput && (
        <div className="rounded-md bg-muted/20 border border-border/50 px-3 py-2">
          <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {cmdOutput}
          </pre>
        </div>
      )}
      {exitCode !== undefined && exitCode !== null && (
        <div className="flex items-center gap-2 text-xs">
          {exitCode === 0
            ? <Badge variant="outline" className="text-[10px] text-emerald-400 gap-1"><CheckCircle className="h-3 w-3" />exit 0</Badge>
            : <Badge variant="outline" className="text-[10px] text-red-400 gap-1"><XCircle className="h-3 w-3" />exit {String(exitCode)}</Badge>
          }
        </div>
      )}
    </div>
  );
}

function FormattedToolGrep({ input, output }: { input: unknown; output: unknown }) {
  const inp = input as Record<string, unknown> | null;
  const out = output as Record<string, unknown> | null;
  const pattern = typeof inp?.pattern === "string" ? inp.pattern : null;
  const matchCount = typeof out?.matches === "number" ? out.matches : null;
  const fileCount = typeof out?.files === "number" ? out.files : null;

  return (
    <div className="space-y-2">
      {pattern && (
        <div className="flex items-center gap-2 rounded-md bg-purple-500/10 border border-purple-500/20 px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pattern</span>
          <code className="text-sm font-mono text-purple-300">{pattern}</code>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount != null && <span>{matchCount} matches</span>}
        {fileCount != null && <span>{fileCount} files</span>}
      </div>
      {inp?.path != null && (
        <div className="text-xs text-muted-foreground">
          Path: <span className="font-mono">{String(inp.path)}</span>
        </div>
      )}
    </div>
  );
}

function FormattedGeneration({ output }: { output: unknown }) {
  const out = output as Record<string, unknown> | null;
  const text = typeof out?.text === "string" ? out.text : (typeof output === "string" ? output : null);

  if (!text) return null;

  return (
    <div className="rounded-md bg-muted/20 border border-border/50 px-3 py-2.5">
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

// ─── IO Display Mode toggle ─────────────────────────────────────────────────

type IoDisplayMode = "formatted" | "json" | "raw";

function IoModeToggle({ mode, onChange }: { mode: IoDisplayMode; onChange: (m: IoDisplayMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted/30 p-0.5">
      {(["formatted", "json", "raw"] as const).map((m) => (
        <button
          key={m}
          className={cn(
            "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
            mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(m)}
        >
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ─── OBS-07: IO Tab Content ──────────────────────────────────────────────────

function IoTabContent({ node }: { node: TreeNode }) {
  const obs = node.observation;
  const [ioMode, setIoMode] = useState<IoDisplayMode>("formatted");

  if (!obs) return <div className="p-4 text-sm text-muted-foreground">No observation data</div>;

  const jsonStr = useMemo(() => {
    const obj: Record<string, unknown> = {};
    if (obs.input != null) obj.input = obs.input;
    if (obs.output != null) obj.output = obs.output;
    return JSON.stringify(obj, null, 2);
  }, [obs]);

  // Detect tool type for formatted rendering
  const toolType = useMemo(() => {
    const name = obs.name.toLowerCase();
    if (name.includes("read") || name.includes("tool:read")) return "read";
    if (name.includes("edit") || name.includes("tool:edit")) return "edit";
    if (name.includes("bash") || name.includes("tool:bash")) return "bash";
    if (name.includes("grep") || name.includes("tool:grep")) return "grep";
    if (obs.type === "generation") return "generation";
    return "generic";
  }, [obs]);

  return (
    <div className="space-y-3 p-4">
      {/* Header with mode toggle + copy */}
      <div className="flex items-center justify-between">
        <IoModeToggle mode={ioMode} onChange={setIoMode} />
        <CopyButton text={jsonStr} />
      </div>

      {/* Formatted mode */}
      {ioMode === "formatted" && (
        <div className="space-y-4">
          {toolType === "read" && <FormattedToolRead input={obs.input} output={obs.output} />}
          {toolType === "edit" && <FormattedToolEdit input={obs.input} output={obs.output} />}
          {toolType === "bash" && <FormattedToolBash input={obs.input} output={obs.output} />}
          {toolType === "grep" && <FormattedToolGrep input={obs.input} output={obs.output} />}
          {toolType === "generation" && <FormattedGeneration output={obs.output} />}
          {toolType === "generic" && (
            <>
              {obs.input != null && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Input</span>
                  <pre className="text-[11px] bg-muted/30 rounded-md border border-border/50 p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono text-foreground/70">
                    {typeof obs.input === "string" ? obs.input : JSON.stringify(obs.input, null, 2)}
                  </pre>
                </div>
              )}
              {obs.output != null && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Output</span>
                  <pre className="text-[11px] bg-muted/30 rounded-md border border-border/50 p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono text-foreground/70">
                    {typeof obs.output === "string" ? obs.output : JSON.stringify(obs.output, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* JSON tree mode */}
      {ioMode === "json" && (
        <div className="rounded-md bg-muted/20 border border-border/50 p-3 text-[11px] font-mono overflow-auto max-h-[500px]">
          {obs.input != null && <JsonTreeNode label="input" value={obs.input} />}
          {obs.output != null && <JsonTreeNode label="output" value={obs.output} />}
          {obs.input == null && obs.output == null && (
            <span className="text-muted-foreground italic">No input/output data</span>
          )}
        </div>
      )}

      {/* Raw mode */}
      {ioMode === "raw" && (
        <pre className="text-[11px] bg-black/30 rounded-md border border-white/5 p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto font-mono text-foreground/60">
          {jsonStr}
        </pre>
      )}
    </div>
  );
}

// ─── OBS-08: Gold Tab Content ────────────────────────────────────────────────

function GoldTabContent({ node }: { node: TreeNode }) {
  const { setSelectedNodeId } = useTraceSelection();
  const goldPhase = node.goldPhase;
  const phaseType = (node.phaseType ?? "UNKNOWN") as TracePhaseType;
  const config = PHASE_LABELS[phaseType] ?? PHASE_LABELS.UNKNOWN;
  const barColor = PHASE_BAR_COLORS[phaseType] ?? PHASE_BAR_COLORS.UNKNOWN;

  if (!goldPhase) {
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground/40" />
        No gold analysis for this phase
      </div>
    );
  }

  const verdictCfg = VERDICT_LABELS[goldPhase.verdict] ?? VERDICT_LABELS.neutral;
  const VerdictIcon = verdictCfg.icon;

  return (
    <div className="space-y-4 p-4">
      {/* Verdict banner */}
      <div className={cn("rounded-lg border p-3 space-y-2", verdictCfg.bgColor)}>
        <div className="flex items-center gap-2">
          <VerdictIcon className={cn("h-5 w-5", verdictCfg.color)} />
          <span className={cn("text-sm font-semibold", verdictCfg.color)}>{verdictCfg.label}</span>
          <div className="flex-1" />
          <Badge variant="outline" className={cn("text-[10px] gap-1", config.color)}>
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Annotation */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Gold Annotation
        </span>
        <p className="text-sm text-foreground/80 leading-relaxed bg-amber-500/5 rounded-md border border-amber-500/10 px-3 py-2">
          {goldPhase.annotation}
        </p>
      </div>

      {/* Relevance score bar */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Relevance Score
        </span>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(100, goldPhase.relevanceScore)}%` }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums w-10 text-right">
            {goldPhase.relevanceScore}
          </span>
        </div>
      </div>

      {/* Key observations (clickable) */}
      {goldPhase.keyObservationIds.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Key Observations
          </span>
          <div className="space-y-1">
            {goldPhase.keyObservationIds.map((obsId) => (
              <button
                key={obsId}
                className="flex items-center gap-2 w-full text-left rounded-md px-2.5 py-1.5 text-xs hover:bg-accent/20 transition-colors border border-border/30 hover:border-border/50"
                onClick={() => setSelectedNodeId(obsId)}
              >
                <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                <span className="font-mono text-foreground/70 truncate">{obsId}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Issue AC status */}
      {node.phase && (
        <IssueAcSection phaseOrder={node.phase.order} />
      )}
    </div>
  );
}

function IssueAcSection({ phaseOrder }: { phaseOrder: number }) {
  const { trace } = useTraceData();
  const acList = trace?.gold?.issueAcStatus;

  if (!acList || acList.length === 0) return null;

  const statusConfig = {
    met: { label: "Met", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
    partial: { label: "Partial", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: AlertTriangle },
    not_met: { label: "Not Met", cls: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
    unknown: { label: "Unknown", cls: "text-muted-foreground bg-muted/30 border-border", icon: MinusCircle },
  } as const;

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Acceptance Criteria
      </span>
      <div className="grid gap-2">
        {acList.map((ac) => {
          const cfg = statusConfig[ac.status];
          const AcIcon = cfg.icon;
          return (
            <div
              key={ac.acId}
              className={cn("rounded-md border p-2.5 text-xs space-y-1", cfg.cls)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate flex items-center gap-1.5">
                  <AcIcon className="h-3 w-3 shrink-0" />
                  {ac.label}
                </span>
                <Badge variant="outline" className={cn("text-[10px]", cfg.cls)}>
                  {cfg.label}
                </Badge>
              </div>
              {ac.evidence && (
                <p className="text-[11px] text-foreground/60 leading-snug pl-4">{ac.evidence}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scores Tab Content ──────────────────────────────────────────────────────

function ScoresTabContent({ node }: { node: TreeNode }) {
  const obs = node.observation;

  // For phases: use aggregated metrics from node
  // For observations: use direct values
  const duration = node.type === "phase" ? node.totalDurationMs : (obs?.durationMs ?? 0);
  const cost = node.type === "phase" ? node.totalCost : parseCost(obs?.costUsd);
  const tokens = node.type === "observation" && obs
    ? (obs.totalTokens ?? 0)
    : 0;
  const inputTokens = node.type === "observation" && obs ? (obs.inputTokens ?? 0) : 0;
  const outputTokens = node.type === "observation" && obs ? (obs.outputTokens ?? 0) : 0;

  // For phases, compute aggregated token counts
  const phaseTokens = useMemo(() => {
    if (node.type !== "phase") return { input: 0, output: 0, total: 0 };
    let input = 0, output = 0, total = 0;
    for (const child of node.children) {
      const childObs = child.observation;
      if (childObs) {
        input += childObs.inputTokens ?? 0;
        output += childObs.outputTokens ?? 0;
        total += childObs.totalTokens ?? 0;
      }
    }
    return { input, output, total };
  }, [node]);

  const finalTokens = node.type === "phase" ? phaseTokens : { input: inputTokens, output: outputTokens, total: tokens };

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Duration */}
        <div className="rounded-md border border-border/50 bg-muted/10 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Duration
          </div>
          <div className="text-lg font-semibold tabular-nums">{formatDurationMs(duration)}</div>
          {node.type === "phase" && (
            <div className="text-[10px] text-muted-foreground">
              Aggregated from {node.observationCount} observations
            </div>
          )}
        </div>

        {/* Cost */}
        <div className="rounded-md border border-border/50 bg-muted/10 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            <DollarSign className="h-3 w-3" />
            Cost
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {cost > 0 ? `$${cost.toFixed(4)}` : "-"}
          </div>
        </div>

        {/* Total Tokens */}
        <div className="rounded-md border border-border/50 bg-muted/10 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            <Hash className="h-3 w-3" />
            Total Tokens
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {finalTokens.total > 0 ? finalTokens.total.toLocaleString() : "-"}
          </div>
        </div>

        {/* Token breakdown */}
        <div className="rounded-md border border-border/50 bg-muted/10 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
            <Hash className="h-3 w-3" />
            In / Out
          </div>
          <div className="text-sm tabular-nums">
            {finalTokens.input > 0 || finalTokens.output > 0 ? (
              <span>
                <span className="text-blue-400">{finalTokens.input.toLocaleString()}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-emerald-400">{finalTokens.output.toLocaleString()}</span>
              </span>
            ) : "-"}
          </div>
        </div>
      </div>

      {/* Model info for observations */}
      {obs?.model && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cpu className="h-3.5 w-3.5" />
          <span>Model: <span className="font-mono text-foreground/70">{obs.model}</span></span>
        </div>
      )}
    </div>
  );
}

// ─── Metadata Tab Content ────────────────────────────────────────────────────

function MetadataTabContent({ node }: { node: TreeNode }) {
  const obs = node.observation;

  return (
    <div className="space-y-3 p-4">
      {/* Timestamps */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Timestamps
        </span>
        <div className="grid gap-1.5 text-xs">
          {obs?.startedAt && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Started:</span>
              <span className="font-mono text-foreground/70">{obs.startedAt}</span>
            </div>
          )}
          {obs?.completedAt && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Completed:</span>
              <span className="font-mono text-foreground/70">{obs.completedAt}</span>
            </div>
          )}
          {obs?.durationMs != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Duration:</span>
              <span className="font-mono text-foreground/70">{formatDurationMs(obs.durationMs)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Model */}
      {obs?.model && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Model
          </span>
          <div className="flex items-center gap-2 text-xs">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-foreground/70">{obs.model}</span>
          </div>
        </div>
      )}

      {/* IDs */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Identifiers
        </span>
        <div className="grid gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">Node ID:</span>
            <span className="font-mono text-foreground/70 break-all">{node.id}</span>
          </div>
          {obs && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Trace ID:</span>
                <span className="font-mono text-foreground/70 break-all">{obs.traceId}</span>
              </div>
              {obs.parentObservationId && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-24">Parent Obs:</span>
                  <span className="font-mono text-foreground/70 break-all">{obs.parentObservationId}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Type:</span>
                <Badge variant="outline" className="text-[10px]">{obs.type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Status:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    obs.status === "completed" ? "text-success" : obs.status === "failed" || obs.status === "error" ? "text-error" : "",
                  )}
                >
                  {obs.status}
                </Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Raw metadata */}
      {obs?.metadata != null && Object.keys(obs.metadata).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Metadata
          </span>
          <div className="rounded-md bg-muted/20 border border-border/50 p-2 text-[11px] font-mono overflow-auto max-h-40">
            <JsonTreeNode value={obs.metadata} />
          </div>
        </div>
      )}

      {/* Model parameters */}
      {obs?.modelParameters != null && Object.keys(obs.modelParameters).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Model Parameters
          </span>
          <div className="rounded-md bg-muted/20 border border-border/50 p-2 text-[11px] font-mono overflow-auto max-h-40">
            <JsonTreeNode value={obs.modelParameters} />
          </div>
        </div>
      )}

      {/* Phase-level metadata */}
      {node.type === "phase" && node.phase && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Phase Info
          </span>
          <div className="grid gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Order:</span>
              <span className="font-mono text-foreground/70">{node.phase.order}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Type:</span>
              <span className="font-mono text-foreground/70">{node.phase.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Obs Range:</span>
              <span className="font-mono text-foreground/70">{node.phase.startIdx} - {node.phase.endIdx}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Summary:</span>
              <span className="text-foreground/70">{node.phase.summary}</span>
            </div>
          </div>
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

  // Default tab depends on type: phase -> gold, observation -> io
  const defaultTab = selectedNode.type === "phase" ? "gold" : "io";

  // Build available tabs based on node type
  const isPhase = selectedNode.type === "phase";
  const hasGold = isPhase && !!selectedNode.goldPhase;
  const hasIo = !isPhase && selectedNode.observation != null;

  return (
    <div className="h-full flex flex-col" data-testid="detail-panel">
      {/* Node header */}
      <div className="px-4 pt-3 pb-2 border-b border-border/50 shrink-0">
        {isPhase ? (
          <PhaseHeader node={selectedNode} />
        ) : (
          <ObservationHeader node={selectedNode} />
        )}
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue={defaultTab}
        key={selectedNode.id}
        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="shrink-0 mx-4 mt-2">
          {isPhase && (
            <TabsTrigger value="gold" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              Gold
            </TabsTrigger>
          )}
          {hasIo && (
            <TabsTrigger value="io" className="text-xs gap-1">
              <Eye className="h-3 w-3" />
              I/O
            </TabsTrigger>
          )}
          <TabsTrigger value="scores" className="text-xs gap-1">
            <Hash className="h-3 w-3" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="metadata" className="text-xs gap-1">
            <Cpu className="h-3 w-3" />
            Meta
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          {isPhase && (
            <TabsContent value="gold">
              <GoldTabContent node={selectedNode} />
            </TabsContent>
          )}
          {hasIo && (
            <TabsContent value="io">
              <IoTabContent node={selectedNode} />
            </TabsContent>
          )}
          <TabsContent value="scores">
            <ScoresTabContent node={selectedNode} />
          </TabsContent>
          <TabsContent value="metadata">
            <MetadataTabContent node={selectedNode} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Sub-component: Headers ──────────────────────────────────────────────────

function PhaseHeader({ node }: { node: TreeNode }) {
  const phaseType = (node.phaseType ?? "UNKNOWN") as TracePhaseType;
  const config = PHASE_LABELS[phaseType] ?? PHASE_LABELS.UNKNOWN;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-5 w-5", config.color)} />
      <h3 className={cn("text-sm font-semibold", config.color)}>{config.label}</h3>
      <span className="text-xs text-muted-foreground">
        {node.observationCount} observations
      </span>
      <div className="flex-1" />
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {formatDurationMs(node.totalDurationMs)}
      </span>
      {node.totalCost > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          ${node.totalCost.toFixed(4)}
        </span>
      )}
    </div>
  );
}

function ObservationHeader({ node }: { node: TreeNode }) {
  const obs = node.observation;
  if (!obs) return null;

  return (
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
        {obs.model && <span className="text-[10px]">{obs.model}</span>}
        <div className="flex-1" />
        {obs.durationMs != null && (
          <span className="text-[10px] tabular-nums">{formatDurationMs(obs.durationMs)}</span>
        )}
        {obs.costUsd != null && (
          <span className="text-[10px] tabular-nums">${parseCost(obs.costUsd).toFixed(4)}</span>
        )}
      </div>
    </div>
  );
}
