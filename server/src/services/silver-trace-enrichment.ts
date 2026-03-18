/**
 * Silver Trace Enrichment — PIPE-02
 *
 * Deterministic phase detection over bronze observations.
 * Groups consecutive observations into semantic phases (COMPREHENSION,
 * IMPLEMENTATION, VERIFICATION, ...) and writes a phases JSONB array
 * to the traces table.
 *
 * Pipeline position:
 *   Bronze (raw observations) → **Silver (phases / enrichment)** → Gold (lens analysis)
 */

import type { Db } from "@mnm/db";
import { traces, traceObservations } from "@mnm/db";
import type { TracePhase } from "@mnm/db";
import { eq, sql, asc, and, isNull } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

// ─── Phase Type Mapping ─────────────────────────────────────────────────────

type PhaseType = TracePhase["type"];

/** Bash commands that indicate verification (test/build/lint) */
const VERIFICATION_PATTERNS = [
  /\btest\b/i,
  /\bvitest\b/i,
  /\bjest\b/i,
  /\bbuild\b/i,
  /\blint\b/i,
  /\btsc\b/i,
  /\btypecheck\b/i,
  /\bplaywright\b/i,
  /\bcypress\b/i,
  /\beslint\b/i,
  /\bprettier\b/i,
];

function classifyObservation(name: string, input: Record<string, unknown> | null): PhaseType {
  // Tool-based observations: "tool:Read", "tool:Bash", etc.
  if (name.startsWith("tool:")) {
    const toolName = name.slice(5); // strip "tool:"

    // Comprehension tools
    if (["Read", "Grep", "Glob", "Explore"].includes(toolName)) {
      return "COMPREHENSION";
    }

    // Edit/Write tools
    if (["Edit", "Write"].includes(toolName)) {
      return "IMPLEMENTATION";
    }

    // Bash — check command content for verification vs implementation
    if (toolName === "Bash") {
      const command = extractBashCommand(input);
      if (command && VERIFICATION_PATTERNS.some((p) => p.test(command))) {
        return "VERIFICATION";
      }
      return "IMPLEMENTATION";
    }

    // Other tools default to IMPLEMENTATION
    return "IMPLEMENTATION";
  }

  // Non-tool observations
  switch (name) {
    case "response":
    case "thinking":
      return "COMMUNICATION";
    case "init":
      return "INITIALIZATION";
    case "run-result":
      return "RESULT";
    default:
      break;
  }

  // raw:user, raw:system, raw:assistant
  if (name.startsWith("raw:")) {
    return "COMMUNICATION";
  }

  return "UNKNOWN";
}

function extractBashCommand(input: Record<string, unknown> | null): string | null {
  if (!input) return null;
  // Bronze observations store tool input as { command: "...", ... }
  if (typeof input.command === "string") return input.command;
  // Some observations nest under different keys
  if (typeof input.content === "string") return input.content;
  return null;
}

// ─── Phase Detection ────────────────────────────────────────────────────────

/** Maximum gap (ms) between observations of the same type before forcing a new phase */
const MAX_SAME_TYPE_GAP_MS = 30_000; // 30 seconds

interface ObservationRow {
  id: string;
  name: string;
  startedAt: Date;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
}

interface PhaseBuilder {
  type: PhaseType;
  startIdx: number;
  endIdx: number;
  observations: ObservationRow[];
  lastTimestamp: Date;
}

function detectPhases(observations: ObservationRow[]): TracePhase[] {
  if (observations.length === 0) return [];

  const phases: TracePhase[] = [];
  let current: PhaseBuilder | null = null;

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i]!;
    const phaseType = classifyObservation(obs.name, obs.input);

    const gapMs = current
      ? obs.startedAt.getTime() - current.lastTimestamp.getTime()
      : 0;

    const shouldStartNewPhase =
      !current ||
      current.type !== phaseType ||
      gapMs > MAX_SAME_TYPE_GAP_MS;

    if (shouldStartNewPhase) {
      // Finalize current phase
      if (current) {
        phases.push(finalizePhase(current, phases.length));
      }
      // Start new phase
      current = {
        type: phaseType,
        startIdx: i,
        endIdx: i,
        observations: [obs],
        lastTimestamp: obs.startedAt,
      };
    } else {
      // Extend current phase (current is guaranteed non-null here: shouldStartNewPhase is true when !current)
      current!.endIdx = i;
      current!.observations.push(obs);
      current!.lastTimestamp = obs.startedAt;
    }
  }

  // Finalize last phase
  if (current) {
    phases.push(finalizePhase(current, phases.length));
  }

  return phases;
}

