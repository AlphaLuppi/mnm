/**
 * Bronze Trace Capture — Real-time middleware that captures ALL agent stream
 * data as bronze observations in the trace_observations table.
 *
 * Architecture:
 *   adapter → onLog(stream, chunk) → bronzeCapture.ingest(chunk) → trace_observations
 *
 * This sits ON TOP of all adapters via the onLog callback in heartbeat.ts.
 * No adapter modification needed — ONE interception point for ALL agents.
 *
 * Data flow:
 *   Bronze (raw)  → every chunk persisted as-is
 *   Silver (clean) → background job groups/phases/enriches (future)
 *   Gold (lens)    → user prompt × silver data = personalized analysis
 */

import type { Db } from "@mnm/db";
import { traces, traceObservations } from "@mnm/db";
import { eq, sql } from "drizzle-orm";
import { publishLiveEvent } from "./live-events.js";

// ─── Stream-JSON Event Types ────────────────────────────────────────────────

interface StreamJsonEvent {
  type: string;
  subtype?: string;
  // tool_use
  tool_use_id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // tool_result
  tool_use_id_ref?: string;
  content?: string;
  is_error?: boolean;
  // text / thinking
  text?: string;
  // result
  result?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cost_usd?: number;
    stop_reason?: string;
    is_error?: boolean;
    errors?: string[];
  };
  // init
  model?: string;
  session_id?: string;
}

// ─── Bronze Capture State per Run ───────────────────────────────────────────

interface RunTraceState {
  traceId: string;
  companyId: string;
  agentId: string;
  runId: string;
  buffer: string; // partial line buffer for stream chunks
  observationCount: number;
  pendingToolCalls: Map<string, string>; // tool_use_id → observation_id
}

const activeRuns = new Map<string, RunTraceState>();

// ─── Public API ─────────────────────────────────────────────────────────────

export function bronzeTraceCapture(db: Db) {
  return {
    /**
     * Start capturing for a new run. Creates the trace record.
     * Call this when a heartbeat run begins (before adapter.execute).
     */
    startCapture: async (opts: {
      runId: string;
      companyId: string;
      agentId: string;
      agentName: string;
      workflowInstanceId?: string | null;
      stageInstanceId?: string | null;
    }): Promise<string> => {
      const [row] = await db.insert(traces).values({
        companyId: opts.companyId,
        heartbeatRunId: opts.runId,
        workflowInstanceId: opts.workflowInstanceId ?? null,
        stageInstanceId: opts.stageInstanceId ?? null,
        agentId: opts.agentId,
        name: `Run ${opts.runId.slice(0, 8)} — ${opts.agentName}`,
        status: "running",
      }).returning();

      const traceId = row.id;

      activeRuns.set(opts.runId, {
        traceId,
        companyId: opts.companyId,
        agentId: opts.agentId,
        runId: opts.runId,
        buffer: "",
        observationCount: 0,
        pendingToolCalls: new Map(),
      });

      publishLiveEvent({
        companyId: opts.companyId,
        type: "trace.created",
        payload: { id: traceId, agentId: opts.agentId, name: row.name, status: "running" },
      });

      return traceId;
    },

    /**
     * Ingest a raw stdout chunk. Parses stream-json lines and persists
     * each event as a bronze observation.
     * Call this inside the onLog callback for stdout chunks.
     */
    ingestChunk: async (runId: string, chunk: string): Promise<void> => {
      const state = activeRuns.get(runId);
      if (!state) return; // no trace for this run

      // Buffer partial lines
      state.buffer += chunk;
      const lines = state.buffer.split("\n");
      state.buffer = lines.pop() ?? ""; // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: StreamJsonEvent;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue; // not JSON — skip non-stream lines
        }

        if (!event.type) continue;

        await persistBronzeObservation(db, state, event);
      }
    },

    /**
     * Complete the trace when the run finishes.
     * Recalculates totals atomically.
     */
    completeCapture: async (
      runId: string,
      outcome: "completed" | "failed" | "cancelled",
    ): Promise<void> => {
      const state = activeRuns.get(runId);
      if (!state) return;

      // Atomic aggregation of totals from observations
      await db
        .update(traces)
        .set({
          status: outcome,
          completedAt: new Date(),
          totalDurationMs: sql`EXTRACT(EPOCH FROM (NOW() - ${traces.startedAt})) * 1000`,
          totalTokensIn: sql`COALESCE((SELECT SUM(input_tokens) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)`,
          totalTokensOut: sql`COALESCE((SELECT SUM(output_tokens) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)`,
          totalCostUsd: sql`COALESCE((SELECT SUM(cost_usd) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)`,
          updatedAt: new Date(),
        })
        .where(eq(traces.id, state.traceId));

      publishLiveEvent({
        companyId: state.companyId,
        type: "trace.completed",
        payload: { id: state.traceId, agentId: state.agentId, status: outcome },
      });

      activeRuns.delete(runId);
    },

    /** Check if a run has active trace capture */
    isCapturing: (runId: string): boolean => activeRuns.has(runId),

    /** Get trace ID for a run */
    getTraceId: (runId: string): string | undefined => activeRuns.get(runId)?.traceId,
  };
}

