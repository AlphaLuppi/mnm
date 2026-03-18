/**
 * Gold Trace Enrichment — PIPE-04
 *
 * LLM-powered (or deterministic fallback) analysis of silver phases + bronze
 * observations. Produces a structured verdict (TraceGold) stored in traces.gold.
 *
 * Pipeline position:
 *   Bronze (raw observations) → Silver (phases / enrichment) → **Gold (LLM analysis)**
 *
 * Prompt layering:
 *   global prompt  → workflow prompt → agent prompt → issue context
 *
 * When MNM_LLM_SUMMARY_ENDPOINT is not configured, a deterministic fallback
 * generates a neutral gold with each phase scored at 50.
 */

import type { Db } from "@mnm/db";
import {
  traces,
  traceObservations,
  goldPrompts,
  workflowInstances,
  workflowTemplates,
  issues,
  stageInstances,
} from "@mnm/db";
import type { TraceGold, TraceGoldPhase, TracePhase } from "@mnm/db";
import { eq, sql, and, asc, isNull, isNotNull } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_OBSERVATIONS_FOR_GOLD = 200;

const GOLD_SYSTEM_PROMPT = `Tu es un analyste de traces d'agent IA dans MnM.
Tu reçois les phases d'exécution d'un agent (silver) et le détail de ses actions (bronze).

Pour chaque phase, produis:
- relevanceScore (0-100): pertinence par rapport à l'objectif
- annotation: ce qui s'est passé et pourquoi c'est important
- verdict: success | partial | failure | neutral
- keyObservationIds: les IDs des observations les plus importantes

Produis aussi:
- verdict global: success | partial | failure
- verdictReason: explication du verdict en 1-2 phrases
- highlights: les 3-5 observations les plus importantes (IDs)

Si une issue est liée, évalue chaque critère d'acceptation:
- status: met | partial | not_met | unknown
- evidence: quelle observation prouve ce statut

Réponds UNIQUEMENT en JSON valide suivant ce schema:
{
  "phases": [{"phaseOrder": 0, "relevanceScore": 85, "annotation": "...", "verdict": "success", "keyObservationIds": ["..."]}],
  "verdict": "success",
  "verdictReason": "...",
  "highlights": ["obs-id-1", "obs-id-2"],
  "issueAcStatus": [{"acId": "1", "label": "...", "status": "met", "evidence": "..."}]
}`;

// ─── RLS-Aware DB Operations ────────────────────────────────────────────────

async function withTenantContext<T>(db: Db, companyId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
    return fn(tx as unknown as Db);
  });
}

// ─── Observation Helpers ────────────────────────────────────────────────────

interface ObservationRow {
  id: string;
  name: string;
  type: string;
  status: string;
  startedAt: Date;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: string | null;
  durationMs: number | null;
  statusMessage: string | null;
}

function preFilterObservations(observations: ObservationRow[]): ObservationRow[] {
  if (observations.length <= MAX_OBSERVATIONS_FOR_GOLD) return observations;

  // Keep all errors in full
  const errors = observations.filter((o) => o.status === "failed" || o.status === "error");
  const nonErrors = observations.filter((o) => o.status !== "failed" && o.status !== "error");

  // Sample consecutive same-name observations
  const sampled: ObservationRow[] = [];
  let prevName = "";
  let consecutiveCount = 0;

  for (const obs of nonErrors) {
    if (obs.name === prevName) {
      consecutiveCount++;
      if (consecutiveCount % 3 === 0) {
        sampled.push(obs);
      }
    } else {
      sampled.push(obs);
      prevName = obs.name;
      consecutiveCount = 0;
    }
  }

  const result = [...errors, ...sampled].slice(0, MAX_OBSERVATIONS_FOR_GOLD);
  result.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return result;
}

function summarizeJsonb(data: Record<string, unknown>, maxLen: number): string {
  const str = JSON.stringify(data);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 15) + "...[truncated]";
}

