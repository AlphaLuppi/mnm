import type { Spec } from "@/lib/core/types";

export function buildDriftPrompt(
  spec: { title: string | null; content: string },
  diff: string,
  customInstructions?: string | null
): string {
  const parts: string[] = [
    `You are a drift detection system. Your job is to analyze whether code changes align with the given specification.`,
    ``,
    `**Specification:**`,
    `Title: ${spec.title ?? "Untitled"}`,
    ``,
    `\`\`\``,
    spec.content,
    `\`\`\``,
    ``,
    `**Code Changes (Git Diff):**`,
    ``,
    `\`\`\`diff`,
    diff,
    `\`\`\``,
  ];

  if (customInstructions) {
    parts.push(
      ``,
      `**Custom Instructions (project-specific rules):**`,
      customInstructions
    );
  }

  parts.push(
    ``,
    `**Analysis Instructions:**`,
    `Analyze the code changes against the specification. Determine if the changes drift from the spec intent.`,
    ``,
    `**Classification Definitions:**`,
    `- severity: "minor" (cosmetic or style differences), "moderate" (functional but acceptable divergence), "critical" (fundamentally misaligned with spec)`,
    `- drift_type: "scope_expansion" (code does more than spec requires), "approach_change" (different implementation strategy), "design_deviation" (contradicts spec design decisions)`,
    `- recommendation: "update_spec" (the implementation is better, update the spec), "recenter_code" (the spec is correct, fix the code)`,
    ``,
    `**Output Format:**`,
    `Respond with ONLY a JSON object (no markdown fences, no explanation):`,
    `{"severity": "minor|moderate|critical", "drift_type": "scope_expansion|approach_change|design_deviation", "summary": "1-3 sentence description", "recommendation": "update_spec|recenter_code"}`
  );

  return parts.join("\n");
}
