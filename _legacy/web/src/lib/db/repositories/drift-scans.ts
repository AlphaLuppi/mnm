import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { driftScanRuns } from "@/lib/db/schema";

export type DriftScanRow = typeof driftScanRuns.$inferSelect;
export type DriftScanInsert = typeof driftScanRuns.$inferInsert;

export function findById(id: string): DriftScanRow | undefined {
  const db = getDb();
  return db.select().from(driftScanRuns).where(eq(driftScanRuns.id, id)).get();
}

export function findBySpec(specId: string): DriftScanRow[] {
  const db = getDb();
  return db
    .select()
    .from(driftScanRuns)
    .where(eq(driftScanRuns.specId, specId))
    .orderBy(desc(driftScanRuns.createdAt))
    .all();
}

export function findAll(): DriftScanRow[] {
  const db = getDb();
  return db
    .select()
    .from(driftScanRuns)
    .orderBy(desc(driftScanRuns.createdAt))
    .all();
}

export function findLatest(): DriftScanRow | undefined {
  const db = getDb();
  return db
    .select()
    .from(driftScanRuns)
    .orderBy(desc(driftScanRuns.createdAt))
    .limit(1)
    .get();
}

export function insert(scan: DriftScanInsert): void {
  const db = getDb();
  db.insert(driftScanRuns).values(scan).run();
}

export function update(
  id: string,
  data: Partial<Omit<DriftScanInsert, "id">>
): DriftScanRow | undefined {
  const db = getDb();
  db.update(driftScanRuns)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(driftScanRuns.id, id))
    .run();
  return findById(id);
}