function formatObservationForContext(obs: ObservationRow, index: number): string {
  const statusTag = obs.status === "failed" || obs.status === "error"
    ? " (FAILED)"
    : obs.status === "completed" ? "" : ` (${obs.status})`;
  const duration = obs.durationMs ? ` ${obs.durationMs}ms` : "";
  const tokens = (obs.inputTokens || obs.outputTokens)
    ? ` ${(obs.inputTokens ?? 0) + (obs.outputTokens ?? 0)}tok`
    : "";
  const cost = obs.costUsd ? ` $${obs.costUsd}` : "";

  let details = "";
  if (obs.type === "span") {
    const inputPreview = obs.input ? summarizeJsonb(obs.input, 120) : "";
    const outputPreview = obs.output ? summarizeJsonb(obs.output, 120) : "";
    if (inputPreview) details += ` → ${inputPreview}`;
    if (outputPreview) details += ` ← ${outputPreview}`;
  } else if (obs.type === "generation") {
    const outputPreview = obs.output ? summarizeJsonb(obs.output, 200) : "";
    if (outputPreview) details += `: ${outputPreview}`;
  } else if (obs.type === "event") {
    const metaPreview = obs.output ? summarizeJsonb(obs.output, 150) : "";
    if (metaPreview) details += `: ${metaPreview}`;
  }

  if (obs.statusMessage) {
    details += ` [${obs.statusMessage}]`;
  }

  return `  ${index + 1}. [${obs.id}] [${obs.type}:${obs.name}]${statusTag}${duration}${tokens}${cost}${details}`;
}

// ─── LLM Call (reused pattern from lens-analysis.ts) ────────────────────────

async function callLlm(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number; model: string } | null> {
  const llmEndpoint = process.env.MNM_LLM_SUMMARY_ENDPOINT;
  const llmApiKey = process.env.MNM_LLM_SUMMARY_API_KEY;
  const model = process.env.MNM_LLM_GOLD_MODEL ?? process.env.MNM_LLM_SUMMARY_MODEL ?? "claude-3-haiku-20240307";

  if (!llmEndpoint || !llmApiKey) {
    return null;
  }

  try {
    const response = await fetch(llmEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${llmApiKey}`,
        "x-api-key": llmApiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "[gold-enrichment] LLM call failed");
      return null;
    }

    const data = await response.json() as {
      content?: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const text = data?.content?.[0]?.text;
    if (!text) return null;

    return {
      text,
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0,
      model,
    };
  } catch (err) {
    logger.warn({ err }, "[gold-enrichment] LLM call error");
    return null;
  }
}

// ─── Prompt Composition ─────────────────────────────────────────────────────

interface PromptSources {
  global?: string;
  workflow?: string;
  agent?: string;
  issue?: { id: string; title: string };
  custom?: string;
}

async function composeGoldPrompt(
  db: Db,
  companyId: string,
  traceRow: {
    agentId: string;
    workflowInstanceId: string | null;
    stageInstanceId: string | null;
    heartbeatRunId: string | null;
  },
): Promise<{ composedPrompt: string; sources: PromptSources }> {
  const sources: PromptSources = {};
  const promptParts: string[] = [];

  // 1. Global prompt
  const globalRows = await db
    .select({ prompt: goldPrompts.prompt })
    .from(goldPrompts)
    .where(
      and(
        eq(goldPrompts.companyId, companyId),
        eq(goldPrompts.scope, "global"),
        eq(goldPrompts.isActive, true),
      ),
    )
    .limit(1);

  if (globalRows[0]) {
    sources.global = globalRows[0].prompt;
    promptParts.push(`[GLOBAL]\n${globalRows[0].prompt}`);
  }

  // 2. Workflow prompt (if trace has workflowInstanceId)
  if (traceRow.workflowInstanceId) {
    const wiRows = await db
      .select({ templateId: workflowInstances.templateId })
      .from(workflowInstances)
      .where(eq(workflowInstances.id, traceRow.workflowInstanceId))
      .limit(1);

    if (wiRows[0]) {
      const wfPromptRows = await db
        .select({ prompt: goldPrompts.prompt })
        .from(goldPrompts)
        .where(
          and(
            eq(goldPrompts.companyId, companyId),
            eq(goldPrompts.scope, "workflow"),
            eq(goldPrompts.scopeId, wiRows[0].templateId),
            eq(goldPrompts.isActive, true),
          ),
        )
        .limit(1);

      if (wfPromptRows[0]) {
        sources.workflow = wfPromptRows[0].prompt;
        promptParts.push(`[WORKFLOW]\n${wfPromptRows[0].prompt}`);
      }
    }
  }

  // 3. Agent prompt
  const agentPromptRows = await db
    .select({ prompt: goldPrompts.prompt })
    .from(goldPrompts)
    .where(
      and(
        eq(goldPrompts.companyId, companyId),
        eq(goldPrompts.scope, "agent"),
        eq(goldPrompts.scopeId, traceRow.agentId),
        eq(goldPrompts.isActive, true),
      ),
    )
    .limit(1);

  if (agentPromptRows[0]) {
    sources.agent = agentPromptRows[0].prompt;
    promptParts.push(`[AGENT]\n${agentPromptRows[0].prompt}`);
  }

  // 4. Issue context (if the heartbeat run is linked to an issue)
  if (traceRow.heartbeatRunId) {
    const issueRows = await db
      .select({
        id: issues.id,
        title: issues.title,
        description: issues.description,
      })
      .from(issues)
      .where(eq(issues.executionRunId, traceRow.heartbeatRunId))
      .limit(1);

    if (issueRows[0]) {
      sources.issue = { id: issueRows[0].id, title: issueRows[0].title };

      let issueContext = `[ISSUE]\nTitre: ${issueRows[0].title}`;
      if (issueRows[0].description) {
        issueContext += `\nDescription: ${issueRows[0].description.slice(0, 500)}`;
      }

      // Load acceptance criteria from linked stage instance
      if (traceRow.stageInstanceId) {
        const stageRows = await db
          .select({ acceptanceCriteria: stageInstances.acceptanceCriteria })
          .from(stageInstances)
          .where(eq(stageInstances.id, traceRow.stageInstanceId))
          .limit(1);

        const ac = stageRows[0]?.acceptanceCriteria;
        if (ac && ac.length > 0) {
          issueContext += `\nCritères d'acceptation:\n${ac.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}`;
        }
      }

      promptParts.push(issueContext);
    }
  }

  const composedPrompt = promptParts.length > 0
    ? promptParts.join("\n\n")
    : "Analyse globale de l'exécution de l'agent.";

  return { composedPrompt, sources };
}

