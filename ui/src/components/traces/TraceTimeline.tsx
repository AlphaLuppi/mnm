/**
 * TraceTimeline — Langfuse-style horizontal timeline visualization
 *
 * Renders agent trace observations as proportional horizontal bars
 * showing sequential/parallel execution, grouped by silver phases,
 * enriched with gold annotations.
 *
 * Structure:
 *   Gold verdict banner (top)
 *   ├── Phase row (COMPREHENSION)  ██████░░░░░░░░░░░░░░░░
 *   │   ├── tool:Read              ██░░░░░░░░░░░░░░░░░░░░
 *   │   ├── tool:Read              ░██░░░░░░░░░░░░░░░░░░░
 *   │   └── tool:Grep              ░░██░░░░░░░░░░░░░░░░░░
 *   ├── Phase row (IMPLEMENTATION) ░░░░░░██████████░░░░░░
 *   │   ├── tool:Edit              ░░░░░░███░░░░░░░░░░░░░
 *   │   └── tool:Edit              ░░░░░░░░░███░░░░░░░░░░
 *   └── Phase row (VERIFICATION)   ░░░░░░░░░░░░░░░████░░
 *       └── tool:Bash              ░░░░░░░░░░░░░░░████░░
 */

import { useState, useMemo } from "react";
import {
  BookOpen, Code, Terminal, MessageSquare, Play, Trophy,
  HelpCircle, ChevronDown, ChevronRight, Sparkles,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "../../lib/utils";
import type { TracePhase, TraceObservation, TraceGold, TraceGoldPhase } from "../../api/traces";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TraceTimelineProps {
  observations: TraceObservation[];
  phases: TracePhase[] | null;
  gold: TraceGold | null;
  totalDurationMs: number | null;
}

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
  promptSources: { global: "Résumé livraison" },
  phases: [
    { phaseOrder: 0, relevanceScore: 20, annotation: "Session initialized with Sonnet model", verdict: "neutral", keyObservationIds: ["obs-01"] },
    { phaseOrder: 1, relevanceScore: 75, annotation: "Agent read auth files to understand the login flow and searched for password validation pattern", verdict: "success", keyObservationIds: ["obs-02", "obs-04"] },
    { phaseOrder: 2, relevanceScore: 85, annotation: "Identified the root cause: == operator instead of bcrypt.compare() in password check", verdict: "success", keyObservationIds: ["obs-05"] },
    { phaseOrder: 3, relevanceScore: 95, annotation: "Fixed the security vulnerability and updated tests", verdict: "success", keyObservationIds: ["obs-07", "obs-08"] },
    { phaseOrder: 4, relevanceScore: 90, annotation: "All 42 tests pass — fix verified", verdict: "success", keyObservationIds: ["obs-09"] },
    { phaseOrder: 5, relevanceScore: 30, annotation: "Run completed successfully within budget", verdict: "success", keyObservationIds: ["obs-10"] },
  ],
  verdict: "success",
  verdictReason: "Bug de sécurité corrigé (== → bcrypt.compare), tests passent, fix vérifié.",
  highlights: ["obs-05", "obs-07", "obs-09"],
  issueAcStatus: [
    { acId: "1", label: "Password uses bcrypt.compare()", status: "met", evidence: "obs-07: Edit login.ts" },
    { acId: "2", label: "All tests pass", status: "met", evidence: "obs-09: 42 passed, 0 failed" },
    { acId: "3", label: "No security regressions", status: "met", evidence: "obs-09: full test suite green" },
  ],
};

// ─── Timeline Component ─────────────────────────────────────────────────────

