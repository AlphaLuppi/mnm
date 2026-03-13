import { getGit, getCurrentHead } from "@/lib/git/repository";
import * as importantFilesRepo from "@/lib/db/repositories/important-files";
import * as specChangesRepo from "@/lib/db/repositories/spec-changes";
import { createChildLogger } from "@/lib/core/logger";
import crypto from "node:crypto";

const logger = createChildLogger({ module: "change-detector" });

export interface DetectedChange {
  filePath: string;
  oldCommitSha: string;
  newCommitSha: string;
  diffContent: string;
}

let lastKnownSha: string | null = null;

export function getLastKnownSha(): string | null {
  return lastKnownSha;
}

export function setLastKnownSha(sha: string): void {
  lastKnownSha = sha;
}

export async function detectChanges(
  importantFilePaths: string[],
  fromSha: string,
  toSha: string
): Promise<DetectedChange[]> {
  if (!importantFilePaths.length || fromSha === toSha) {
    return [];
  }

  const git = getGit();
  const changes: DetectedChange[] = [];

  try {
    // Get the list of changed files between the two SHAs
    const diffSummary = await git.diffSummary([`${fromSha}..${toSha}`]);
    const changedPaths = new Set(diffSummary.files.map((f) => f.file));

    // Filter to only important files
    const relevantFiles = importantFilePaths.filter((p) => changedPaths.has(p));

    if (!relevantFiles.length) {
      return [];
    }

    // Get diffs for each relevant file
    for (const filePath of relevantFiles) {
      try {
        const diff = await git.diff([`${fromSha}..${toSha}`, "--", filePath]);
        changes.push({
          filePath,
          oldCommitSha: fromSha,
          newCommitSha: toSha,
          diffContent: diff,
        });
      } catch (err) {
        logger.warn({ filePath, err }, "Failed to get diff for file");
      }
    }
  } catch (err) {
    logger.error({ err }, "Change detection failed");
  }

  return changes;
}

export async function runChangeDetection(): Promise<{
  changes: DetectedChange[];
  headChanged: boolean;
}> {
  try {
    const currentHead = await getCurrentHead();

    if (!lastKnownSha) {
      lastKnownSha = currentHead;
      return { changes: [], headChanged: false };
    }

    if (lastKnownSha === currentHead) {
      return { changes: [], headChanged: false };
    }

    const importantFiles = importantFilesRepo.findAll();
    const importantPaths = importantFiles.map((f) => f.filePath);

    const changes = await detectChanges(importantPaths, lastKnownSha, currentHead);

    // Store changes in database
    const now = Date.now();
    for (const change of changes) {
      specChangesRepo.insert({
        id: crypto.randomUUID(),
        filePath: change.filePath,
        oldCommitSha: change.oldCommitSha,
        newCommitSha: change.newCommitSha,
        changeSummary: `File changed: ${change.filePath}`,
        detectedAt: now,
        userViewed: 0,
        createdAt: now,
      });
    }

    const previousSha = lastKnownSha;
    lastKnownSha = currentHead;

    logger.info(
      { from: previousSha.slice(0, 7), to: currentHead.slice(0, 7), changesFound: changes.length },
      "Change detection completed"
    );

    return { changes, headChanged: true };
  } catch (err) {
    logger.error({ err }, "Change detection run failed");
    return { changes: [], headChanged: false };
  }
}