// ─── Build LLM Context ─────────────────────────────────────────────────────

function buildGoldContext(
  traceName: string,
  traceStatus: string,
  phases: TracePhase[],
  observations: ObservationRow[],
): string {
  const filtered = preFilterObservations(observations);
  const obsLines = filtered.map((obs, i) => formatObservationForContext(obs, i));
  const totalObs = observations.length;
  const filteredCount = filtered.length;
  const truncatedNote = totalObs > filteredCount
    ? `\n  (${totalObs - filteredCount} observations omises pour concision)`
    : "";

  const phaseLines = phases.map((p) =>
    `  Phase ${p.order}: [${p.type}] ${p.name} — ${p.observationCount} obs — ${p.summary}`,
  );

  return `TRACE: ${traceName}
Status: ${traceStatus}

SILVER PHASES (${phases.length}):
${phaseLines.join("\n")}

BRONZE OBSERVATIONS (${totalObs}):
${obsLines.join("\n")}${truncatedNote}`;
}

// ─── Parse LLM Response ─────────────────────────────────────────────────────

interface LlmGoldResponse {
  phases: Array<{
    phaseOrder: number;
    relevanceScore: number;
    annotation: string;
    verdict: string;
    keyObservationIds: string[];
  }>;
  verdict: string;
  verdictReason: string;
  highlights: string[];
  issueAcStatus?: Array<{
    acId: string;
    label: string;
    status: string;
    evidence?: string;
  }>;
}

