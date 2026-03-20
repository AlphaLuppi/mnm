/**
 * TraceTimeline — Langfuse-style horizontal timeline visualization (OBS-06 upgrade)
 *
 * Renders agent trace observations as proportional horizontal bars
 * showing sequential/parallel execution, grouped by silver phases,
 * enriched with gold annotations.
 *
 * OBS-06: Now integrates with providers:
 *  - useTraceData() for roots/flatList
 *  - useTraceSelection() for click-to-select (synced with tree view)
 *  - useTraceViewPrefs() to show/hide duration/cost
 *
 * Structure:
 *   Gold verdict banner (top)
 *   +-- Phase row (COMPREHENSION)  ===========
 *   |   +-- tool:Read              ==
 *   |   +-- tool:Read              .==
 *   |   +-- tool:Grep              ..==
 *   +-- Phase row (IMPLEMENTATION) ......==========
 *   |   +-- tool:Edit              ......===
 *   |   +-- tool:Edit              .........===
 *   +-- Phase row (VERIFICATION)   ..............====
 *       +-- tool:Bash              ..............====
 */

import { useState, useMemo, useCallback } from "react";
import {
  BookOpen, Code, Terminal, MessageSquare, Play, Trophy,
  HelpCircle, ChevronDown, ChevronRight, Sparkles,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "../../lib/utils";
import { useTraceData, type TreeNode } from "../../context/TraceDataContext";
import { useTraceSelection } from "../../context/TraceSelectionContext";
import { useTraceViewPrefs } from "../../context/TraceViewPrefsContext";
import type { TracePhaseType, GoldVerdict, TracePhase, TraceObservation, TraceGold, TraceGoldPhase } from "../../api/traces";

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  COMPREHENSION: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", bar: "bg-blue-500" },
  IMPLEMENTATION: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", bar: "bg-emerald-500" },
  VERIFICATION: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", bar: "bg-amber-500" },
  COMMUNICATION: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", bar: "bg-purple-400" },
  INITIALIZATION: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400", bar: "bg-slate-500" },
  RESULT: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", bar: "bg-cyan-500" },
  UNKNOWN: { bg: "bg-neutral-500/10", border: "border-neutral-500/30", text: "text-neutral-400", bar: "bg-neutral-500" },
};

const PHASE_ICONS: Record<string, typeof BookOpen> = {
  COMPREHENSION: BookOpen,
  IMPLEMENTATION: Code,
  VERIFICATION: Terminal,
  COMMUNICATION: MessageSquare,
  INITIALIZATION: Play,
  RESULT: Trophy,
  UNKNOWN: HelpCircle,
};

const VERDICT_STYLES: Record<string, { icon: typeof CheckCircle; color: string }> = {
  success: { icon: CheckCircle, color: "text-emerald-400" },
  partial: { icon: AlertTriangle, color: "text-amber-400" },
  failure: { icon: XCircle, color: "text-red-400" },
  neutral: { icon: HelpCircle, color: "text-slate-400" },
};

// ─── Mock Data for Development ──────────────────────────────────────────────

