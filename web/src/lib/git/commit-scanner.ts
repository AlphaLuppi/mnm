import { getCommitLog } from "@/lib/git/repository";
import { parseCommitReferences, matchSpecPath } from "@/lib/git/commit-parser";
import * as commitAssociationsRepo from "@/lib/db/repositories/commit-associations";
import * as specsRepo from "@/lib/db/repositories/specs";
import { createChildLogger } from "@/lib/core/logger";
import crypto from "node:crypto";
import type { ProgressCallback } from "@/lib/tasks/types";

const logger = createChildLogger({ module: "commit-scanner" });

let lastScannedSha: string | null = null;

export function getLastScannedSha(): string | null {
  return lastScannedSha;
}

export function setLastScannedSha(sha: string): void {
  lastScannedSha = sha;
}

export async function scanCommits(
  fromSha?: string,
  toSha: string = "HEAD",
  maxCount: number = 100,
  onProgress?: ProgressCallback
): Promise<{ scanned: number; associations: number }> {
  try {
    const commits = await getCommitLog(fromSha ?? undefined, toSha, maxCount);

    if (commits.length === 0) {
      onProgress?.("No commits to scan");
      return { scanned: 0, associations: 0 };
    }

    onProgress?.(`Found ${commits.length} commits to scan`);

    // Get all known spec paths
    const allSpecs = specsRepo.findAll();
    const specPaths = allSpecs.map((s) => s.filePath);
    const specIdByPath = new Map(allSpecs.map((s) => [s.filePath, s.id]));

    let associationsCreated = 0;

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const shortHash = commit.hash.slice(0, 7);
      const shortMsg = commit.message.length > 50 ? commit.message.slice(0, 47) + "..." : commit.message;
      onProgress?.(`[${i + 1}/${commits.length}] Scanning commit ${shortHash}: "${shortMsg}"`);

      const refs = parseCommitReferences(commit.message);

      for (const ref of refs) {
        const matchedPath = matchSpecPath(ref.specPath, specPaths);
        if (!matchedPath) continue;

        const specId = specIdByPath.get(matchedPath);
        if (!specId) continue;

        // Check if association already exists
        const existing = commitAssociationsRepo.findByCommitSha(commit.hash);
        const alreadyLinked = existing.some(
          (e) => e.specId === specId && e.referenceType === ref.type
        );

        if (!alreadyLinked) {
          commitAssociationsRepo.insert({
            id: crypto.randomUUID(),
            commitSha: commit.hash,
            specId,
            referenceType: ref.type,
            commitMessage: commit.message,
            commitAuthor: commit.author,
            commitDate: commit.date,
            createdAt: Date.now(),
          });
          associationsCreated++;
        }
      }
    }

    // Update last scanned SHA
    if (commits.length > 0) {
      lastScannedSha = commits[0].hash;
    }

    logger.info(
      { scanned: commits.length, associations: associationsCreated },
      "Commit scan completed"
    );

    return { scanned: commits.length, associations: associationsCreated };
  } catch (err) {
    logger.error({ err }, "Commit scan failed");
    return { scanned: 0, associations: 0 };
  }
}

export async function runIncrementalScan(): Promise<{
  scanned: number;
  associations: number;
}> {
  return scanCommits(lastScannedSha ?? undefined);
}