function parseGoldResponse(text: string, silverPhases: TracePhase[]): LlmGoldResponse | null {
  try {
    // Extract JSON from response (in case LLM wraps it in markdown)
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1]!.trim();
    }

    const parsed = JSON.parse(jsonStr) as LlmGoldResponse;

    // Basic validation
    if (!parsed.verdict || !parsed.verdictReason || !Array.isArray(parsed.phases)) {
      logger.warn("[gold-enrichment] Invalid LLM response structure");
      return null;
    }

    // Clamp relevance scores
    for (const phase of parsed.phases) {
      phase.relevanceScore = Math.max(0, Math.min(100, phase.relevanceScore));
    }

    // Ensure we have entries for all silver phases (LLM might skip some)
    const covered = new Set(parsed.phases.map((p) => p.phaseOrder));
    for (const sp of silverPhases) {
      if (!covered.has(sp.order)) {
        parsed.phases.push({
          phaseOrder: sp.order,
          relevanceScore: 50,
          annotation: sp.summary,
          verdict: "neutral",
          keyObservationIds: [],
        });
      }
    }
    parsed.phases.sort((a, b) => a.phaseOrder - b.phaseOrder);

    return parsed;
  } catch (err) {
    logger.warn({ err }, "[gold-enrichment] Failed to parse LLM JSON response");
    return null;
  }
}

// ─── Deterministic Fallback ─────────────────────────────────────────────────

