import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { crossDocDrifts, specs } from "@/lib/db/schema";

export type CrossDocDriftRow = typeof crossDocDrifts.$inferSelect;

export function findAll(): CrossDocDriftRow[] {
  const db = getDb();
  return db
    .select()
    .from(crossDocDrifts)
    .orderBy(desc(crossDocDrifts.detectedAt))
    .all();
}

export function findOpen(): CrossDocDriftRow[] {
  const db = getDb();
  return db
    .select()
    .from(crossDocDrifts)
    .where(eq(crossDocDrifts.status, "open"))
    .orderBy(desc(crossDocDrifts.detectedAt))
    .all();
}

export function findById(id: number): CrossDocDriftRow | undefined {
  const db = getDb();
  return db
    .select()
    .from(crossDocDrifts)
    .where(eq(crossDocDrifts.id, id))
    .get();
}

export function insert(
  data: typeof crossDocDrifts.$inferInsert
): void {
  const db = getDb();
  db.insert(crossDocDrifts).values(data).run();
}

export function resolve(
  id: number,
  status: "resolved" | "dismissed",
  rationale?: string
): CrossDocDriftRow | undefined {
  const db = getDb();
  db.update(crossDocDrifts)
    .set({
      status,
      resolvedAt: new Date(Date.now()),
      resolutionRationale: rationale ?? null,
    })
    .where(eq(crossDocDrifts.id, id))
    .run();
  return findById(id);
}

export function findAllEnriched() {
  const db = getDb();
  const results = findAll();

  return results.map((drift) => {
    const sourceSpec = drift.sourceSpecId
      ? db
          .select()
          .from(specs)
          .where(eq(specs.id, drift.sourceSpecId))
          .get()
      : null;
    const targetSpec = drift.targetSpecId
      ? db
          .select()
          .from(specs)
          .where(eq(specs.id, drift.targetSpecId))
          .get()
      : null;

    return {
      ...drift,
      sourceSpec: sourceSpec
        ? {
            id: sourceSpec.id,
            title: sourceSpec.title,
            filePath: sourceSpec.filePath,
            specType: sourceSpec.specType,
          }
        : null,
      targetSpec: targetSpec
        ? {
            id: targetSpec.id,
            title: targetSpec.title,
            filePath: targetSpec.filePath,
            specType: targetSpec.specType,
          }
        : null,
    };
  });
}

export function deleteAll(): void {
  const db = getDb();
  db.delete(crossDocDrifts).run();
}
