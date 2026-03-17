import type { Db } from "@mnm/db";
import type { TraceObservation, TraceObservationNode, TraceLensResult } from "@mnm/shared";
import { traceService } from "./trace-service.js";

const SYSTEM_PROMPT = `Tu es un analyste de traces d'agent IA dans MnM.
Tu recois les actions factuelles d'un agent (tool calls, resultats, couts).
L'utilisateur a defini ce qu'il veut comprendre (ci-dessous).
Analyse les actions et reponds de maniere specifique : cite les fichiers,
les chiffres, les resultats. Sois concis et actionable.
Reponds en markdown structure.`;

const MAX_OBSERVATIONS_FOR_LLM = 200;

interface AnalysisResult {
  resultMarkdown: string;
  resultStructured: Record<string, unknown>;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
}

function flattenTree(nodes: TraceObservationNode[]): TraceObservation[] {
  const flat: TraceObservation[] = [];
  function walk(node: TraceObservationNode) {
    const { children: _, ...obs } = node;
    flat.push(obs);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const node of nodes) walk(node);
  return flat;
}

function formatObservationForContext(obs: TraceObservation, index: number): string {
  const status = obs.status === "failed" ? " (FAILED)" : obs.status === "completed" ? "" : ` (${obs.status})`;
  const duration = obs.durationMs ? ` ${obs.durationMs}ms` : "";
  const tokens = obs.totalTokens ? ` ${obs.totalTokens}tok` : "";
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
    const metaPreview = obs.metadata ? summarizeJsonb(obs.metadata, 150) : "";
    if (metaPreview) details += `: ${metaPreview}`;
  }

  if (obs.statusMessage) {
    details += ` [${obs.statusMessage}]`;
  }

  return `  ${index + 1}. [${obs.type}:${obs.name}]${status}${duration}${tokens}${cost}${details}`;
}

function summarizeJsonb(data: Record<string, unknown>, maxLen: number): string {
  const str = JSON.stringify(data);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 15) + "...[truncated]";
}

function preFilterObservations(observations: TraceObservation[]): TraceObservation[] {
  if (observations.length <= MAX_OBSERVATIONS_FOR_LLM) return observations;

  // Keep all errors in full
  const errors = observations.filter((o) => o.status === "failed");
  const nonErrors = observations.filter((o) => o.status !== "failed");

  // Group consecutive same-type tool calls and keep representative samples
  const sampled: TraceObservation[] = [];
  let prevName = "";
  let consecutiveCount = 0;

  for (const obs of nonErrors) {
    if (obs.name === prevName) {
      consecutiveCount++;
      // Keep every 3rd consecutive same-name observation
      if (consecutiveCount % 3 === 0) {
        sampled.push(obs);
      }
    } else {
      sampled.push(obs);
      prevName = obs.name;
      consecutiveCount = 0;
    }
  }

  const result = [...errors, ...sampled].slice(0, MAX_OBSERVATIONS_FOR_LLM);
  result.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  return result;
}

function buildTraceContext(
  traceName: string,
  agentId: string,
  duration: number | null,
  cost: string,
  tokensIn: number,
  tokensOut: number,
  observations: TraceObservation[],
): string {
  const filtered = preFilterObservations(observations);
  const obsLines = filtered.map((obs, i) => formatObservationForContext(obs, i));
  const totalObs = observations.length;
  const filteredCount = filtered.length;
  const truncatedNote = totalObs > filteredCount
    ? `\n  (${totalObs - filteredCount} observations omitted for brevity)`
    : "";

  return `TRACE DATA:
- Agent: ${agentId}, Run: ${traceName}
- Duree: ${duration ? `${Math.round(duration / 1000)}s` : "en cours"}, Cout: $${cost}, Tokens: ${tokensIn} in / ${tokensOut} out
- Observations (${totalObs}):
${obsLines.join("\n")}${truncatedNote}`;
}

function estimateCost(observationCount: number): { estimatedCostUsd: string; estimatedTokens: number } {
  // Rough estimate: ~50 tokens per observation for context + ~200 for system prompt + ~500 for output
  const inputTokens = 200 + observationCount * 50;
  const outputTokens = 500;
  // Haiku pricing: ~$0.25/1M input, ~$1.25/1M output
  const costUsd = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  return {
    estimatedCostUsd: costUsd.toFixed(4),
    estimatedTokens: inputTokens + outputTokens,
  };
}

async function callLlm(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number; model: string } | null> {
  const llmEndpoint = process.env.MNM_LLM_SUMMARY_ENDPOINT;
  const llmApiKey = process.env.MNM_LLM_SUMMARY_API_KEY;
  const model = process.env.MNM_LLM_LENS_MODEL ?? process.env.MNM_LLM_SUMMARY_MODEL ?? "claude-3-haiku-20240307";

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.warn(`[lens-analysis] LLM call failed with status ${response.status}`);
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
    console.warn("[lens-analysis] LLM call error:", err);
    return null;
  }
}

