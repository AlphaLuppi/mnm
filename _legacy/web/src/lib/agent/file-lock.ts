import * as fileLockRepo from "@/lib/db/repositories/file-locks";
import * as agentRepo from "@/lib/db/repositories/agents";
import { LockConflictError } from "@/lib/core/errors";
import { createChildLogger } from "@/lib/core/logger";
import type { FileLock } from "@/lib/core/types";

const log = createChildLogger({ module: "file-lock" });

export class FileLockManager {
  acquireLocks(
    agentId: string,
    filePaths: string[],
    lockType: "read" | "write"
  ): void {
    // Check all files for conflicts FIRST (atomic: all-or-nothing)
    for (const filePath of filePaths) {
      const activeLocks = fileLockRepo.findActiveLocksForFile(filePath);

      // Filter out locks held by the same agent (re-entrant is allowed)
      const otherLocks = activeLocks.filter((l) => l.agentId !== agentId);

      if (lockType === "write" && otherLocks.length > 0) {
        throw new LockConflictError(filePath, otherLocks[0].agentId);
      }
      if (
        lockType === "read" &&
        otherLocks.some((l) => l.lockType === "write")
      ) {
        const writeLock = otherLocks.find((l) => l.lockType === "write")!;
        throw new LockConflictError(filePath, writeLock.agentId);
      }
    }

    // All checks passed -- insert all locks
    const now = Date.now();
    for (const filePath of filePaths) {
      fileLockRepo.acquire({
        id: crypto.randomUUID(),
        filePath,
        agentId,
        lockType,
        acquiredAt: now,
      });
    }

    log.info({ agentId, fileCount: filePaths.length, lockType }, "Locks acquired");
  }

  releaseLocks(agentId: string): void {
    fileLockRepo.releaseAllForAgent(agentId);
    log.info({ agentId }, "Locks released");
  }

  getActiveLocks(): FileLock[] {
    return fileLockRepo.findActiveLocks() as FileLock[];
  }

  getActiveLocksForFile(filePath: string): FileLock[] {
    return fileLockRepo.findActiveLocksForFile(filePath) as FileLock[];
  }

  cleanupOrphanedLocks(): number {
    const activeLocks = fileLockRepo.findActiveLocks();
    let released = 0;

    for (const lock of activeLocks) {
      const agent = agentRepo.findById(lock.agentId);
      if (
        !agent ||
        agent.status === "error" ||
        agent.status === "completed"
      ) {
        fileLockRepo.release(lock.id);
        released++;
      }
    }

    if (released > 0) {
      log.info({ released }, "Cleaned up orphaned locks");
    }
    return released;
  }
}