function buildDeterministicGold(
  silverPhases: TracePhase[],
  traceStatus: string,
  composedPrompt: string,
  promptSources: PromptSources,
): TraceGold {
  const phases: TraceGoldPhase[] = silverPhases.map((sp) => ({
    phaseOrder: sp.order,
    relevanceScore: 50,
    annotation: sp.summary,
    verdict: "neutral" as const,
    keyObservationIds: [],
  }));

  const verdict: TraceGold["verdict"] =
    traceStatus === "completed" ? "success" :
    traceStatus === "failed" ? "failure" :
    "partial";

  const verdictReason =
    traceStatus === "completed"
      ? `Trace terminée avec ${silverPhases.length} phases détectées (analyse déterministe, LLM non configuré).`
      : traceStatus === "failed"
        ? `Trace échouée — ${silverPhases.length} phases détectées (analyse déterministe, LLM non configuré).`
        : `Trace en status ${traceStatus} — ${silverPhases.length} phases (analyse déterministe).`;

  return {
    generatedAt: new Date().toISOString(),
    modelUsed: "deterministic-fallback",
    prompt: composedPrompt,
    promptSources,
    phases,
    verdict,
    verdictReason,
    highlights: [],
    // No issueAcStatus without LLM
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function goldTraceEnrichment(db: Db) {
  return {
    /**
     * Enrich a single trace with gold analysis.
     * Loads silver phases + bronze observations, composes a layered prompt,
     * calls LLM (or fallback), and stores the result in traces.gold.
     */
    enrichTraceGold: async (traceId: string, companyId: string): Promise<TraceGold> => {
      // 1. Load the trace with silver phases
      const traceRows = await withTenantContext(db, companyId, async (tx) => {
        return tx
          .select({
            id: traces.id,
            name: traces.name,
            status: traces.status,
            agentId: traces.agentId,
            workflowInstanceId: traces.workflowInstanceId,
            stageInstanceId: traces.stageInstanceId,
            heartbeatRunId: traces.heartbeatRunId,
            phases: traces.phases,
            gold: traces.gold,
          })
          .from(traces)
          .where(and(eq(traces.id, traceId), eq(traces.companyId, companyId)))
          .limit(1);
      });

      const traceRow = traceRows[0];
      if (!traceRow) {
        throw new Error(`Trace ${traceId} not found for company ${companyId}`);
      }

      // Skip if already has gold
      if (traceRow.gold) {
        logger.debug({ traceId }, "[gold-enrichment] Trace already has gold, skipping");
        return traceRow.gold;
      }

      const silverPhases: TracePhase[] = traceRow.phases ?? [];

      // 2. Load bronze observations for context
      const observations = await withTenantContext(db, companyId, async (tx) => {
        return tx
          .select({
            id: traceObservations.id,
            name: traceObservations.name,
            type: traceObservations.type,
            status: traceObservations.status,
            startedAt: traceObservations.startedAt,
            input: traceObservations.input,
            output: traceObservations.output,
            inputTokens: traceObservations.inputTokens,
            outputTokens: traceObservations.outputTokens,
            costUsd: traceObservations.costUsd,
            durationMs: traceObservations.durationMs,
            statusMessage: traceObservations.statusMessage,
          })
          .from(traceObservations)
          .where(eq(traceObservations.traceId, traceId))
          .orderBy(asc(traceObservations.startedAt));
      });

      // 3. Compose layered gold prompt
      const { composedPrompt, sources } = await withTenantContext(db, companyId, async (tx) => {
        return composeGoldPrompt(tx, companyId, {
          agentId: traceRow.agentId,
          workflowInstanceId: traceRow.workflowInstanceId,
          stageInstanceId: traceRow.stageInstanceId,
          heartbeatRunId: traceRow.heartbeatRunId,
        });
      });

      // 4. Build LLM context
      const context = buildGoldContext(
        traceRow.name,
        traceRow.status,
        silverPhases,
        observations as ObservationRow[],
      );

      const userMessage = `${composedPrompt}\n\n${context}`;

      // 5. Call LLM or fallback
      const llmResult = await callLlm(GOLD_SYSTEM_PROMPT, userMessage);
      let gold: TraceGold;

      if (llmResult) {
        const parsed = parseGoldResponse(llmResult.text, silverPhases);

        if (parsed) {
          gold = {
            generatedAt: new Date().toISOString(),
            modelUsed: llmResult.model,
            prompt: composedPrompt,
            promptSources: sources,
            phases: parsed.phases.map((p) => ({
              phaseOrder: p.phaseOrder,
              relevanceScore: p.relevanceScore,
              annotation: p.annotation,
              verdict: p.verdict as TraceGoldPhase["verdict"],
              keyObservationIds: p.keyObservationIds,
            })),
            verdict: parsed.verdict as TraceGold["verdict"],
            verdictReason: parsed.verdictReason,
            highlights: parsed.highlights,
            issueAcStatus: parsed.issueAcStatus?.map((ac) => ({
              acId: ac.acId,
              label: ac.label,
              status: ac.status as "met" | "partial" | "not_met" | "unknown",
              evidence: ac.evidence,
            })),
          };
        } else {
          // LLM responded but JSON was invalid — fall back to deterministic
          logger.warn({ traceId }, "[gold-enrichment] LLM response unparseable, using deterministic fallback");
          gold = buildDeterministicGold(silverPhases, traceRow.status, composedPrompt, sources);
        }
      } else {
        // No LLM configured or call failed
        gold = buildDeterministicGold(silverPhases, traceRow.status, composedPrompt, sources);
      }

      // 6. Store in traces.gold
      await withTenantContext(db, companyId, async (tx) => {
        await tx
          .update(traces)
          .set({ gold, updatedAt: new Date() })
          .where(and(eq(traces.id, traceId), eq(traces.companyId, companyId)));
      });

      logger.info(
        {
          traceId,
          model: gold.modelUsed,
          verdict: gold.verdict,
          phaseCount: gold.phases.length,
        },
        "Gold enrichment complete",
      );

      return gold;
    },

    /**
     * Backfill: enrich all completed traces that have silver phases but no gold.
     * Returns the count of traces enriched.
     */
    backfillGoldEnrichment: async (): Promise<number> => {
      logger.info("Gold backfill: starting — finding traces with silver but no gold");

      const tracesToEnrich = await db
        .select({ id: traces.id, companyId: traces.companyId })
        .from(traces)
        .where(
          and(
            eq(traces.status, "completed"),
            isNotNull(traces.phases),
            isNull(traces.gold),
          ),
        );

      logger.info({ count: tracesToEnrich.length }, "Gold backfill: found traces to enrich");

      let enriched = 0;
      for (const trace of tracesToEnrich) {
        try {
          await goldTraceEnrichment(db).enrichTraceGold(trace.id, trace.companyId);
          enriched++;
        } catch (err) {
          logger.warn({ err, traceId: trace.id }, "Gold backfill failed for trace");
        }
      }

      logger.info({ total: tracesToEnrich.length, enriched }, "Gold backfill complete");
      return enriched;
    },
  };
}
