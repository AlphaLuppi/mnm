import { readFileSync } from "fs";
import { join } from "path";
import simpleGit from "simple-git";
import * as driftRepo from "@/lib/db/repositories/drift";
import * as specRepo from "@/lib/db/repositories/specs";
import * as agentRepo from "@/lib/db/repositories/agents";
import { loadConfig } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";
import { DriftError } from "@/lib/core/errors";
import { analyzeDrift } from "./analyzer";
import { loadCustomInstructions } from "./instructions";
import type { DriftDetection } from "@/lib/core/types";

const log = createChildLogger({ module: "drift-detector" });

export async function detectDrift(
  agentId: string,
  specId: string
): Promise<DriftDetection> {
  const config = loadConfig();
  const repoRoot = config.repositoryPath;
  const now = Date.now();

  log.info({ agentId, specId }, "Starting drift detection");

  // Step 1: Load spec from DB
  const spec = specRepo.findById(specId);
  if (!spec) {
    throw DriftError.specNotFound(specId);
  }

  // Step 2: Read spec content from disk
  let specContent: string;
  try {
    specContent = readFileSync(join(repoRoot, spec.filePath), "utf-8");
  } catch {
    throw DriftError.specNotFound(
      `Spec file not found on disk: ${spec.filePath}`
    );
  }

  // Step 3: Get agent's file scope
  const agent = agentRepo.findById(agentId);
  let scope: string[] = [];
  if (agent?.scope) {
    try {
      scope = JSON.parse(agent.scope);
    } catch {
      scope = [];
    }
  }

  // Step 4: Generate combined diff for all files in scope
  const git = simpleGit(repoRoot);
  const diffs: string[] = [];
  for (const file of scope) {
    try {
      const diffText = await git.diff(["HEAD", "--", file]);
      if (diffText.trim()) {
        diffs.push(`--- ${file} ---\n${diffText}`);
      }
    } catch {
      log.warn({ file }, "Failed to generate diff for file");
    }
  }

  const combinedDiff = diffs.join("\n\n");
  if (!combinedDiff.trim()) {
    // No changes detected -- store a minor "no drift" result
    const detection: DriftDetection = {
      id: crypto.randomUUID(),
      agentId,
      specId,
      severity: "minor",
      driftType: "scope_expansion",
      summary: "No code changes detected in agent scope.",
      recommendation: "No drift found.",
      diffContent: null,
      userDecision: "accepted",
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    driftRepo.insert(detection);
    return detection;
  }

  // Step 5: Load custom instructions
  const customInstructions = loadCustomInstructions(repoRoot);

  // Step 6: Call Claude API
  const result = await analyzeDrift(
    { title: spec.title, content: specContent },
    combinedDiff,
    customInstructions
  );

  // Step 7: Persist result
  const detection: DriftDetection = {
    id: crypto.randomUUID(),
    agentId,
    specId,
    severity: result.severity,
    driftType: result.driftType,
    summary: result.summary,
    recommendation: result.recommendation,
    diffContent: combinedDiff,
    userDecision: "pending",
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  driftRepo.insert(detection);

  log.info(
    { detectionId: detection.id, severity: result.severity, driftType: result.driftType },
    "Drift detection completed"
  );

  return detection;
}