export function TraceTimeline({ observations, phases, gold, totalDurationMs }: TraceTimelineProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [expandedObs, setExpandedObs] = useState<Set<string>>(new Set());

  const timelineStart = useMemo(() => {
    if (observations.length === 0) return 0;
    return new Date(observations[0].startedAt).getTime();
  }, [observations]);

  const duration = totalDurationMs ?? useMemo(() => {
    if (observations.length === 0) return 1;
    const starts = observations.map(o => new Date(o.startedAt).getTime());
    const ends = observations.filter(o => o.completedAt).map(o => new Date(o.completedAt!).getTime());
    return Math.max(...ends, ...starts) - Math.min(...starts) || 1;
  }, [observations]);

  const togglePhase = (order: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(order) ? next.delete(order) : next.add(order);
      return next;
    });
  };

  const toggleObs = (id: string) => {
    setExpandedObs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build phase → observations mapping
  const phaseObsMap = useMemo(() => {
    const map = new Map<number, TraceObservation[]>();
    if (!phases) return map;
    for (const phase of phases) {
      map.set(phase.order, observations.slice(phase.startIdx, phase.endIdx + 1));
    }
    return map;
  }, [phases, observations]);

  // Gold phase lookup
  const goldPhaseMap = useMemo(() => {
    const map = new Map<number, TraceGoldPhase>();
    if (!gold?.phases) return map;
    for (const gp of gold.phases) {
      map.set(gp.phaseOrder, gp);
    }
    return map;
  }, [gold]);

  const highlightSet = useMemo(() => new Set(gold?.highlights ?? []), [gold]);

  return (
    <div data-testid="trace-timeline" className="space-y-1">
      {/* Time ruler */}
      <TimeRuler durationMs={duration} />

      {/* Phases as timeline rows */}
      {phases?.map((phase) => {
        const colors = PHASE_COLORS[phase.type] ?? PHASE_COLORS.UNKNOWN;
        const Icon = PHASE_ICONS[phase.type] ?? HelpCircle;
        const goldPhase = goldPhaseMap.get(phase.order);
        const isExpanded = expandedPhases.has(phase.order);
        const phaseObs = phaseObsMap.get(phase.order) ?? [];

        // Calculate phase position on timeline
        const phaseStart = phaseObs.length > 0
          ? new Date(phaseObs[0].startedAt).getTime() - timelineStart
          : 0;
        const phaseEnd = phaseObs.length > 0
          ? Math.max(...phaseObs.map(o => {
              const end = o.completedAt ? new Date(o.completedAt).getTime() : new Date(o.startedAt).getTime() + (o.durationMs ?? 500);
              return end;
            })) - timelineStart
          : phaseStart + 1000;
        const leftPct = (phaseStart / duration) * 100;
        const widthPct = Math.max(((phaseEnd - phaseStart) / duration) * 100, 1);

        return (
          <div key={phase.order} data-testid={`trace-phase-${phase.order}`}>
            {/* Phase row */}
            <div
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors duration-150",
                "hover:bg-white/5",
                isExpanded && colors.bg,
              )}
              onClick={() => togglePhase(phase.order)}
            >
              {/* Expand chevron */}
              <div className="w-4 flex-shrink-0">
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </div>

              {/* Phase type icon + badge */}
              <div className={cn("flex items-center gap-1.5 w-36 flex-shrink-0", colors.text)}>
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium truncate">{phase.type}</span>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-6 bg-white/[0.03] rounded overflow-hidden">
                <div
                  className={cn("absolute top-0.5 bottom-0.5 rounded-sm transition-all", colors.bar, "opacity-70")}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
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
                {/* Relevance score */}
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
                {/* Verdict badge */}
                {goldPhase && (
                  <VerdictBadge verdict={goldPhase.verdict} size="sm" />
                )}
                {/* Observation count */}
                <span className="text-[10px] text-muted-foreground w-8 text-right">
                  {phase.observationCount} obs
                </span>
              </div>
            </div>

            {/* Expanded: Silver detail (observations within phase) */}
            {isExpanded && (
              <div className={cn("ml-6 border-l-2 pl-3 py-1 space-y-0.5", colors.border)}>
                {/* Silver summary */}
                <div className="text-xs text-muted-foreground italic mb-1 px-1">
                  {phase.summary}
                </div>
                {/* Individual observations */}
                {phaseObs.map((obs) => {
                  const obsStart = new Date(obs.startedAt).getTime() - timelineStart;
                  const obsDur = obs.durationMs ?? 500;
                  const obsLeftPct = (obsStart / duration) * 100;
                  const obsWidthPct = Math.max((obsDur / duration) * 100, 0.5);
                  const isHighlight = highlightSet.has(obs.id);
                  const isObsExpanded = expandedObs.has(obs.id);

                  return (
                    <div key={obs.id}>
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded px-1 py-0.5 cursor-pointer transition-colors duration-150",
                          "hover:bg-white/5",
                          isHighlight && "ring-1 ring-amber-500/40 bg-amber-500/5",
                          isObsExpanded && "bg-white/5",
                        )}
                        onClick={(e) => { e.stopPropagation(); toggleObs(obs.id); }}
                        data-testid={`trace-obs-${obs.id}`}
                      >
                        {/* Expand */}
                        <div className="w-3 flex-shrink-0">
                          {isObsExpanded
                            ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                            : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                          }
                        </div>
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
                              obs.status === "error" ? "bg-red-500/60" : [colors.bar, "opacity-50"].join(" "),
                              isHighlight ? "opacity-80 ring-1 ring-amber-400/30" : "",
                            )}
                            style={{ left: `${obsLeftPct}%`, width: `${obsWidthPct}%` }}
                          />
                        </div>

                        {/* Duration */}
                        <span className="text-[10px] text-muted-foreground w-12 text-right flex-shrink-0">
                          {obsDur >= 1000 ? `${(obsDur / 1000).toFixed(1)}s` : `${obsDur}ms`}
                        </span>
                      </div>

                      {/* Bronze: Raw JSON (expanded) */}
                      {isObsExpanded && (
                        <div className="ml-5 my-1 rounded bg-black/30 border border-white/5 p-2 text-[10px] font-mono space-y-1 overflow-x-auto">
                          {obs.input != null && (
                            <div>
                              <span className="text-blue-400">input:</span>
                              <pre className="text-white/60 whitespace-pre-wrap break-all">
                                {JSON.stringify(obs.input, null, 2) as string}
                              </pre>
                            </div>
                          )}
                          {obs.output != null && (
                            <div>
                              <span className="text-emerald-400">output:</span>
                              <pre className="text-white/60 whitespace-pre-wrap break-all">
                                {JSON.stringify(obs.output, null, 2) as string}
                              </pre>
                            </div>
                          )}
                          {obs.costUsd && (
                            <div className="text-muted-foreground">
                              cost: ${obs.costUsd} | tokens: {obs.totalTokens ?? "-"} | model: {obs.model ?? "-"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Fallback: no phases, show raw observations as flat timeline */}
      {(!phases || phases.length === 0) && observations.length > 0 && (
        <div className="text-xs text-muted-foreground italic p-2">
          No phase analysis available. Showing raw observations.
        </div>
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
    <div className="flex items-center gap-2 ml-[184px] mr-[176px] h-5 relative">
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
