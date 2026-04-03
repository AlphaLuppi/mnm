import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { folderShares } from "@mnm/db";

export function folderShareService(db: Db) {
  return {
    async create(
      companyId: string,
      folderId: string,
      input: { userId: string; permission?: string },
      sharedByUserId: string,
    ) {
      const [share] = await db
        .insert(folderShares)
        .values({
          folderId,
          companyId,
          sharedWithUserId: input.userId,
          permission: input.permission ?? "viewer",
          sharedByUserId,
        })
        .onConflictDoUpdate({
          target: [folderShares.folderId, folderShares.sharedWithUserId],
          set: { permission: input.permission ?? "viewer" },
        })
        .returning();
      return share!;
    },

    async list(companyId: string, folderId: string) {
      return db
        .select()
        .from(folderShares)
        .where(
          and(
            eq(folderShares.folderId, folderId),
            eq(folderShares.companyId, companyId),
          ),
        );
    },

    async update(companyId: string, shareId: string, permission: string) {
      const [updated] = await db
        .update(folderShares)
        .set({ permission })
        .where(
          and(
            eq(folderShares.id, shareId),
            eq(folderShares.companyId, companyId),
          ),
        )
        .returning();
      return updated ?? null;
    },

    async remove(companyId: string, shareId: string) {
      const [deleted] = await db
        .delete(folderShares)
        .where(
          and(
            eq(folderShares.id, shareId),
            eq(folderShares.companyId, companyId),
          ),
        )
        .returning();
      return deleted ?? null;
    },
  };
}
