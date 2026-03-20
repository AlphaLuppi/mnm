import type { Db } from "@mnm/db";
import type { Trace, CreateObservation } from "@mnm/shared";
import { traceService } from "./trace-service.js";

/**
 * TRACE-04: TraceEmitter — maps Claude stream-json events to trace observations.
 *
 * Called from the heartbeat service after an adapter run completes.
 * Processes the raw stdout (stream-json lines) and creates trace + observations.
 *
 * Reusable for other adapters — just call processStreamJson() with the stdout.
 */

interface StreamJsonEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  model?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: Record<string, unknown>;
    }>;
  };
  content_block?: {
    type: string;
    text?: string;
    name?: string;
    id?: string;
    input?: Record<string, unknown>;
  };
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
  total_cost_usd?: number;
  stop_reason?: string;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

// Model pricing ($/1M tokens) — conservative estimates
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-sonnet-20240620": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-3-opus-20240229": { input: 15, output: 75 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): string {
  const pricing = MODEL_PRICING[model] ?? { input: 3, output: 15 }; // default to sonnet
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return cost.toFixed(6);
}

function parseJsonLine(line: string): StreamJsonEvent | null {
  try {
    return JSON.parse(line.trim());
  } catch {
    return null;
  }
}

export function traceEmitter(db: Db) {
  const svc = traceService(db);

  return {
    /**
     * Process a completed adapter run and create trace + observations.
     *
     * @param companyId - Company ID
     * @param agentId - Agent ID
     * @param heartbeatRunId - Associated heartbeat run ID
     * @param stdout - Raw stdout from the adapter (stream-json lines)
     * @param opts - Optional: workflowInstanceId, stageInstanceId, parentTraceId
     */
    processRun: async (
      companyId: string,
      agentId: string,
      heartbeatRunId: string,
      stdout: string,
      opts?: {
        workflowInstanceId?: string;
        stageInstanceId?: string;
        parentTraceId?: string;
        costUsd?: number | null;
      },
    ): Promise<Trace | null> => {
      const lines = stdout.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return null;

      // Parse all events first
      const events = lines
        .map(parseJsonLine)
        .filter((e): e is StreamJsonEvent => e !== null);
      if (events.length === 0) return null;

      // Extract model from init event
      let model = "";
      const initEvent = events.find((e) => e.type === "system" && e.subtype === "init");
      if (initEvent?.model) model = initEvent.model;

      // Create trace
      const trace = await svc.create(companyId, {
        agentId,
        heartbeatRunId,
        workflowInstanceId: opts?.workflowInstanceId,
        stageInstanceId: opts?.stageInstanceId,
        parentTraceId: opts?.parentTraceId,
        name: `run-${heartbeatRunId.slice(0, 8)}`,
      });

      // Track pending tool_use spans for matching with tool_result
      const pendingToolUses = new Map<string, string>(); // tool_use_id -> observation_id
      const observations: CreateObservation[] = [];

      for (const event of events) {
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "tool_use" && block.name && block.id) {
              // Tool use start -> span observation
              const obs = await svc.addObservation(companyId, trace.id, {
                type: "span",
                name: `tool:${block.name}`,
                status: "started",
                input: block.input ?? undefined,
                model: model || undefined,
                metadata: { toolUseId: block.id },
              });
              pendingToolUses.set(block.id, obs.id);
            } else if (block.type === "text" && block.text) {
              // Text block -> generation observation
              const truncated = block.text.length > 2000
                ? block.text.slice(0, 2000) + "...[truncated]"
                : block.text;
              await svc.addObservation(companyId, trace.id, {
                type: "generation",
                name: "response",
                status: "completed",
                output: { text: truncated },
                model: model || undefined,
              });
            }
          }
        }

        if (event.type === "tool_result" || (event.type === "user" && event.tool_use_id)) {
          // Tool result -> complete the pending span
          const toolUseId = event.tool_use_id ?? "";
          const obsId = pendingToolUses.get(toolUseId);
          if (obsId) {
            const isError = event.is_error === true;
            const output = event.content
              ? { result: typeof event.content === "string" && event.content.length > 2000
                  ? event.content.slice(0, 2000) + "...[truncated]"
                  : event.content }
              : undefined;
            await svc.completeObservation(companyId, trace.id, obsId, {
              status: isError ? "failed" : "completed",
              output,
              statusMessage: isError ? "Tool execution failed" : undefined,
            });
            pendingToolUses.delete(toolUseId);
          }
        }

        if (event.type === "result") {
          // Run result -> event observation with usage/cost
          const inputTokens = event.usage?.input_tokens ?? 0;
          const outputTokens = event.usage?.output_tokens ?? 0;
          const costUsd = opts?.costUsd ?? event.total_cost_usd ?? null;
          const estimatedCost = costUsd !== null && costUsd !== undefined
            ? String(costUsd)
            : estimateCost(model, inputTokens, outputTokens);

          await svc.addObservation(companyId, trace.id, {
            type: "event",
            name: "run-result",
            status: "completed",
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            costUsd: estimatedCost,
            model: model || undefined,
            metadata: {
              stopReason: event.stop_reason ?? null,
              totalCostUsd: costUsd,
            },
          });
        }
      }

      // Complete any remaining pending tool spans (incomplete due to timeout/kill)
      for (const [toolUseId, obsId] of pendingToolUses) {
        await svc.completeObservation(companyId, trace.id, obsId, {
          status: "failed",
          statusMessage: "Tool execution interrupted (run ended before completion)",
        });
      }

      // Determine final trace status based on result event
      const resultEvent = events.find((e) => e.type === "result");
      const traceStatus = resultEvent?.stop_reason === "end_turn" ? "completed" : "completed";

      // Complete trace with aggregated totals
      const completed = await svc.completeTrace(companyId, trace.id, { status: traceStatus });
      return completed;
    },
  };
}
