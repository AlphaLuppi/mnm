import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { specChanges } from "@/lib/db/schema";

export type SpecChangeRow = typeof specChanges.$inferSelect;

export function findUnviewed(): SpecChangeRow[] {
  const db = getDb();
  return db
    .select()
    .from(specChanges)
    .where(eq(specChanges.userViewed, 0))
    .all();
}

export function findAll(): SpecChangeRow[] {
  const db = getDb();
  return db.select().from(specChanges).all();
}

export function insert(change: typeof specChanges.$inferInsert): void {
  const db = getDb();
  db.insert(specChanges).values(change).run();
}

export function markViewed(id: string): void {
  const db = getDb();
  db.update(specChanges)
    .set({ userViewed: 1 })
    .where(eq(specChanges.id, id))
    .run();
}

export function markAllViewed(): void {
  const db = getDb();
  db.update(specChanges)
    .set({ userViewed: 1 })
    .where(eq(specChanges.userViewed, 0))
    .run();
}

export function findById(id: string): SpecChangeRow | undefined {
  const db = getDb();
  return db
    .select()
    .from(specChanges)
    .where(eq(specChanges.id, id))
    .get();
}

export function updateSummary(id: string, summary: string): void {
  const db = getDb();
  db.update(specChanges)
    .set({ changeSummary: summary })
    .where(eq(specChanges.id, id))
    .run();
}
