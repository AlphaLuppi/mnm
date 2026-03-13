import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { commitAssociations } from "@/lib/db/schema";

export type CommitAssociationRow = typeof commitAssociations.$inferSelect;

export function findBySpecId(specId: string): CommitAssociationRow[] {
  const db = getDb();
  return db
    .select()
    .from(commitAssociations)
    .where(eq(commitAssociations.specId, specId))
    .all();
}

export function findByCommitSha(sha: string): CommitAssociationRow[] {
  const db = getDb();
  return db
    .select()
    .from(commitAssociations)
    .where(eq(commitAssociations.commitSha, sha))
    .all();
}

export function findAll(): CommitAssociationRow[] {
  const db = getDb();
  return db.select().from(commitAssociations).all();
}

export function insert(
  association: typeof commitAssociations.$inferInsert
): void {
  const db = getDb();
  db.insert(commitAssociations).values(association).run();
}