// ─── Phase Names & Summaries ────────────────────────────────────────────────

const PHASE_NAMES: Record<PhaseType, string> = {
  COMPREHENSION: "Code Comprehension",
  IMPLEMENTATION: "Implementation",
  VERIFICATION: "Verification",
  COMMUNICATION: "Communication",
  INITIALIZATION: "Initialization",
  RESULT: "Result",
  UNKNOWN: "Other",
};

function finalizePhase(builder: PhaseBuilder, order: number): TracePhase {
  return {
    order,
    type: builder.type,
    name: PHASE_NAMES[builder.type],
    startIdx: builder.startIdx,
    endIdx: builder.endIdx,
    observationCount: builder.observations.length,
    summary: generateSummary(builder),
  };
}

function generateSummary(builder: PhaseBuilder): string {
  const { type, observations } = builder;

  switch (type) {
    case "COMPREHENSION": {
      const fileNames = new Set<string>();
      for (const obs of observations) {
        const fp = extractFilePath(obs);
        if (fp) fileNames.add(fp);
      }
      const n = fileNames.size || observations.length;
      const topDirs = deriveTopDirs(fileNames);
      return `Read ${n} file${n !== 1 ? "s" : ""}${topDirs ? ` (${topDirs})` : ""}`;
    }

    case "IMPLEMENTATION": {
      const editFiles = new Set<string>();
      const bashCommands: string[] = [];
      for (const obs of observations) {
        if (obs.name === "tool:Edit" || obs.name === "tool:Write") {
          const fp = extractFilePath(obs);
          if (fp) editFiles.add(fp);
        } else if (obs.name === "tool:Bash") {
          const cmd = extractBashCommand(obs.input);
          if (cmd) bashCommands.push(cmd.slice(0, 60));
        }
      }
      if (editFiles.size > 0) {
        const n = editFiles.size;
        return n <= 3
          ? `Modified ${[...editFiles].map(shortPath).join(", ")}`
          : `Modified ${n} files`;
      }
      if (bashCommands.length > 0) {
        return `Ran ${bashCommands.length} command${bashCommands.length !== 1 ? "s" : ""}`;
      }
      return `${observations.length} implementation action${observations.length !== 1 ? "s" : ""}`;
    }

    case "VERIFICATION": {
      // Extract the first command to identify what was verified
      const cmd = observations[0] ? extractBashCommand(observations[0].input) : null;
      const shortCmd = cmd ? cmd.slice(0, 80) : "unknown";
      // Check if any observation has error status
      const hasError = observations.some(
        (o) => o.output && (o.output as Record<string, unknown>).is_error === true,
      );
      const result = hasError ? "failed" : "passed";
      return `Ran ${shortCmd}: ${result}`;
    }

    case "COMMUNICATION": {
      const n = observations.length;
      return `Agent response (${n} block${n !== 1 ? "s" : ""})`;
    }

    case "INITIALIZATION": {
      const initObs = observations[0];
      const model = initObs?.model ?? (initObs?.output as Record<string, unknown> | null)?.model;
      return model ? `Model: ${model}` : "Session initialized";
    }

    case "RESULT": {
      const resultObs = observations[0];
      const out = resultObs?.output as Record<string, unknown> | null;
      const inTok = out?.inputTokens ?? resultObs?.inputTokens;
      const outTok = out?.outputTokens ?? resultObs?.outputTokens;
      const cost = out?.costUsd ?? resultObs?.costUsd;
      const totalTok = (typeof inTok === "number" ? inTok : 0) + (typeof outTok === "number" ? outTok : 0);
      const costStr = cost != null ? `, $${Number(cost).toFixed(4)}` : "";
      return `Completed — ${totalTok}tok${costStr}`;
    }

    default:
      return `${observations.length} observation${observations.length !== 1 ? "s" : ""}`;
  }
}

