/**
 * Prompts for cross-document drift detection using LLM.
 */

export function buildCrossDocComparisonPrompt(
  upstream: { title: string | null; content: string; specType: string },
  downstream: { title: string | null; content: string; specType: string }
): string {
  const parts: string[] = [
    `You are a cross-document drift detection system. Your job is to find inconsistencies between two related specification documents in a document hierarchy.`,
    ``,
    `The upstream document (source of truth) is a ${upstream.specType}, and the downstream document should be consistent with it.`,
    ``,
    `**Upstream Document (${upstream.specType}):**`,
    `Title: ${upstream.title ?? "Untitled"}`,
    ``,
    "```",
    upstream.content,
    "```",
    ``,
    `**Downstream Document (${downstream.specType}):**`,
    `Title: ${downstream.title ?? "Untitled"}`,
    ``,
    "```",
    downstream.content,
    "```",
    ``,
    `**Analysis Instructions:**`,
    `Compare the two documents and identify any inconsistencies. Focus on:`,
    `1. **Terminology drift**: Same concept referred to with different terms (e.g., "SSE" vs "websocket")`,
    `2. **Approach drift**: Different implementation approaches described (e.g., REST vs GraphQL)`,
    `3. **Contradiction**: Direct contradictions in decisions or requirements`,
    ``,
    `For each inconsistency found, provide:`,
    `- drift_type: "terminology" | "approach" | "contradiction"`,
    `- severity: "minor" (terminology only) | "moderate" (different approach) | "critical" (contradictory decisions)`,
    `- description: Clear explanation of the inconsistency`,
    `- upstream_text: The relevant text from the upstream document`,
    `- downstream_text: The relevant text from the downstream document`,
    ``,
    `**Output Format:**`,
    `Respond with ONLY a JSON object (no markdown fences, no explanation):`,
    `{"drifts": [{"drift_type": "...", "severity": "...", "description": "...", "upstream_text": "...", "downstream_text": "..."}]}`,
    ``,
    `If no inconsistencies are found, return: {"drifts": []}`,
  ];

  return parts.join("\n");
}
