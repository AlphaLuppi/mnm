import { DriftError } from "@/lib/core/errors";
import { getAnthropicAuthHeaders } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";
import { buildDriftPrompt } from "./prompts";

const log = createChildLogger({ module: "drift-analyzer" });

export interface DriftResult {
  severity: "minor" | "moderate" | "critical";
  driftType: "scope_expansion" | "approach_change" | "design_deviation";
  summary: string;
  recommendation: "update_spec" | "recenter_code";
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function analyzeDrift(
  spec: { title: string | null; content: string },
  diff: string,
  customInstructions?: string | null
): Promise<DriftResult> {
  const authHeaders = getAnthropicAuthHeaders();
  if (!authHeaders) {
    throw DriftError.apiError("ANTHROPIC_API_KEY not configured");
  }

  const prompt = buildDriftPrompt(spec, diff, customInstructions);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    const startTime = Date.now();

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

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const status = response.status;
        log.warn(
          { status, duration, attempt },
          "Claude API returned non-OK status"
        );

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

      const data = await response.json();
      log.info(
        { duration, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
        "Claude API call completed"
      );

      return parseResponse(data);
    } catch (err) {
      if (err instanceof DriftError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(
        { error: lastError.message, attempt },
        "Claude API call failed"
      );
    }
  }

  throw DriftError.apiError(
    `All ${MAX_RETRIES} retries exhausted: ${lastError?.message}`
  );
}

function parseResponse(data: Record<string, unknown>): DriftResult {
  const content = data.content as Array<{ type: string; text: string }>;
  if (!content || !content[0] || content[0].type !== "text") {
    throw DriftError.invalidResponse("No text content in response");
  }

  let text = content[0].text.trim();

  // Strip markdown code fences if present
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw DriftError.invalidResponse(`Failed to parse JSON: ${text.slice(0, 200)}`);
  }

  const severity = parsed.severity;
  const driftType = parsed.drift_type;
  const summary = parsed.summary;
  const recommendation = parsed.recommendation;

  if (
    !isValidSeverity(severity) ||
    !isValidDriftType(driftType) ||
    typeof summary !== "string" ||
    !isValidRecommendation(recommendation)
  ) {
    throw DriftError.invalidResponse(
      `Invalid fields in response: ${JSON.stringify(parsed).slice(0, 300)}`
    );
  }

  return {
    severity,
    driftType: normalizeDriftType(driftType),
    summary,
    recommendation,
  };
}

function isValidSeverity(v: unknown): v is "minor" | "moderate" | "critical" {
  return v === "minor" || v === "moderate" || v === "critical";
}

function isValidDriftType(v: unknown): v is string {
  return (
    v === "scope_expansion" || v === "approach_change" || v === "design_deviation"
  );
}

function isValidRecommendation(v: unknown): v is "update_spec" | "recenter_code" {
  return v === "update_spec" || v === "recenter_code";
}

function normalizeDriftType(
  v: string
): "scope_expansion" | "approach_change" | "design_deviation" {
  return v as "scope_expansion" | "approach_change" | "design_deviation";
}