export const MOCK_OBSERVATIONS: TraceObservation[] = [
  // Phase 1: INITIALIZATION
  { id: "obs-01", traceId: "t1", companyId: "c1", parentObservationId: null, type: "event", name: "init", status: "completed", startedAt: "2026-03-18T10:00:00Z", completedAt: "2026-03-18T10:00:01Z", durationMs: 500, level: "1", statusMessage: null, input: { model: "claude-sonnet-4-20250514" }, output: { sessionId: "sess-abc" }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: "claude-sonnet-4-20250514", modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:00Z" },
  // Phase 2: COMPREHENSION (3 reads)
  { id: "obs-02", traceId: "t1", companyId: "c1", parentObservationId: null, type: "span", name: "tool:Read", status: "completed", startedAt: "2026-03-18T10:00:02Z", completedAt: "2026-03-18T10:00:04Z", durationMs: 2200, level: "2", statusMessage: null, input: { file_path: "src/auth/login.ts" }, output: { lines: 245 }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: null, modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:02Z" },
  { id: "obs-03", traceId: "t1", companyId: "c1", parentObservationId: null, type: "span", name: "tool:Read", status: "completed", startedAt: "2026-03-18T10:00:05Z", completedAt: "2026-03-18T10:00:06Z", durationMs: 1500, level: "3", statusMessage: null, input: { file_path: "src/middleware/rbac.ts" }, output: { lines: 89 }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: null, modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:05Z" },
  { id: "obs-04", traceId: "t1", companyId: "c1", parentObservationId: null, type: "span", name: "tool:Grep", status: "completed", startedAt: "2026-03-18T10:00:07Z", completedAt: "2026-03-18T10:00:08Z", durationMs: 800, level: "4", statusMessage: null, input: { pattern: "validatePassword" }, output: { matches: 3, files: 2 }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: null, modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:07Z" },
  // Phase 3: COMMUNICATION (thinking + response)
  { id: "obs-05", traceId: "t1", companyId: "c1", parentObservationId: null, type: "generation", name: "thinking", status: "completed", startedAt: "2026-03-18T10:00:09Z", completedAt: "2026-03-18T10:00:14Z", durationMs: 5000, level: "5", statusMessage: null, input: null, output: { text: "The auth flow has a bug in the password comparison. It uses == instead of bcrypt.compare..." }, inputTokens: 8500, outputTokens: 1200, totalTokens: 9700, costUsd: "0.024", model: "claude-sonnet-4-20250514", modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:09Z" },
  { id: "obs-06", traceId: "t1", companyId: "c1", parentObservationId: null, type: "generation", name: "response", status: "completed", startedAt: "2026-03-18T10:00:15Z", completedAt: "2026-03-18T10:00:18Z", durationMs: 3000, level: "6", statusMessage: null, input: null, output: { text: "I found the bug in login.ts line 42. The password comparison uses == operator instead of bcrypt.compare()." }, inputTokens: 500, outputTokens: 800, totalTokens: 1300, costUsd: "0.008", model: "claude-sonnet-4-20250514", modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:15Z" },
  // Phase 4: IMPLEMENTATION (2 edits)
  { id: "obs-07", traceId: "t1", companyId: "c1", parentObservationId: null, type: "span", name: "tool:Edit", status: "completed", startedAt: "2026-03-18T10:00:20Z", completedAt: "2026-03-18T10:00:22Z", durationMs: 2000, level: "7", statusMessage: null, input: { file_path: "src/auth/login.ts", old_string: "if (password == stored)", new_string: "if (await bcrypt.compare(password, stored))" }, output: { success: true }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: null, modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:20Z" },
  { id: "obs-08", traceId: "t1", companyId: "c1", parentObservationId: null, type: "span", name: "tool:Edit", status: "completed", startedAt: "2026-03-18T10:00:23Z", completedAt: "2026-03-18T10:00:25Z", durationMs: 1800, level: "8", statusMessage: null, input: { file_path: "src/auth/login.test.ts" }, output: { success: true }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: null, modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:23Z" },
  // Phase 5: VERIFICATION (test run)
  { id: "obs-09", traceId: "t1", companyId: "c1", parentObservationId: null, type: "span", name: "tool:Bash", status: "completed", startedAt: "2026-03-18T10:00:27Z", completedAt: "2026-03-18T10:00:35Z", durationMs: 8000, level: "9", statusMessage: null, input: { command: "npm test -- --run" }, output: { output: "42 passed, 0 failed", exitCode: 0 }, inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, model: null, modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:27Z" },
  // Phase 6: RESULT
  { id: "obs-10", traceId: "t1", companyId: "c1", parentObservationId: null, type: "event", name: "run-result", status: "completed", startedAt: "2026-03-18T10:00:36Z", completedAt: "2026-03-18T10:00:36Z", durationMs: 100, level: "10", statusMessage: null, input: null, output: { stopReason: "end_turn", inputTokens: 18500, outputTokens: 4200, costUsd: 0.34 }, inputTokens: 18500, outputTokens: 4200, totalTokens: 22700, costUsd: "0.34", model: "claude-sonnet-4-20250514", modelParameters: null, metadata: null, createdAt: "2026-03-18T10:00:36Z" },
];

export const MOCK_PHASES: TracePhase[] = [
  { order: 0, type: "INITIALIZATION", name: "Initialization", startIdx: 0, endIdx: 0, observationCount: 1, summary: "Model: claude-sonnet-4-20250514" },
  { order: 1, type: "COMPREHENSION", name: "Comprehension", startIdx: 1, endIdx: 3, observationCount: 3, summary: "Read 2 files (src/auth/, src/middleware/) + Grep validatePassword" },
  { order: 2, type: "COMMUNICATION", name: "Communication", startIdx: 4, endIdx: 5, observationCount: 2, summary: "Agent analysis (2 blocks)" },
  { order: 3, type: "IMPLEMENTATION", name: "Implementation", startIdx: 6, endIdx: 7, observationCount: 2, summary: "Modified 2 files (login.ts, login.test.ts)" },
  { order: 4, type: "VERIFICATION", name: "Verification", startIdx: 8, endIdx: 8, observationCount: 1, summary: "Ran npm test: 42 passed, 0 failed" },
  { order: 5, type: "RESULT", name: "Result", startIdx: 9, endIdx: 9, observationCount: 1, summary: "Completed — 22.7k tokens, $0.34" },
];

export const MOCK_GOLD: TraceGold = {
  generatedAt: "2026-03-18T10:01:00Z",
  modelUsed: "claude-haiku-via-cli",
  prompt: "Analyse cette trace...",
  promptSources: { global: "Resume livraison" },
  phases: [
    { phaseOrder: 0, relevanceScore: 20, annotation: "Session initialized with Sonnet model", verdict: "neutral", keyObservationIds: ["obs-01"] },
    { phaseOrder: 1, relevanceScore: 75, annotation: "Agent read auth files to understand the login flow and searched for password validation pattern", verdict: "success", keyObservationIds: ["obs-02", "obs-04"] },
    { phaseOrder: 2, relevanceScore: 85, annotation: "Identified the root cause: == operator instead of bcrypt.compare() in password check", verdict: "success", keyObservationIds: ["obs-05"] },
    { phaseOrder: 3, relevanceScore: 95, annotation: "Fixed the security vulnerability and updated tests", verdict: "success", keyObservationIds: ["obs-07", "obs-08"] },
    { phaseOrder: 4, relevanceScore: 90, annotation: "All 42 tests pass — fix verified", verdict: "success", keyObservationIds: ["obs-09"] },
    { phaseOrder: 5, relevanceScore: 30, annotation: "Run completed successfully within budget", verdict: "success", keyObservationIds: ["obs-10"] },
  ],
  verdict: "success",
  verdictReason: "Bug de securite corrige (== -> bcrypt.compare), tests passent, fix verifie.",
  highlights: ["obs-05", "obs-07", "obs-09"],
  issueAcStatus: [
    { acId: "1", label: "Password uses bcrypt.compare()", status: "met", evidence: "obs-07: Edit login.ts" },
    { acId: "2", label: "All tests pass", status: "met", evidence: "obs-09: 42 passed, 0 failed" },
    { acId: "3", label: "No security regressions", status: "met", evidence: "obs-09: full test suite green" },
  ],
};

// ─── Provider-backed Timeline Component (OBS-06) ────────────────────────────

export function TraceTimeline() {
  const { roots, trace } = useTraceData();
  const { selectedNodeId, setSelectedNodeId } = useTraceSelection();
  const { showDuration, showCost } = useTraceViewPrefs();

  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Compute overall timeline bounds from the trace data
  const { timelineStart, duration } = useMemo(() => {
    if (!trace) return { timelineStart: 0, duration: 1 };
    const obs = trace.observations ?? [];
    if (obs.length === 0) return { timelineStart: 0, duration: 1 };
    const start = new Date(obs[0].startedAt).getTime();
    if (trace.totalDurationMs) return { timelineStart: start, duration: trace.totalDurationMs };
    const starts = obs.map(o => new Date(o.startedAt).getTime());
    const ends = obs.filter(o => o.completedAt).map(o => new Date(o.completedAt!).getTime());
    const dur = Math.max(...ends, ...starts) - Math.min(...starts) || 1;
    return { timelineStart: start, duration: dur };
  }, [trace]);

  // Gold highlights
  const highlightSet = useMemo(() => new Set(trace?.gold?.highlights ?? []), [trace]);

  const togglePhase = useCallback((id: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedNodeId(selectedNodeId === id ? null : id);
  }, [selectedNodeId, setSelectedNodeId]);

  // Helper: compute bar position for an observation
  const getBarStyle = useCallback((obs: TraceObservation) => {
    const obsStart = new Date(obs.startedAt).getTime() - timelineStart;
    const obsDur = obs.durationMs ?? 500;
    const leftPct = (obsStart / duration) * 100;
    const widthPct = Math.max((obsDur / duration) * 100, 0.5);
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  }, [timelineStart, duration]);

  if (roots.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm text-muted-foreground"
        data-testid="trace-timeline-empty"
      >
        No observations to display
      </div>
    );
  }

  return (
    <div data-testid="trace-timeline" className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Timeline
        </span>
        <div className="flex-1" />
      </div>

      {/* Time ruler */}
      <div className="shrink-0 px-2 pt-1">
        <TimeRuler durationMs={duration} />
      </div>

      {/* Scrollable timeline body */}
      <div className="flex-1 overflow-auto px-1">
        <div className="space-y-0.5">
          {roots.map((node) => {
            if (node.type === "phase") {
              return (
                <PhaseTimelineRow
                  key={node.id}
                  node={node}
                  isExpanded={expandedPhases.has(node.id)}
                  isSelected={selectedNodeId === node.id}
                  timelineStart={timelineStart}
                  duration={duration}
                  highlightSet={highlightSet}
                  selectedNodeId={selectedNodeId}
                  showDuration={showDuration}
                  showCost={showCost}
                  onToggle={() => togglePhase(node.id)}
                  onSelect={() => handleSelect(node.id)}
                  onSelectObs={handleSelect}
                  getBarStyle={getBarStyle}
                />
              );
            }
            // Flat observation (no phases)
            const obs = node.observation;
            if (!obs) return null;
            return (
              <ObsTimelineRow
                key={node.id}
                node={node}
                obs={obs}
                isSelected={selectedNodeId === node.id}
                isHighlight={highlightSet.has(node.id)}
                barStyle={getBarStyle(obs)}
                barColorClass="bg-neutral-500 opacity-50"
                showDuration={showDuration}
                onSelect={() => handleSelect(node.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Phase row in timeline ──────────────────────────────────────────────────

interface PhaseTimelineRowProps {
  node: TreeNode;
  isExpanded: boolean;
  isSelected: boolean;
  timelineStart: number;
  duration: number;
  highlightSet: Set<string>;
  selectedNodeId: string | null;
  showDuration: boolean;
  showCost: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onSelectObs: (id: string) => void;
  getBarStyle: (obs: TraceObservation) => { left: string; width: string };
}

function PhaseTimelineRow({
  node,
  isExpanded,
  isSelected,
  timelineStart,
  duration,
  highlightSet,
  selectedNodeId,
  showDuration,
  showCost,
  onToggle,
  onSelect,
  onSelectObs,
  getBarStyle,
}: PhaseTimelineRowProps) {
  const phaseType = (node.phaseType ?? "UNKNOWN") as string;
  const colors = PHASE_COLORS[phaseType] ?? PHASE_COLORS.UNKNOWN;
  const Icon = PHASE_ICONS[phaseType] ?? HelpCircle;
  const goldPhase = node.goldPhase;

  // Compute phase bar from child observations
  const childObs = useMemo(() => {
    const result: TraceObservation[] = [];
    for (const child of node.children) {
      if (child.observation) result.push(child.observation);
    }
    return result;
  }, [node.children]);

  const phaseBarStyle = useMemo(() => {
    if (childObs.length === 0) return { left: "0%", width: "1%" };
    const starts = childObs.map(o => new Date(o.startedAt).getTime());
    const ends = childObs.map(o => {
      const end = o.completedAt ? new Date(o.completedAt).getTime() : new Date(o.startedAt).getTime() + (o.durationMs ?? 500);
      return end;
    });
    const phaseStart = Math.min(...starts) - timelineStart;
    const phaseEnd = Math.max(...ends) - timelineStart;
    const leftPct = (phaseStart / duration) * 100;
    const widthPct = Math.max(((phaseEnd - phaseStart) / duration) * 100, 1);
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  }, [childObs, timelineStart, duration]);

  return (
    <div data-testid={`timeline-phase-${node.id}`}>
      {/* Phase header row */}
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors duration-150",
          "hover:bg-white/5",
          isExpanded && colors.bg,
          isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
        )}
        onClick={onSelect}
      >
        {/* Expand chevron */}
        <button
          className="w-4 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          tabIndex={-1}
        >
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </button>

        {/* Phase type icon + badge */}
        <div className={cn("flex items-center gap-1.5 w-36 flex-shrink-0", colors.text)}>
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium truncate">{phaseType}</span>
        </div>

        {/* Timeline bar */}
        <div className="flex-1 relative h-6 bg-white/[0.03] rounded overflow-hidden">
          <div
            className={cn("absolute top-0.5 bottom-0.5 rounded-sm transition-all", colors.bar, "opacity-70")}
            style={phaseBarStyle}
          />
          {/* Gold annotation overlay */}
          {goldPhase && (
            <div className="absolute inset-0 flex items-center px-2">
              <span className="text-[10px] text-white/70 truncate drop-shadow-sm">
                {goldPhase.annotation}
              </span>
            </div>
          )}
        </div>

        {/* Right-side metadata */}
        <div className="flex items-center gap-2 flex-shrink-0 w-44">
          {goldPhase && (
            <div className="flex items-center gap-1 w-12">
              <div className="h-1.5 w-8 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", colors.bar)}
                  style={{ width: `${goldPhase.relevanceScore}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{goldPhase.relevanceScore}</span>
            </div>
          )}
          {goldPhase && (
            <VerdictBadge verdict={goldPhase.verdict} size="sm" />
          )}
          <span className="text-[10px] text-muted-foreground w-8 text-right">
            {node.observationCount} obs
          </span>
          {showDuration && node.totalDurationMs > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatMs(node.totalDurationMs)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded: child observations */}
      {isExpanded && (
        <div className={cn("ml-6 border-l-2 pl-3 py-1 space-y-0.5", colors.border)}>
          {/* Silver summary */}
          {node.phase?.summary && (
            <div className="text-xs text-muted-foreground italic mb-1 px-1">
              {node.phase.summary}
            </div>
          )}
          {node.children.map((child) => {
            const obs = child.observation;
            if (!obs) return null;
            return (
              <ObsTimelineRow
                key={child.id}
                node={child}
                obs={obs}
                isSelected={selectedNodeId === child.id}
                isHighlight={highlightSet.has(child.id)}
                barStyle={getBarStyle(obs)}
                barColorClass={cn(
                  obs.status === "error" ? "bg-red-500/60" : [colors.bar, "opacity-50"].join(" "),
                )}
                showDuration={showDuration}
                onSelect={() => onSelectObs(child.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Observation row in timeline ────────────────────────────────────────────

interface ObsTimelineRowProps {
  node: TreeNode;
  obs: TraceObservation;
  isSelected: boolean;
  isHighlight: boolean;
  barStyle: { left: string; width: string };
  barColorClass: string;
  showDuration: boolean;
  onSelect: () => void;
}

function ObsTimelineRow({
  node,
  obs,
  isSelected,
  isHighlight,
  barStyle,
  barColorClass,
  showDuration,
  onSelect,
}: ObsTimelineRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded px-1 py-0.5 cursor-pointer transition-colors duration-150",
        "hover:bg-white/5",
        isHighlight && "ring-1 ring-amber-500/40 bg-amber-500/5",
        isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
      )}
      onClick={onSelect}
      data-testid={`timeline-obs-${node.id}`}
    >
      {/* Name */}
      <span className={cn(
        "text-[11px] font-mono w-28 flex-shrink-0 truncate",
        obs.status === "error" ? "text-red-400" : "text-foreground/80"
      )}>
        {obs.name}
        {isHighlight && <Sparkles className="inline h-2.5 w-2.5 ml-0.5 text-amber-400" />}
      </span>

      {/* Mini timeline bar */}
      <div className="flex-1 relative h-4 bg-white/[0.02] rounded overflow-hidden">
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded-sm",
            barColorClass,
            isHighlight ? "opacity-80 ring-1 ring-amber-400/30" : "",
          )}
          style={barStyle}
        />
      </div>

      {/* Duration */}
      {showDuration && (
        <span className="text-[10px] text-muted-foreground w-12 text-right flex-shrink-0">
          {(obs.durationMs ?? 0) >= 1000
            ? `${((obs.durationMs ?? 0) / 1000).toFixed(1)}s`
            : `${obs.durationMs ?? 0}ms`}
        </span>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TimeRuler({ durationMs }: { durationMs: number }) {
  const ticks = useMemo(() => {
    const count = 6;
    return Array.from({ length: count }, (_, i) => ({
      pct: (i / (count - 1)) * 100,
      label: formatMs(durationMs * (i / (count - 1))),
    }));
  }, [durationMs]);

  return (
    <div className="flex items-center gap-2 h-5 relative ml-[168px] mr-[10px]">
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
      {ticks.map((tick, i) => (
        <div
          key={i}
          className="absolute text-[9px] text-muted-foreground/60 -translate-x-1/2"
          style={{ left: `${tick.pct}%` }}
        >
          <div className="h-1.5 w-px bg-white/10 mx-auto mb-0.5" />
          {tick.label}
        </div>
      ))}
    </div>
  );
}

function VerdictBadge({ verdict, size = "sm" }: { verdict: string; size?: "sm" | "md" }) {
  const style = VERDICT_STYLES[verdict] ?? VERDICT_STYLES.neutral;
  const Icon = style.icon;
  return (
    <span className={cn("flex items-center gap-0.5", style.color)}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      <span className={cn("capitalize", size === "sm" ? "text-[10px]" : "text-xs")}>{verdict}</span>
    </span>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m${sec}s` : `${min}m`;
}
