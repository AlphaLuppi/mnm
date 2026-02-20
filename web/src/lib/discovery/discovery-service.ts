import { createChildLogger } from "@/lib/core/logger";
import { scanRepo } from "./repo-scanner";
import { classifyWithLLM } from "./llm-classifier";
import { parseWorkflows, parseAgents } from "./bmad-parser";
import * as workflowRepo from "@/lib/db/repositories/workflows";
import * as discoveryRepo from "@/lib/db/repositories/discovery-results";

const log = createChildLogger({ module: "discovery-service" });

export interface DiscoverySummary {
  workflows: number;
  agents: number;
  specs: number;
  commands: number;
  configs: number;
  total: number;
  durationMs: number;
}

/** Run a full discovery scan: scan repo, classify files, parse BMAD, persist results. */
export async function runFullDiscovery(repoRoot: string): Promise<DiscoverySummary> {
  const startTime = Date.now();
  log.info({ repoRoot }, "Starting full discovery scan");

  // Clear existing results for a clean scan
  discoveryRepo.deleteAll();
  workflowRepo.deleteAll();

  // Phase 1: Scan repo structure
  const overview = await scanRepo(repoRoot);

  // Phase 2: LLM classification (falls back to heuristics if no API key)
  const classifications = await classifyWithLLM(overview);

  // Phase 3: Parse BMAD-specific structures
  const parsedWorkflows = parseWorkflows(repoRoot);
  const parsedAgents = parseAgents(repoRoot);

  // Phase 4: Persist classification results
  for (const c of classifications) {
    discoveryRepo.upsert({
      type: c.type,
      path: c.path,
      classification: c.classification,
      name: c.name,
      metadata: JSON.stringify({ confidence: c.confidence }),
      llmModel: c.confidence > 0.7 ? "claude-sonnet-4-20250514" : null,
    });
  }

  // Phase 5: Persist parsed workflows
  for (const wf of parsedWorkflows) {
    workflowRepo.upsertFromDiscovery({
      name: wf.name,
      description: wf.description,
      phase: wf.phase,
      sourcePath: wf.sourcePath,
      stepsJson: JSON.stringify(wf.steps),
      metadata: JSON.stringify(wf.metadata),
    });

    // Also record in discovery results
    discoveryRepo.upsert({
      type: "workflow",
      path: wf.sourcePath,
      classification: `BMAD workflow (${wf.phase})`,
      name: wf.name,
      metadata: JSON.stringify({ phase: wf.phase, stepCount: wf.steps.length }),
    });
  }

  // Phase 6: Persist parsed agents as discovery results
  for (const agent of parsedAgents) {
    discoveryRepo.upsert({
      type: "agent",
      path: agent.sourcePath,
      classification: agent.title,
      name: agent.displayName,
      metadata: JSON.stringify({
        role: agent.role,
        module: agent.module,
        internalName: agent.name,
      }),
    });
  }

  const durationMs = Date.now() - startTime;

  // Build summary
  const allResults = discoveryRepo.findAll();
  const summary: DiscoverySummary = {
    workflows: allResults.filter((r) => r.type === "workflow").length,
    agents: allResults.filter((r) => r.type === "agent").length,
    specs: allResults.filter((r) => r.type === "spec").length,
    commands: allResults.filter((r) => r.type === "command").length,
    configs: allResults.filter((r) => r.type === "config").length,
    total: allResults.length,
    durationMs,
  };

  log.info(
    {
      workflows: summary.workflows,
      agents: summary.agents,
      specs: summary.specs,
      total: summary.total,
      durationMs,
    },
    "Full discovery scan completed"
  );

  return summary;
}

/** Run incremental discovery - only scan changes since last run. */
export async function runIncrementalDiscovery(repoRoot: string): Promise<DiscoverySummary> {
  const lastScan = discoveryRepo.getLastScanTime();

  if (!lastScan) {
    log.info("No previous scan found, running full discovery");
    return runFullDiscovery(repoRoot);
  }

  log.info({ lastScan: lastScan.toISOString() }, "Running incremental discovery");

  // For incremental, we re-parse BMAD structures (lightweight) but skip full LLM classification
  const startTime = Date.now();

  // Re-parse BMAD workflows (fast, filesystem only)
  const parsedWorkflows = parseWorkflows(repoRoot);
  for (const wf of parsedWorkflows) {
    workflowRepo.upsertFromDiscovery({
      name: wf.name,
      description: wf.description,
      phase: wf.phase,
      sourcePath: wf.sourcePath,
      stepsJson: JSON.stringify(wf.steps),
      metadata: JSON.stringify(wf.metadata),
    });
  }

  // Re-parse agents
  const parsedAgents = parseAgents(repoRoot);
  for (const agent of parsedAgents) {
    discoveryRepo.upsert({
      type: "agent",
      path: agent.sourcePath,
      classification: agent.title,
      name: agent.displayName,
      metadata: JSON.stringify({
        role: agent.role,
        module: agent.module,
        internalName: agent.name,
      }),
    });
  }

  const durationMs = Date.now() - startTime;
  const allResults = discoveryRepo.findAll();

  const summary: DiscoverySummary = {
    workflows: allResults.filter((r) => r.type === "workflow").length,
    agents: allResults.filter((r) => r.type === "agent").length,
    specs: allResults.filter((r) => r.type === "spec").length,
    commands: allResults.filter((r) => r.type === "command").length,
    configs: allResults.filter((r) => r.type === "config").length,
    total: allResults.length,
    durationMs,
  };

  log.info(
    { workflows: summary.workflows, agents: summary.agents, durationMs },
    "Incremental discovery completed"
  );

  return summary;
}
