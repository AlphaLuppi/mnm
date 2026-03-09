import { z } from "zod";
import { logger } from "../middleware/logger.js";
import { buildDriftPrompt } from "./drift-prompts.js";

/**
 * Zod schema for a single drift item returned by the Claude API.
 */
const DriftResultItemSchema = z.object({
  severity: z.enum(["minor", "moderate", "critical"]),
  drift_type: z.enum(["scope_expansion", "approach_change", "design_deviation"]),
  confidence: z.number().min(0).max(1),
  description: z.string().min(1),
  recommendation: z.enum(["update_spec", "recenter_code"]),
  source_excerpt: z.string(),
  target_excerpt: z.string(),
});

const DriftResultArraySchema = z.array(DriftResultItemSchema);

export type DriftResultItem = z.infer<typeof DriftResultItemSchema>;

/** Errors that should NOT be retried. */
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404]);

/** Max retry attempts. */
const MAX_RETRIES = 3;

/** Exponential backoff delays in ms. */
const BACKOFF_DELAYS = [1000, 2000, 4000];

/**
 * Analyze drift between two documents using the Claude API.
 *
 * Returns an array of drift items. Returns empty array if no drift found.
 * Throws on API failure after retries or on invalid API key.
 */
export async function analyzeDrift(
  sourceDoc: string,
  sourceContent: string,
  targetDoc: string,
  targetContent: string,
  customInstructions?: string,
): Promise<DriftResultItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const { system, user } = buildDriftPrompt(
    sourceDoc,
    sourceContent,
    targetDoc,
    targetContent,
    customInstructions,
  );

  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0,
    system,
    messages: [{ role: "user", content: user }],
  });

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BACKOFF_DELAYS[attempt - 1]!;
      logger.info({ attempt, delay }, "Retrying drift analysis");
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        logger.error(
          { status: response.status, elapsed, attempt, errorBody },
          "Claude API error",
        );

        if (NON_RETRYABLE_STATUS.has(response.status)) {
          throw new Error(
            `Claude API returned ${response.status}: ${errorBody}`,
          );
        }

        lastError = new Error(
          `Claude API returned ${response.status}: ${errorBody}`,
        );
        continue;
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      logger.info(
        {
          elapsed,
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
          sourceDoc,
          targetDoc,
        },
        "Drift analysis completed",
      );

      // Extract text from response
      const textBlock = data.content.find((c) => c.type === "text");
      if (!textBlock) {
        throw new Error("No text content in Claude API response");
      }

      // Strip markdown code fences if present
      let jsonStr = textBlock.text.trim();
      const fenceMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1]!.trim();
      }

      // Parse and validate
      const parsed = JSON.parse(jsonStr);
      const validated = DriftResultArraySchema.parse(parsed);
      return validated;
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.startsWith("Claude API returned 4") ||
          err.message === "ANTHROPIC_API_KEY environment variable is not set")
      ) {
        // Non-retryable errors — rethrow immediately
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error({ err: lastError, attempt }, "Drift analysis attempt failed");
    }
  }

  throw new Error(
    `Drift analysis failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}
