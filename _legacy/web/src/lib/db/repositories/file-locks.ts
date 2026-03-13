import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { fileLocks } from "@/lib/db/schema";

export type FileLockRow = typeof fileLocks.$inferSelect;

export function findActiveLocks(): FileLockRow[] {
  const db = getDb();
  return db
    .select()
    .from(fileLocks)
    .where(isNull(fileLocks.releasedAt))
    .all();
}

export function findActiveLocksForFile(filePath: string): FileLockRow[] {
  const db = getDb();
  return db
    .select()
    .from(fileLocks)
    .where(and(eq(fileLocks.filePath, filePath), isNull(fileLocks.releasedAt)))
    .all();
}

export function acquire(lock: typeof fileLocks.$inferInsert): void {
  const db = getDb();
  db.insert(fileLocks).values(lock).run();
}

export function release(lockId: string): void {
  const db = getDb();
  db.update(fileLocks)
    .set({ releasedAt: Date.now() })
    .where(eq(fileLocks.id, lockId))
    .run();
}

export function releaseAllForAgent(agentId: string): void {
  const db = getDb();
  db.update(fileLocks)
    .set({ releasedAt: Date.now() })
    .where(and(eq(fileLocks.agentId, agentId), isNull(fileLocks.releasedAt)))
    .run();
}
