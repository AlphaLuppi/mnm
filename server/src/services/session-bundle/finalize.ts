/**
 * Orchestrateur du finalize d'un client run après réception du bundle de session.
 *
 * Appelé par governedWorkflows.completeStep (Task 7) APRÈS que la gate
 * `session-file-bundled` ait validé la présence du bundle dans
 * artifact.data.session_file. Décompresse, parse, et matérialise :
 *   - 1 trace (lié au heartbeat_run via heartbeatRunId)
 *   - N trace_observations (depuis parser)
 *   - heartbeat_run.status = succeeded + usage rollup + bundle_sha256
 *
 * Idempotent : si bundle_sha256 est déjà set au même hash, no-op.
 *
 * Best-effort : si le parsing échoue post-gate (corruption qui a slip),
 * marque le run failed avec error_code mais NE THROW PAS — le caller
 * (completeStep) doit pouvoir terminer le step sans annuler la gate
 * passée.
 */
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { parseClaudeCodeJsonl, type ParsedObservation } from "./parse-claude-code-jsonl.js";

const MAX_DECODED_BYTES = 100 * 1024 * 1024;

export type SessionFileInput =
  | string
  | { encoding: "raw" | "gzip-base64"; content: string };

export interface DecodedBundle {
  encoding: "raw" | "gzip-base64";
  content: string;
}

export function decodeBundle(input: SessionFileInput): DecodedBundle {
  if (input === null || input === undefined) {
    throw new Error("decodeBundle: session_file is null or undefined");
  }
  if (typeof input === "string") {
    return { encoding: "raw", content: input };
  }
  if (typeof input !== "object" || !("encoding" in input) || !("content" in input)) {
    throw new Error("decodeBundle: invalid session_file shape");
  }
  if (input.encoding === "raw") {
    return { encoding: "raw", content: input.content };
  }
  if (input.encoding === "gzip-base64") {
    const buf = Buffer.from(input.content, "base64");
    const inflated = gunzipSync(buf).toString("utf8");
    return { encoding: "gzip-base64", content: inflated };
  }
  throw new Error(`decodeBundle: unknown encoding '${(input as { encoding: string }).encoding}'`);
}

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ── Deps interface ──────────────────────────────────────────────────────────
//
// We don't import the real heartbeatService / traceService types here because
// finalizeClientRun lives below them in the dependency tree (heartbeat
// imports... lots) and we want this orchestrator unit-testable without DB.
// The deps shape is intentionally narrow.

export interface FinalizeDeps {
  getRun(id: string): Promise<{
    id: string;
    companyId: string;
    agentId: string;
    status: string;
    bundleSha256: string | null;
  } | null>;

  updateRun(
    id: string,
    patch: Partial<{
      status: string;
      finishedAt: Date;
      bundleFormat: string;
      bundleSha256: string;
      sessionIdAfter: string | null;
      usageJson: Record<string, unknown>;
      resultJson: Record<string, unknown>;
      error: string | null;
      errorCode: string | null;
    }>,
  ): Promise<void>;

  traceService: {
    create(
      companyId: string,
      input: {
        heartbeatRunId: string;
        agentId: string;
        name: string;
        metadata?: Record<string, unknown>;
        tags?: string[];
      },
    ): Promise<{ id: string }>;
    addObservation(
      companyId: string,
      traceId: string,
      input: {
        type: "span" | "generation" | "event";
        name: string;
        status?: string;
        input?: Record<string, unknown>;
        output?: Record<string, unknown>;
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        costUsd?: string;
        model?: string;
        metadata?: Record<string, unknown>;
      },
    ): Promise<{ id: string }>;
    completeTrace(
      companyId: string,
      traceId: string,
      input: { status: "completed" | "failed" },
    ): Promise<unknown>;
  };

  publishLiveEvent(event: {
    companyId: string;
    type: string;
    payload: Record<string, unknown>;
    visibility: { scope: string; agentIds?: string[] };
  }): void;
}

export interface FinalizeOpts {
  runId: string;
  sessionFile: SessionFileInput;
}

/**
 * Orchestrate the finalize. Catches all errors AFTER decode/sha and tags the
 * run as failed with an error_code rather than re-throwing. The caller
 * (completeStep) thus can NEVER fail because of bundle issues — the gate
 * already accepted the bundle, so the workflow step should commit.
 *
 * The only exception that DOES propagate is "run not found" (programmer error)
 * and any error before idempotence check (decode crashes), which the caller
 * should handle gracefully.
 */
