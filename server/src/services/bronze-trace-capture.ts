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

/** Execute a DB operation with RLS tenant context set inside a transaction */
async function withTenantContext<T>(db: Db, companyId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
    return fn(tx as unknown as Db);
  });
}

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
  content?: string | ContentBlock[];
  is_error?: boolean;
  // text / thinking
  text?: string;
  // result — fields are at top level in the stream JSON, not nested under "result"
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cached_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  total_cost_usd?: number;
  stop_reason?: string;
  errors?: string[];
  // legacy: some adapters nest under "result"
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
  // Claude Code wrapper: content blocks are inside message.content[]
  message?: {
    content?: ContentBlock[];
    role?: string;
  };
}

// ─── Content Block Types (inside assistant/user message.content[]) ───────────

interface ContentBlock {
  type: string;
  // tool_use block
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // tool_result block
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
  // text block
  text?: string;
}

/**
 * Convert a content block (from inside assistant/user message.content[])
 * into a synthetic StreamJsonEvent for unified processing.
 */
function contentBlockToEvent(block: ContentBlock): StreamJsonEvent | null {
  switch (block.type) {
    case "tool_use":
      return {
        type: "tool_use",
        tool_use_id: block.id,
        name: block.name,
        input: block.input,
      };
    case "tool_result": {
      // tool_result content can be string or array of content blocks
      let textContent: string | undefined;
      if (typeof block.content === "string") {
        textContent = block.content;
      } else if (Array.isArray(block.content)) {
        textContent = block.content
          .filter((c): c is ContentBlock & { text: string } => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text)
          .join("\n");
      }
      return {
        type: "tool_result",
        tool_use_id_ref: block.tool_use_id,
        content: textContent,
        is_error: block.is_error,
      };
    }
    case "thinking":
      return {
        type: "thinking",
        text: block.text,
      };
    case "text":
      return {
        type: "text",
        text: block.text,
      };
    default:
      // Unknown block type — still capture
      return {
        type: block.type,
        text: block.text,
      };
  }
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
      const row = await withTenantContext(db, opts.companyId, async (tx) => {
        const [r] = await tx.insert(traces).values({
          companyId: opts.companyId,
          heartbeatRunId: opts.runId,
          workflowInstanceId: opts.workflowInstanceId ?? null,
          stageInstanceId: opts.stageInstanceId ?? null,
          agentId: opts.agentId,
          name: `Run ${opts.runId.slice(0, 8)} — ${opts.agentName}`,
          status: "running",
        }).returning();
        return r;
      });

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

        // Claude Code stream-json format: tool calls and text are INSIDE
        // assistant.message.content[] and user.message.content[], not top-level.
        // We need to extract content blocks and process each one.
        if ((event.type === "assistant" || event.type === "user") && event.message?.content) {
          const blocks = event.message.content as ContentBlock[];
          for (const block of blocks) {
            if (!block.type) continue;
            // Convert content block to a synthetic top-level event for processing
            const syntheticEvent = contentBlockToEvent(block);
            if (syntheticEvent) {
              await persistBronzeObservation(db, state, syntheticEvent);
            }
          }
          // Don't also process the wrapper event
          continue;
        }

        // Top-level events (system:init, result, rate_limit_event, etc.)
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

      // Atomic aggregation of totals from observations (with RLS context + proper casts)
      // NOTE: cost_usd is text, so we CAST to numeric before SUM to avoid "function sum(text) does not exist"
      await withTenantContext(db, state.companyId, async (tx) => {
        await tx.execute(sql`
          UPDATE traces SET
            status = ${outcome},
            completed_at = NOW(),
            total_duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 AS integer),
            total_tokens_in = COALESCE((SELECT SUM(input_tokens) FROM trace_observations WHERE trace_id = ${state.traceId}), 0),
            total_tokens_out = COALESCE((SELECT SUM(output_tokens) FROM trace_observations WHERE trace_id = ${state.traceId}), 0),
            total_cost_usd = COALESCE((SELECT SUM(CAST(cost_usd AS numeric)) FROM trace_observations WHERE trace_id = ${state.traceId}), 0)::text,
            updated_at = NOW()
          WHERE id = ${state.traceId}
        `);
      });

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
        await withTenantContext(db, state.companyId, async (tx) => {
          await tx
            .update(traceObservations)
            .set({
              status: event.is_error ? "error" : "completed",
              completedAt: new Date(),
              durationMs: sql`CAST(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 AS integer)`,
              output: event.content
                ? truncateOutput({ content: event.content, is_error: event.is_error })
                : null,
              statusMessage: event.is_error ? "error" : null,
            })
            .where(eq(traceObservations.id, obsId));
        });

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
      // Stream format: usage{input_tokens,output_tokens}, total_cost_usd at top level
      // Legacy format: nested under event.result
      const u = event.usage;
      const r = event.result;
      inputTokens = u?.input_tokens ?? r?.input_tokens;
      outputTokens = u?.output_tokens ?? r?.output_tokens;
      costUsd = event.total_cost_usd != null
        ? event.total_cost_usd.toString()
        : r?.cost_usd?.toString();
      const isError = event.subtype === "error" || r?.is_error;
      status = isError ? "error" : "completed";
      output = {
        stopReason: event.stop_reason ?? r?.stop_reason,
        errors: event.errors ?? r?.errors,
        cachedTokens: u?.cache_read_input_tokens ?? u?.cached_input_tokens ?? r?.cache_read_input_tokens,
        inputTokens,
        outputTokens,
        costUsd,
      };
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

  const row = await withTenantContext(db, state.companyId, async (tx) => {
    const [r] = await tx.insert(traceObservations).values({
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
    return r;
  });

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