function buildFallbackAnalysis(
  lensPrompt: string,
  traceName: string,
  observations: TraceObservation[],
): string {
  const toolCalls = observations.filter((o) => o.type === "span");
  const generations = observations.filter((o) => o.type === "generation");
  const events = observations.filter((o) => o.type === "event");
  const errors = observations.filter((o) => o.status === "failed");

  const uniqueTools = [...new Set(toolCalls.map((o) => o.name))];
  const uniqueFiles = [...new Set(
    toolCalls
      .filter((o) => o.input && typeof (o.input as Record<string, unknown>).file_path === "string")
      .map((o) => (o.input as Record<string, unknown>).file_path as string),
  )];

  let md = `# Analyse factuelle — ${traceName}\n\n`;
  md += `> Prompt d'analyse : "${lensPrompt.slice(0, 200)}"\n\n`;
  md += `**Note** : Analyse LLM non disponible. Voici un resume factuel.\n\n`;
  md += `## Resume\n`;
  md += `- **${observations.length}** observations totales\n`;
  md += `- **${toolCalls.length}** appels d'outils (${uniqueTools.join(", ")})\n`;
  md += `- **${generations.length}** generations\n`;
  md += `- **${events.length}** evenements\n`;
  if (errors.length > 0) {
    md += `- **${errors.length}** erreurs\n`;
  }

  if (uniqueFiles.length > 0) {
    md += `\n## Fichiers touches\n`;
    for (const f of uniqueFiles.slice(0, 20)) {
      md += `- \`${f}\`\n`;
    }
    if (uniqueFiles.length > 20) {
      md += `- ... et ${uniqueFiles.length - 20} autres\n`;
    }
  }

  if (errors.length > 0) {
    md += `\n## Erreurs\n`;
    for (const err of errors.slice(0, 10)) {
      md += `- **${err.name}**: ${err.statusMessage ?? "Echec"}\n`;
    }
  }

  return md;
}

export function lensAnalysisService(db: Db) {
  const svc = traceService(db);

  return {
    estimateCost: (observationCount: number) => estimateCost(observationCount),

    analyze: async (
      companyId: string,
      userId: string,
      traceId: string,
      lensId: string,
    ): Promise<TraceLensResult> => {
      // Check for cached result
      const cached = await svc.getLensResult(companyId, lensId, traceId);
      if (cached) {
        // Check if trace has been updated since cached result
        const trace = await svc.getById(companyId, traceId);
        if (trace.status !== "running") {
          return cached;
        }
        // Running trace — re-analyze
      }

      // Load trace + observations
      const traceWithTree = await svc.getTree(companyId, traceId);
      const allObs = flattenTree(traceWithTree.observations);

      // Load lens
      const lens = await svc.getLens(companyId, lensId);

      // Build context
      const traceContext = buildTraceContext(
        traceWithTree.name,
        traceWithTree.agentId,
        traceWithTree.totalDurationMs,
        traceWithTree.totalCostUsd,
        traceWithTree.totalTokensIn,
        traceWithTree.totalTokensOut,
        allObs,
      );

      const userMessage = `USER LENS: ${lens.prompt}\n\n${traceContext}`;

      // Try LLM
      const llmResult = await callLlm(SYSTEM_PROMPT, userMessage);

      let result: AnalysisResult;

      if (llmResult) {
        result = {
          resultMarkdown: llmResult.text,
          resultStructured: {
            source: "llm",
            observationCount: allObs.length,
            traceStatus: traceWithTree.status,
          },
          modelUsed: llmResult.model,
          inputTokens: llmResult.inputTokens,
          outputTokens: llmResult.outputTokens,
          costUsd: ((llmResult.inputTokens * 0.25 + llmResult.outputTokens * 1.25) / 1_000_000).toFixed(6),
        };
      } else {
        // Fallback to factual summary
        const fallbackMd = buildFallbackAnalysis(lens.prompt, traceWithTree.name, allObs);
        result = {
          resultMarkdown: fallbackMd,
          resultStructured: {
            source: "fallback",
            observationCount: allObs.length,
            traceStatus: traceWithTree.status,
          },
          modelUsed: "fallback",
          inputTokens: 0,
          outputTokens: 0,
          costUsd: "0",
        };
      }

      // Persist result
      const saved = await svc.saveLensResult(companyId, userId, {
        lensId,
        traceId,
        resultMarkdown: result.resultMarkdown,
        resultStructured: result.resultStructured,
        modelUsed: result.modelUsed,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      });

      return saved;
    },
  };
}
