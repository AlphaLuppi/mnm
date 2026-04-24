/**
 * SSE chat endpoint for the Workflow Studio AI assistant (Tranche U14.1).
 *
 * Mount: /api/companies/:companyId/governed-workflows/:name/ai
 * Route: POST /chat
 *
 * Body (JSON):
 *   { messages: [{role:"user"|"assistant", content:string}], ref?: string }
 *
 * Response: `text/event-stream` with one `data: ${JSON.stringify(event)}\n\n`
 * frame per event from `streamWorkflowAiChat`. The stream terminates with a
 * `{type:"done"}` frame and then closes. On client disconnect we abort the
 * underlying Anthropic fetch via an AbortController.
 *
 * Rate limit: at most 3 concurrent requests per `{companyId, userId}` pair —
 * the AI call is expensive and users typing quickly should not be able to
 * fan-out indefinitely. Best-effort in-memory Map; no cluster coordination.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { ShaCache } from "@mnm/git-provider";
import { requirePermission } from "../middleware/require-permission.js";
import { apiError } from "./governed-workflows-ui.js";
import { createResolveGitProvider } from "../mcp/build-mcp-services.js";
import {
  streamWorkflowAiChat,
  defaultAnthropicStreaming,
  type AiAssistantDeps,
  type AiAssistantEvent,
  type AnthropicStreamingArgs,
} from "../services/workflow-ai-assistant.js";

// ── Body schema ─────────────────────────────────────────────────────────────

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(10_000),
      }),
    )
    .min(1)
    .max(50),
  ref: z.string().optional(),
});

// ── Rate limit (in-memory, per factory instance) ────────────────────────────

const MAX_CONCURRENT_PER_ACTOR = 3;

interface ConcurrencyCounter {
  acquire(key: string): boolean;
  release(key: string): void;
}

function createConcurrencyCounter(max: number): ConcurrencyCounter {
  const counts = new Map<string, number>();
  return {
    acquire(key) {
      const n = counts.get(key) ?? 0;
      if (n >= max) return false;
      counts.set(key, n + 1);
      return true;
    },
    release(key) {
      const n = counts.get(key) ?? 0;
      if (n <= 1) counts.delete(key);
      else counts.set(key, n - 1);
    },
  };
}

// ── Factory ─────────────────────────────────────────────────────────────────

export interface GovernedWorkflowsAiRoutesOptions {
  /** Override the LLM streaming client — primarily for integration tests. */
  anthropicStreaming?: AiAssistantDeps["anthropicStreaming"];
}

export function governedWorkflowsAiRoutes(
  db: Db,
  opts: GovernedWorkflowsAiRoutesOptions = {},
): Router {
  const router = Router({ mergeParams: true });
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  const deps: AiAssistantDeps = {
    resolveGitProvider,
    shaCache,
    anthropicStreaming: opts.anthropicStreaming ?? defaultAnthropicStreaming,
  };
  const concurrency = createConcurrencyCounter(MAX_CONCURRENT_PER_ACTOR);

  router.post(
    "/chat",
    requirePermission(db, PERMISSIONS.WORKFLOWS_CREATE),
    async (req: Request, res: Response) => {
      const companyId = req.params.companyId as string;
      const name = req.params.name as string;
      const userId =
        req.actor?.type === "board" ? req.actor.userId ?? null : null;

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(
          res,
          422,
          "AI_CHAT_VALIDATION",
          parsed.error.message,
          [
            "Send { messages: [{role, content}, ...], ref? } — 1..50 messages, content 1..10000 chars",
          ],
        );
      }

      const limitKey = `${companyId}:${userId ?? "anon"}`;
      if (!concurrency.acquire(limitKey)) {
        return apiError(
          res,
          429,
          "AI_RATE_LIMIT",
          "Too many concurrent AI assistant requests for this user",
          [
            `Wait for an in-flight chat to finish (limit: ${MAX_CONCURRENT_PER_ACTOR} per user per company)`,
          ],
        );
      }

      // SSE headers. `flushHeaders` sends them eagerly so the browser starts
      // rendering the stream immediately rather than buffering the whole body.
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      // Abort the generator (and, transitively, the Anthropic fetch) when the
      // client socket goes away. Note: on `req` we listen for `aborted` rather
      // than `close` — in Node 18+, `close` on IncomingMessage can fire once
      // the request body has been fully consumed even while the underlying
      // socket is still open, which would kill the stream before we ever
      // wrote a byte. `aborted` only fires on actual client disconnects.
      const abortController = new AbortController();
      const onClientAbort = () => abortController.abort();
      req.on("aborted", onClientAbort);
      res.on("close", onClientAbort);

      let sawDone = false;
      const writeEvent = (event: AiAssistantEvent) => {
        if (res.writableEnded) return;
        if (event.type === "done") sawDone = true;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        const generator = streamWorkflowAiChat(db, deps, {
          companyId,
          userId,
          workflowName: name,
          messages: parsed.data.messages,
          ref: parsed.data.ref,
        });

        for await (const event of generator) {
          if (abortController.signal.aborted) break;
          writeEvent(event);
        }
      } catch (err) {
        // Defensive: any unexpected throw still produces a terminal frame so
        // the client can close cleanly instead of hanging on an idle socket.
        const message = err instanceof Error ? err.message : String(err);
        writeEvent({
          type: "error",
          error_code: "AI_CHAT_UNEXPECTED",
          message,
        });
      } finally {
        if (!sawDone && !res.writableEnded) {
          writeEvent({ type: "done" });
        }
        req.removeListener("aborted", onClientAbort);
        res.removeListener("close", onClientAbort);
        concurrency.release(limitKey);
        if (!res.writableEnded) res.end();
      }
    },
  );

  return router;
}
