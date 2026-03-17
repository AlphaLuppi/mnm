import { useMemo } from "react";
import { Link } from "@/lib/router";
import type { Trace } from "../../api/traces";
import type { StageInstance } from "../../api/workflows";
import { AgentTimelineBar } from "./AgentTimelineBar";
import { cn } from "../../lib/utils";

interface WorkflowTimelineProps {
  traces: Trace[];
  stages: Array<{ stageOrder?: number; order?: number; name: string }>;
  agentMap: Map<string, string>;
}

interface TimelineRow {
  trace: Trace;
  agentName: string;
  startOffset: number; // ms from timeline start
  duration: number; // ms
  isSubTrace: boolean;
}

export function WorkflowTimeline({
  traces,
  stages,
  agentMap,
}: WorkflowTimelineProps) {
  const { rows, totalDuration, timelineStart } = useMemo(() => {
    if (traces.length === 0) {
      return { rows: [], totalDuration: 1, timelineStart: 0 };
    }

    const starts = traces.map((t) => new Date(t.startedAt).getTime());
    const earliest = Math.min(...starts);
    const now = Date.now();

    // Build rows: parent traces first, then sub-traces indented
    const parentTraces = traces.filter((t) => !t.parentTraceId);
    const subTraces = traces.filter((t) => t.parentTraceId);

    const buildRows: TimelineRow[] = [];

    for (const trace of parentTraces) {
      const start = new Date(trace.startedAt).getTime();
      const end = trace.completedAt
        ? new Date(trace.completedAt).getTime()
        : now;
      buildRows.push({
        trace,
        agentName: agentMap.get(trace.agentId) ?? trace.agentId.slice(0, 8),
        startOffset: start - earliest,
        duration: end - start,
        isSubTrace: false,
      });

      // Add sub-traces indented under parent
      const children = subTraces.filter((st) => st.parentTraceId === trace.id);
      for (const child of children) {
        const childStart = new Date(child.startedAt).getTime();
        const childEnd = child.completedAt
          ? new Date(child.completedAt).getTime()
          : now;
        buildRows.push({
          trace: child,
          agentName: agentMap.get(child.agentId) ?? child.agentId.slice(0, 8),
          startOffset: childStart - earliest,
          duration: childEnd - childStart,
          isSubTrace: true,
        });
      }
    }

    // Orphan sub-traces (parent not in current list)
    const parentIds = new Set(parentTraces.map((t) => t.id));
    const orphanSubs = subTraces.filter(
      (st) => st.parentTraceId && !parentIds.has(st.parentTraceId),
    );
    for (const child of orphanSubs) {
      const childStart = new Date(child.startedAt).getTime();
      const childEnd = child.completedAt
        ? new Date(child.completedAt).getTime()
        : now;
      buildRows.push({
        trace: child,
        agentName: agentMap.get(child.agentId) ?? child.agentId.slice(0, 8),
        startOffset: childStart - earliest,
        duration: childEnd - childStart,
        isSubTrace: true,
      });
    }

    const allEnds = buildRows.map((r) => r.startOffset + r.duration);
    const maxEnd = allEnds.length > 0 ? Math.max(...allEnds) : 1;

    return {
      rows: buildRows,
      totalDuration: Math.max(maxEnd, 1),
      timelineStart: earliest,
    };
  }, [traces, agentMap]);

  // Time axis markers
  const markers = useMemo(() => {
    const count = 5;
    const step = totalDuration / count;
    return Array.from({ length: count + 1 }, (_, i) => ({
      offset: i * step,
      label: formatTimeLabel(i * step),
    }));
  }, [totalDuration]);

  if (rows.length === 0) return null;

  return (
    <div data-testid="trace-12-timeline" className="space-y-2">
      {/* Timeline bars */}
      <div className="space-y-1">
        {rows.map((row) => (
          <AgentTimelineBar
            key={row.trace.id}
            trace={row.trace}
            agentName={row.agentName}
            startOffset={row.startOffset}
            duration={row.duration}
            totalDuration={totalDuration}
            isSubTrace={row.isSubTrace}
          />
        ))}
      </div>

      {/* Time axis */}
      <div
        data-testid="trace-12-time-axis"
        className="relative h-5 ml-[140px]"
      >
        {markers.map((marker, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${(marker.offset / totalDuration) * 100}%` }}
          >
            {marker.label}
          </span>
        ))}
      </div>

      {/* Stage handoff indicators */}
      {stages.length > 1 && (
        <div
          data-testid="trace-12-handoffs"
          className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-4"
        >
          {stages.map((stage, i) => (
            <span key={stage.order} className="flex items-center gap-1">
              <span className="font-medium">{stage.name}</span>
              {i < stages.length - 1 && (
                <span className="text-muted-foreground/50 mx-1">&rarr;</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeLabel(ms: number): string {
  if (ms === 0) return "0";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m${sec}s` : `${min}m`;
}
