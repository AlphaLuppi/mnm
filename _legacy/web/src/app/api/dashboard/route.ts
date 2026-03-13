import { NextResponse } from "next/server";
import { ensureBootstrapped, refreshProviders } from "@/lib/bootstrap";
import { getRepoInfo } from "@/lib/git/repository";
import * as specsRepo from "@/lib/db/repositories/specs";
import * as driftRepo from "@/lib/db/repositories/drift";
import * as agentsRepo from "@/lib/db/repositories/agents";
import * as workflowRepo from "@/lib/db/repositories/workflows";
import * as discoveryRepo from "@/lib/db/repositories/discovery-results";
import * as crossDocDriftRepo from "@/lib/db/repositories/cross-doc-drifts";

export async function GET() {
  try {
    // Ensure bootstrap has run at least once
    await ensureBootstrapped();

    // Refresh provider state (lightweight, changes frequently)
    const providers = await refreshProviders();

    // Gather stats from DB
    const allSpecs = specsRepo.findAll();
    const byType: Record<string, number> = {};
    for (const spec of allSpecs) {
      byType[spec.specType] = (byType[spec.specType] ?? 0) + 1;
    }

    const allDrift = driftRepo.findAll();
    const pendingDrift = driftRepo.findPending();

    const allAgents = agentsRepo.findAll();
    const runningAgents = agentsRepo.findByStatus("running");

    // Discovery stats
    const allWorkflows = workflowRepo.findAll();
    const allDiscoveryResults = discoveryRepo.findAll();
    const discoveryByType: Record<string, number> = {};
    for (const result of allDiscoveryResults) {
      discoveryByType[result.type] = (discoveryByType[result.type] ?? 0) + 1;
    }

    // Cross-doc drift stats
    const openCrossDocDrifts = crossDocDriftRepo.findOpen();

    // Get git info
    let git: {
      branch: string;
      head: string;
      message: string;
    } | null = null;

    try {
      const repoInfo = await getRepoInfo();
      if (repoInfo.isRepo) {
        git = {
          branch: repoInfo.branch,
          head: repoInfo.latestCommitSha.slice(0, 7),
          message: repoInfo.latestCommitMessage,
        };
      }
    } catch {
      // git info optional
    }

    return NextResponse.json({
      specs: { total: allSpecs.length, byType },
      agents: { running: runningAgents.length, total: allAgents.length },
      drift: { pending: pendingDrift.length, total: allDrift.length },
      crossDocDrift: { open: openCrossDocDrifts.length },
      workflows: { total: allWorkflows.length },
      discovery: {
        total: allDiscoveryResults.length,
        byType: discoveryByType,
      },
      providers,
      git,
    });
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Dashboard failed" } },
      { status: 500 }
    );
  }
}
