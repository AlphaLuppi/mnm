import { readFileSync } from "fs";
import { join } from "path";
import * as specRepo from "@/lib/db/repositories/specs";
import { getAnthropicAuthHeaders } from "@/lib/core/config";
import { getMnMRoot } from "@/lib/core/paths";
import { createChildLogger } from "@/lib/core/logger";
import { DriftError } from "@/lib/core/errors";
import { getComparablePairs } from "./hierarchy-model";
import { buildCrossDocComparisonPrompt } from "./cross-doc-prompts";

const log = createChildLogger({ module: "cross-doc-detector" });

export interface CrossDocDrift {
  sourceSpecId: string;
  targetSpecId: string;
  driftType: "terminology" | "approach" | "contradiction";
  severity: "minor" | "moderate" | "critical";
  description: string;
  sourceText: string;
  targetText: string;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Run cross-document drift detection on all comparable spec pairs.
 */
export async function detectCrossDocDrift(): Promise<CrossDocDrift[]> {
  const repoRoot = getMnMRoot();
  const authHeaders = getAnthropicAuthHeaders();

  if (!authHeaders) {
    log.warn("No API key configured, skipping cross-doc drift detection");
    return [];
  }

  const pairs = getComparablePairs();
  log.info({ pairCount: pairs.length }, "Starting cross-doc drift detection");

  const allDrifts: CrossDocDrift[] = [];

  for (const pair of pairs) {
    try {
      const drifts = await detectPairDrift(
        pair.upstream,
        pair.downstream,
        repoRoot,
        authHeaders
      );
      allDrifts.push(...drifts);
    } catch (err) {
      log.error(
        {
          upstream: pair.upstream.filePath,
          downstream: pair.downstream.filePath,
          error: err instanceof Error ? err.message : String(err),
        },
        "Failed to detect drift for spec pair"
      );
    }
  }

  log.info(
    { totalDrifts: allDrifts.length, pairsChecked: pairs.length },
    "Cross-doc drift detection completed"
  );

  return allDrifts;
}

/**
 * Detect drift between a single pair of specs.
 */
async function detectPairDrift(
  upstream: { specId: string; filePath: string; specType: string },
  downstream: { specId: string; filePath: string; specType: string },
  repoRoot: string,
  authHeaders: Record<string, string>
): Promise<CrossDocDrift[]> {
  // Load spec content from disk
  const upstreamSpec = specRepo.findById(upstream.specId);
  const downstreamSpec = specRepo.findById(downstream.specId);

  if (!upstreamSpec || !downstreamSpec) {
    log.warn(
      { upstream: upstream.specId, downstream: downstream.specId },
      "Spec not found in DB, skipping pair"
    );
    return [];
  }

  let upstreamContent: string;
  let downstreamContent: string;
  try {
    upstreamContent = readFileSync(join(repoRoot, upstream.filePath), "utf-8");
    downstreamContent = readFileSync(
      join(repoRoot, downstream.filePath),
      "utf-8"
    );
  } catch {
    log.warn(
      { upstream: upstream.filePath, downstream: downstream.filePath },
      "Failed to read spec files from disk"
    );
    return [];
  }

  // Truncate very long documents to fit in context
  const MAX_CHARS = 50000;
  const truncatedUpstream =
    upstreamContent.length > MAX_CHARS
      ? upstreamContent.slice(0, MAX_CHARS) + "\n...[truncated]"
      : upstreamContent;
  const truncatedDownstream =
    downstreamContent.length > MAX_CHARS
      ? downstreamContent.slice(0, MAX_CHARS) + "\n...[truncated]"
      : downstreamContent;

  const prompt = buildCrossDocComparisonPrompt(
    {
      title: upstreamSpec.title,
      content: truncatedUpstream,
      specType: upstream.specType,
    },
    {
      title: downstreamSpec.title,
      content: truncatedDownstream,
      specType: downstream.specType,
    }
  );

  const response = await callClaudeApi(prompt, authHeaders);
  const parsed = parseResponse(response);

  return parsed.map((d) => ({
    sourceSpecId: upstream.specId,
    targetSpecId: downstream.specId,
    driftType: d.drift_type,
    severity: d.severity,
    description: d.description,
    sourceText: d.upstream_text,
    targetText: d.downstream_text,
  }));
}

async function callClaudeApi(
  prompt: string,
  authHeaders: Record<string, string>
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 400 || status === 401) {
          const body = await response.text();
          throw DriftError.apiError(
            `Non-retryable error (${status}): ${body.slice(0, 200)}`
          );
        }
        if (RETRYABLE_STATUSES.has(status)) {
          lastError = new Error(`HTTP ${status}`);
          continue;
        }
        throw DriftError.apiError(`Unexpected HTTP ${status}`);
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof DriftError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw DriftError.apiError(
    `All ${MAX_RETRIES} retries exhausted: ${lastError?.message}`
  );
}

interface RawDriftItem {
  drift_type: "terminology" | "approach" | "contradiction";
  severity: "minor" | "moderate" | "critical";
  description: string;
  upstream_text: string;
  downstream_text: string;
}

function parseResponse(data: Record<string, unknown>): RawDriftItem[] {
  const content = data.content as Array<{ type: string; text: string }>;
  if (!content?.[0] || content[0].type !== "text") {
    throw DriftError.invalidResponse("No text content in cross-doc response");
  }

  let text = content[0].text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: { drifts: RawDriftItem[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw DriftError.invalidResponse(
      `Failed to parse cross-doc JSON: ${text.slice(0, 200)}`
    );
  }

  if (!Array.isArray(parsed.drifts)) {
    return [];
  }

  // Validate each drift item
  return parsed.drifts.filter(
    (d) =>
      isValidDriftType(d.drift_type) &&
      isValidSeverity(d.severity) &&
      typeof d.description === "string"
  );
}

function isValidDriftType(
  v: unknown
): v is "terminology" | "approach" | "contradiction" {
  return v === "terminology" || v === "approach" || v === "contradiction";
}

function isValidSeverity(v: unknown): v is "minor" | "moderate" | "critical" {
  return v === "minor" || v === "moderate" || v === "critical";
}
