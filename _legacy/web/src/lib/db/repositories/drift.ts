import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { driftDetections } from "@/lib/db/schema";

export type DriftRow = typeof driftDetections.$inferSelect;

export function findByAgent(agentId: string): DriftRow[] {
  const db = getDb();
  return db
    .select()
    .from(driftDetections)
    .where(eq(driftDetections.agentId, agentId))
    .all();
}

export function findBySpec(specId: string): DriftRow[] {
  const db = getDb();
  return db
    .select()
    .from(driftDetections)
    .where(eq(driftDetections.specId, specId))
    .all();
}

export function findPending(): DriftRow[] {
  const db = getDb();
  return db
    .select()
    .from(driftDetections)
    .where(eq(driftDetections.userDecision, "pending"))
    .all();
}

export function findAll(): DriftRow[] {
  const db = getDb();
  return db.select().from(driftDetections).all();
}

export function insert(detection: typeof driftDetections.$inferInsert): void {
  const db = getDb();
  db.insert(driftDetections).values(detection).run();
}

export function update(
  id: string,
  data: Partial<Omit<typeof driftDetections.$inferInsert, "id">>
): DriftRow | undefined {
  const db = getDb();
  db.update(driftDetections)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(driftDetections.id, id))
    .run();
  return db
    .select()
    .from(driftDetections)
    .where(eq(driftDetections.id, id))
    .get();
}