export async function finalizeClientRun(deps: FinalizeDeps, opts: FinalizeOpts): Promise<void> {
  const run = await deps.getRun(opts.runId);
  if (!run) {
    throw new Error(`finalizeClientRun: heartbeat run ${opts.runId} not found`);
  }

  let decoded: DecodedBundle;
  try {
    decoded = decodeBundle(opts.sessionFile);
  } catch (err) {
    await deps.updateRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      error: err instanceof Error ? err.message : String(err),
      errorCode: "BUNDLE_DECODE_FAILED",
    });
    publishStatusEvent(deps, run, "failed", "BUNDLE_DECODE_FAILED");
    return;
  }

  // Cap on decoded size — the gate already capped on wire size, but a
  // small compressed bundle may decompress beyond 100MB. Fail-closed here.
  if (decoded.content.length > MAX_DECODED_BYTES) {
    await deps.updateRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      error: `Decoded bundle ${decoded.content.length} bytes exceeds ${MAX_DECODED_BYTES}`,
      errorCode: "BUNDLE_TOO_LARGE",
    });
    publishStatusEvent(deps, run, "failed", "BUNDLE_TOO_LARGE");
    return;
  }

  const bundleSha = sha256Hex(decoded.content);

  // Idempotence : already finalized with the same bundle → no-op.
  if (run.bundleSha256 === bundleSha) {
    return;
  }

  // Parse — catches malformed JSONL even after gate (gate only checks raw, not gzip).
  let parsed;
  try {
    parsed = parseClaudeCodeJsonl(decoded.content);
  } catch (err) {
    await deps.updateRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      error: err instanceof Error ? err.message : String(err),
      errorCode: "BUNDLE_PARSE_FAILED",
    });
    publishStatusEvent(deps, run, "failed", "BUNDLE_PARSE_FAILED");
    return;
  }

  // ── Best-effort persistence : a failure here should still try to mark
  //    the run as failed so the UI doesn't see a stuck 'running'. ────────
  try {
    const trace = await deps.traceService.create(run.companyId, {
      heartbeatRunId: run.id,
      agentId: run.agentId,
      name: parsed.trace.name,
      metadata: { ...parsed.trace.metadata, bundle_encoding: decoded.encoding },
    });

    for (const obs of parsed.observations) {
      await deps.traceService.addObservation(run.companyId, trace.id, mapObsToInput(obs));
    }

    await deps.traceService.completeTrace(run.companyId, trace.id, { status: "completed" });

    await deps.updateRun(run.id, {
      status: "succeeded",
      finishedAt: parsed.trace.completedAt,
      bundleFormat: parsed.trace.metadata.bundleFormat,
      bundleSha256: bundleSha,
      sessionIdAfter: parsed.trace.metadata.sessionId,
      usageJson: {
        totalTokensIn: parsed.trace.totalTokensIn,
        totalTokensOut: parsed.trace.totalTokensOut,
        modelsUsed: parsed.trace.metadata.modelsUsed,
        observationCount: parsed.observations.length,
        bundleEncoding: decoded.encoding,
        bundleBytes: decoded.content.length,
      },
      resultJson: {
        traceId: trace.id,
        firstUserMessage: parsed.trace.name,
        durationMs: parsed.trace.totalDurationMs,
      },
    });

    publishStatusEvent(deps, run, "succeeded", null, {
      traceId: trace.id,
      tokensIn: parsed.trace.totalTokensIn,
      tokensOut: parsed.trace.totalTokensOut,
    });
  } catch (err) {
    await deps.updateRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      error: err instanceof Error ? err.message : String(err),
      errorCode: "BUNDLE_PERSIST_FAILED",
    });
    publishStatusEvent(deps, run, "failed", "BUNDLE_PERSIST_FAILED");
  }
}

function mapObsToInput(obs: ParsedObservation) {
  return {
    type: obs.type,
    name: obs.name,
    status: obs.status,
    input: obs.input,
    output: obs.output,
    inputTokens: obs.inputTokens,
    outputTokens: obs.outputTokens,
    totalTokens: obs.totalTokens,
    costUsd: obs.costUsd,
    model: obs.model,
    metadata: {
      ...(obs.metadata ?? {}),
      ...(obs.externalId ? { externalId: obs.externalId } : {}),
      ...(obs.sourceEntryUuid ? { sourceEntryUuid: obs.sourceEntryUuid } : {}),
      ...(obs.startedAt ? { startedAt: obs.startedAt.toISOString() } : {}),
      ...(obs.completedAt ? { completedAt: obs.completedAt.toISOString() } : {}),
      ...(obs.durationMs !== undefined ? { durationMs: obs.durationMs } : {}),
    },
  };
}

function publishStatusEvent(
  deps: FinalizeDeps,
  run: { id: string; companyId: string; agentId: string },
  status: "succeeded" | "failed",
  errorCode: string | null,
  extra: Record<string, unknown> = {},
): void {
  deps.publishLiveEvent({
    companyId: run.companyId,
    type: "heartbeat.run.status",
    payload: {
      runId: run.id,
      agentId: run.agentId,
      status,
      executionMode: "client",
      finishedAt: new Date().toISOString(),
      errorCode,
      ...extra,
    },
    visibility: { scope: "agents", agentIds: [run.agentId] },
  });
}