function extractFilePath(obs: ObservationRow): string | null {
  const input = obs.input;
  if (!input) return null;
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.path === "string") return input.path;
  if (typeof input.pattern === "string") return input.pattern;
  return null;
}

function shortPath(fp: string): string {
  // Return just the filename or last two path segments
  const parts = fp.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return parts.join("/");
  return parts.slice(-2).join("/");
}

function deriveTopDirs(files: Set<string>): string {
  if (files.size === 0) return "";
  const dirs = new Set<string>();
  for (const fp of files) {
    const parts = fp.replace(/\\/g, "/").split("/").filter(Boolean);
    // Use the first meaningful directory segment (skip '.' or single char)
    const dir = parts.find((p) => p.length > 1 && p !== "." && p !== "..");
    if (dir) dirs.add(dir);
  }
  const top = [...dirs].slice(0, 3);
  return top.join(", ");
}

// ─── RLS-Aware DB Operations ────────────────────────────────────────────────

async function withTenantContext<T>(db: Db, companyId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
    return fn(tx as unknown as Db);
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run silver enrichment for a single trace.
 * Loads bronze observations, detects phases, stores in traces.phases JSONB.
 * Returns the detected phases.
 */
export async function enrichTrace(
  db: Db,
  traceId: string,
  companyId: string,
): Promise<TracePhase[]> {
  // 1. Load all bronze observations for this trace, ordered chronologically
  const observations = await withTenantContext(db, companyId, async (tx) => {
    return tx
      .select({
        id: traceObservations.id,
        name: traceObservations.name,
        startedAt: traceObservations.startedAt,
        input: traceObservations.input,
        output: traceObservations.output,
        model: traceObservations.model,
        inputTokens: traceObservations.inputTokens,
        outputTokens: traceObservations.outputTokens,
        costUsd: traceObservations.costUsd,
      })
      .from(traceObservations)
      .where(eq(traceObservations.traceId, traceId))
      .orderBy(asc(traceObservations.startedAt));
  });

  if (observations.length === 0) {
    return [];
  }

  // 2. Detect phases from chronological observations
  const phases = detectPhases(observations as ObservationRow[]);

  // 3. Store phases in traces.phases JSONB
  await withTenantContext(db, companyId, async (tx) => {
    await tx
      .update(traces)
      .set({ phases, updatedAt: new Date() })
      .where(and(eq(traces.id, traceId), eq(traces.companyId, companyId)));
  });

  logger.info(
    { traceId, phaseCount: phases.length, observationCount: observations.length },
    "Silver enrichment complete",
  );

  return phases;
}

/**
 * Backfill: run silver enrichment on all completed traces that have no phases yet.
 * Returns the count of traces enriched.
 */
export async function backfillSilverEnrichment(db: Db): Promise<number> {
  // NOTE: The DB user (mnm) is superuser, so FORCE RLS is bypassed.
  // We can query traces directly without setting RLS context.
  logger.info("Silver backfill: starting — finding traces without phases");

  const tracesToEnrich = await db
    .select({ id: traces.id, companyId: traces.companyId })
    .from(traces)
    .where(
      and(
        eq(traces.status, "completed"),
        isNull(traces.phases),
      ),
    );

  logger.info({ count: tracesToEnrich.length }, "Silver backfill: found traces to enrich");

  let enriched = 0;
  for (const trace of tracesToEnrich) {
    try {
      const phases = await enrichTrace(db, trace.id, trace.companyId);
      if (phases.length > 0) enriched++;
    } catch (err) {
      logger.warn({ err, traceId: trace.id }, "Silver backfill failed for trace");
    }
  }

  logger.info({ total: tracesToEnrich.length, enriched }, "Silver backfill complete");
  return enriched;
}

/**
 * Fire-and-forget silver enrichment for a single trace.
 * Safe to call from heartbeat — errors are logged, never thrown.
 */
export function silverEnrichAfterCapture(db: Db, traceId: string, companyId: string): void {
  enrichTrace(db, traceId, companyId).catch((err) => {
    logger.warn({ err, traceId }, "Silver enrichment failed (fire-and-forget)");
  });
}