// ─── Internal: Persist a single stream-json event as bronze observation ─────

async function persistBronzeObservation(
  db: Db,
  state: RunTraceState,
  event: StreamJsonEvent,
): Promise<void> {
  state.observationCount++;

  let type: string;
  let name: string;
  let input: Record<string, unknown> | undefined;
  let output: Record<string, unknown> | undefined;
  let status = "completed";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let costUsd: string | undefined;
  let model: string | undefined;
  let parentObservationId: string | undefined;

  switch (event.type) {
    case "tool_use": {
      type = "span";
      name = `tool:${event.name ?? "unknown"}`;
      input = event.input;
      status = "started";
      break;
    }
    case "tool_result": {
      // Match to the pending tool_use observation
      const toolUseId = event.tool_use_id_ref ?? event.tool_use_id;
      if (toolUseId && state.pendingToolCalls.has(toolUseId)) {
        const obsId = state.pendingToolCalls.get(toolUseId)!;
        // Update the existing observation instead of creating new one
        await db
          .update(traceObservations)
          .set({
            status: event.is_error ? "error" : "completed",
            completedAt: new Date(),
            durationMs: sql`EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000`,
            output: event.content
              ? truncateOutput({ content: event.content, is_error: event.is_error })
              : null,
            statusMessage: event.is_error ? "error" : null,
          })
          .where(eq(traceObservations.id, obsId));

        state.pendingToolCalls.delete(toolUseId);

        publishLiveEvent({
          companyId: state.companyId,
          type: "trace.observation_completed",
          payload: { id: obsId, traceId: state.traceId, status: event.is_error ? "error" : "completed" },
        });
        return; // Don't create a new observation
      }
      // Orphan tool_result — create as standalone
      type = "event";
      name = "tool_result";
      output = event.content ? { content: event.content.slice(0, 2000) } : undefined;
      status = event.is_error ? "error" : "completed";
      break;
    }
    case "text": {
      type = "generation";
      name = "response";
      output = event.text ? { text: event.text.slice(0, 2000) } : undefined;
      break;
    }
    case "thinking": {
      type = "generation";
      name = "thinking";
      output = event.text ? { text: event.text.slice(0, 500) } : undefined;
      break;
    }
    case "result": {
      type = "event";
      name = "run-result";
      const r = event.result;
      inputTokens = r?.input_tokens;
      outputTokens = r?.output_tokens;
      costUsd = r?.cost_usd?.toString();
      status = r?.is_error ? "error" : "completed";
      output = r ? {
        stopReason: r.stop_reason,
        errors: r.errors,
        cachedTokens: r.cache_read_input_tokens,
      } : undefined;
      break;
    }
    case "init": {
      type = "event";
      name = "init";
      model = event.model;
      output = { model: event.model, sessionId: event.session_id };
      break;
    }
    default: {
      // Unknown event type — still capture as bronze
      type = "event";
      name = `raw:${event.type}`;
      output = { raw: event };
      break;
    }
  }

  const [row] = await db.insert(traceObservations).values({
    traceId: state.traceId,
    companyId: state.companyId,
    parentObservationId: parentObservationId ?? null,
    type,
    name,
    status,
    level: String(state.observationCount),
    input: input ? truncateOutput(input) : null,
    output: output ? truncateOutput(output) : null,
    inputTokens: inputTokens ?? null,
    outputTokens: outputTokens ?? null,
    totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0) || null,
    costUsd: costUsd ?? null,
    model: model ?? null,
  }).returning();

  // Track pending tool_use for matching tool_result later
  if (event.type === "tool_use" && event.tool_use_id) {
    state.pendingToolCalls.set(event.tool_use_id, row.id);
  }

  publishLiveEvent({
    companyId: state.companyId,
    type: "trace.observation_created",
    payload: {
      id: row.id,
      traceId: state.traceId,
      type,
      name,
      status,
    },
  });
}

function truncateOutput(data: Record<string, unknown>): Record<string, unknown> {
  const str = JSON.stringify(data);
  if (str.length <= 10_000) return data;
  return { _truncated: true, _preview: str.slice(0, 500) + "...[truncated]" };
}
