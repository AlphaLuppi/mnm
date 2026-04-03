import {
  and,
  eq,
  desc,
  sql,
  count as drizzleCount,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  folders,
  folderItems,
  folderShares,
  artifacts,
  documents,
  chatChannels,
  tagAssignments,
} from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";

export function folderService(db: Db) {
  return {
    /**
     * Create a new folder. Always private — visibility is derived from shares/tags.
     */
    async create(
      companyId: string,
      input: {
        name: string;
        description?: string | null;
        icon?: string | null;
      },
      ownerUserId: string,
    ) {
      const [folder] = await db
        .insert(folders)
        .values({
          companyId,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? null,
          ownerUserId,
        })
        .returning();

      publishLiveEvent({
        companyId,
        type: "folder.created",
        payload: {
          folderId: folder!.id,
          name: folder!.name,
          ownerUserId,
        },
      });

      return folder!;
    },

    /**
     * Get a folder by ID with derived visibility check.
     * Visibility: owner | admin | folder_shares | tag overlap
     */
    async getById(
      companyId: string,
      folderId: string,
      requestingUserId: string,
      opts?: { isAdmin?: boolean },
    ) {
      const [folder] = await db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.companyId, companyId)),
        );

      if (!folder) return null;

      const itemCount = await this.getItemCount(folderId);

      // Admin bypass
      if (opts?.isAdmin) {
        return { ...folder, itemCount, canEdit: true };
      }

      // Owner always sees + can edit
      if (folder.ownerUserId === requestingUserId) {
        return { ...folder, itemCount, canEdit: true };
      }

      // Check folder_shares
      const [share] = await db
        .select({ permission: folderShares.permission })
        .from(folderShares)
        .where(
          and(
            eq(folderShares.folderId, folderId),
            eq(folderShares.companyId, companyId),
            eq(folderShares.sharedWithUserId, requestingUserId),
          ),
        );

      if (share) {
        return { ...folder, itemCount, canEdit: share.permission === "editor" };
      }

      // Check tag overlap
      const tagOverlap = await db.execute(sql`
        SELECT 1 FROM tag_assignments fa
        JOIN tag_assignments ua ON fa.tag_id = ua.tag_id
        WHERE fa.target_type = 'folder' AND fa.target_id = ${folderId}::text
          AND fa.company_id = ${companyId}
          AND ua.target_type = 'user' AND ua.target_id = ${requestingUserId}
          AND ua.company_id = ${companyId}
        LIMIT 1
      `);

      if ((tagOverlap as unknown[]).length > 0) {
        return { ...folder, itemCount, canEdit: false };
      }

      return null;
    },

    /**
     * Get item count for a folder.
     */
    async getItemCount(folderId: string): Promise<number> {
      const result = await db
        .select({ count: drizzleCount() })
        .from(folderItems)
        .where(eq(folderItems.folderId, folderId));
      return Number(result[0]?.count ?? 0);
    },

    /**
     * List folders visible to the requesting user.
     * Derived visibility: owner + folder_shares + tag overlap. Admin sees all.
     */
    async list(
      companyId: string,
      requestingUserId: string,
      opts?: { limit?: number; offset?: number; isAdmin?: boolean },
    ) {
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;

      const conditions: SQL[] = [
        eq(folders.companyId, companyId),
      ];

      if (!opts?.isAdmin) {
        const visibilityCondition = sql`(
          ${folders.ownerUserId} = ${requestingUserId}
          OR EXISTS (
            SELECT 1 FROM folder_shares
            WHERE folder_id = ${folders.id} AND shared_with_user_id = ${requestingUserId}
              AND company_id = ${companyId}
          )
          OR EXISTS (
            SELECT 1 FROM tag_assignments fa
            JOIN tag_assignments ua ON fa.tag_id = ua.tag_id
            WHERE fa.target_type = 'folder' AND fa.target_id = ${folders.id}::text
              AND fa.company_id = ${companyId}
              AND ua.target_type = 'user' AND ua.target_id = ${requestingUserId}
              AND ua.company_id = ${companyId}
          )
        )`;

        conditions.push(visibilityCondition);
      }

      const whereClause = and(...conditions);

      const [folderRows, totalResult] = await Promise.all([
        db
          .select()
          .from(folders)
          .where(whereClause)
          .orderBy(desc(folders.updatedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: drizzleCount() })
          .from(folders)
          .where(whereClause),
      ]);

      return {
        folders: folderRows,
        total: Number(totalResult[0]?.count ?? 0),
      };
    },

    /**
     * Update a folder. Owner, admin, or editors (from folder_shares) can update.
     */
    async update(
      companyId: string,
      folderId: string,
      input: {
        name?: string;
        description?: string | null;
        icon?: string | null;
        instructions?: string | null;
      },
      requestingUserId: string,
      opts?: { isAdmin?: boolean },
    ) {
      const [existing] = await db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.companyId, companyId)),
        );

      if (!existing) return null;

      // Check edit permission: owner, admin, or editor share
      let canEdit = opts?.isAdmin || existing.ownerUserId === requestingUserId;

      if (!canEdit) {
        const [share] = await db
          .select({ permission: folderShares.permission })
          .from(folderShares)
          .where(
            and(
              eq(folderShares.folderId, folderId),
              eq(folderShares.companyId, companyId),
              eq(folderShares.sharedWithUserId, requestingUserId),
            ),
          );
        canEdit = share?.permission === "editor";
      }

      if (!canEdit) {
        return { error: "forbidden" as const };
      }

      const now = new Date();
      const updates: Record<string, unknown> = { updatedAt: now };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.instructions !== undefined) updates.instructions = input.instructions;

      const [updated] = await db
        .update(folders)
        .set(updates)
        .where(
          and(eq(folders.id, folderId), eq(folders.companyId, companyId)),
        )
        .returning();

      publishLiveEvent({
        companyId,
        type: "folder.updated",
        payload: {
          folderId: updated!.id,
          name: updated!.name,
        },
      });

      return updated!;
    },

    /**
     * Get a preview of what will be affected by deleting a folder.
     */
    async getDeletionPreview(companyId: string, folderId: string) {
      const [nativeDocs, importedItems, channels] = await Promise.all([
        db
          .select({ id: documents.id, title: documents.title, mimeType: documents.mimeType })
          .from(documents)
          .where(
            and(
              eq(documents.companyId, companyId),
              eq(documents.ownedByFolderId, folderId),
              sql`${documents.deletedAt} IS NULL`,
            ),
          ),
        db
          .select({
            id: folderItems.id,
            itemType: folderItems.itemType,
            displayName: folderItems.displayName,
            artifactId: folderItems.artifactId,
            documentId: folderItems.documentId,
            channelId: folderItems.channelId,
          })
          .from(folderItems)
          .where(
            and(
              eq(folderItems.folderId, folderId),
              eq(folderItems.companyId, companyId),
            ),
          ),
        db
          .select({ id: chatChannels.id, name: chatChannels.name })
          .from(chatChannels)
          .where(
            and(
              eq(chatChannels.companyId, companyId),
              eq(chatChannels.folderId, folderId),
            ),
          ),
      ]);

      return { nativeDocuments: nativeDocs, importedItems, channels };
    },

    /**
     * Delete a folder. Only the owner can delete.
     * Handles native documents: preserve selected ones, soft-delete the rest.
     */
    async delete(
      companyId: string,
      folderId: string,
      requestingUserId: string,
      preserveDocumentIds?: string[],
    ) {
      const [existing] = await db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.companyId, companyId)),
        );

      if (!existing) return { error: "not_found" as const };

      if (existing.ownerUserId !== requestingUserId) {
        return { error: "forbidden" as const };
      }

      // Handle native documents
      const preserveSet = new Set(preserveDocumentIds ?? []);

      const nativeDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.companyId, companyId),
            eq(documents.ownedByFolderId, folderId),
            sql`${documents.deletedAt} IS NULL`,
          ),
        );

      for (const doc of nativeDocs) {
        if (preserveSet.has(doc.id)) {
          // Preserve: detach from folder
          await db
            .update(documents)
            .set({ ownedByFolderId: null })
            .where(eq(documents.id, doc.id));
        } else {
          // Soft-delete
          await db
            .update(documents)
            .set({ deletedAt: new Date() })
            .where(eq(documents.id, doc.id));
        }
      }

      // Delete folder (CASCADE handles folder_items + folder_shares, SET NULL on chatChannels.folderId)
      await db
        .delete(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.companyId, companyId)),
        );

      publishLiveEvent({
        companyId,
        type: "folder.deleted",
        payload: { folderId },
      });

      return { error: null };
    },

    /**
     * Add an item to a folder.
     */
    async addItem(
      companyId: string,
      folderId: string,
      input: {
        itemType: "artifact" | "document" | "channel";
        artifactId?: string | null;
        documentId?: string | null;
        channelId?: string | null;
        displayName?: string | null;
      },
      addedByUserId: string,
    ) {
      // Validate the referenced entity exists
      if (input.itemType === "artifact") {
        if (!input.artifactId) {
          return { error: "artifactId is required for artifact items" as const };
        }
        const [artifact] = await db
          .select({ id: artifacts.id })
          .from(artifacts)
          .where(
            and(
              eq(artifacts.id, input.artifactId),
              eq(artifacts.companyId, companyId),
            ),
          );
        if (!artifact) {
          return { error: "Referenced artifact not found" as const };
        }
      } else if (input.itemType === "document") {
        if (!input.documentId) {
          return { error: "documentId is required for document items" as const };
        }
        const [document] = await db
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.id, input.documentId),
              eq(documents.companyId, companyId),
            ),
          );
        if (!document) {
          return { error: "Referenced document not found" as const };
        }
      } else if (input.itemType === "channel") {
        if (!input.channelId) {
          return { error: "channelId is required for channel items" as const };
        }
        const [channel] = await db
          .select({ id: chatChannels.id })
          .from(chatChannels)
          .where(
            and(
              eq(chatChannels.id, input.channelId),
              eq(chatChannels.companyId, companyId),
            ),
          );
        if (!channel) {
          return { error: "Referenced channel not found" as const };
        }
      }

      const [item] = await db
        .insert(folderItems)
        .values({
          folderId,
          companyId,
          itemType: input.itemType,
          artifactId: input.itemType === "artifact" ? input.artifactId! : null,
          documentId: input.itemType === "document" ? input.documentId! : null,
          channelId: input.itemType === "channel" ? input.channelId! : null,
          displayName: input.displayName ?? null,
          addedByUserId,
        })
        .returning();

      // Touch the folder's updatedAt
      await db
        .update(folders)
        .set({ updatedAt: new Date() })
        .where(eq(folders.id, folderId));

      return item!;
    },

    /**
     * Remove an item from a folder.
     */
    async removeItem(companyId: string, folderId: string, itemId: string) {
      const [deleted] = await db
        .delete(folderItems)
        .where(
          and(
            eq(folderItems.id, itemId),
            eq(folderItems.folderId, folderId),
            eq(folderItems.companyId, companyId),
          ),
        )
        .returning();

      if (deleted) {
        await db
          .update(folders)
          .set({ updatedAt: new Date() })
          .where(eq(folders.id, folderId));
      }

      return deleted ?? null;
    },

    /**
     * Get items in a folder with LEFT JOINs for display info.
     */
    async getItems(
      companyId: string,
      folderId: string,
      opts?: { itemType?: string; limit?: number; offset?: number },
    ) {
      const limit = opts?.limit ?? 100;
      const offset = opts?.offset ?? 0;

      const conditions: SQL[] = [
        eq(folderItems.folderId, folderId),
        eq(folderItems.companyId, companyId),
      ];

      if (opts?.itemType) {
        conditions.push(eq(folderItems.itemType, opts.itemType));
      }

      const rows = await db
        .select({
          item: folderItems,
          artifactTitle: artifacts.title,
          documentTitle: documents.title,
          channelName: chatChannels.name,
        })
        .from(folderItems)
        .leftJoin(artifacts, eq(folderItems.artifactId, artifacts.id))
        .leftJoin(documents, eq(folderItems.documentId, documents.id))
        .leftJoin(chatChannels, eq(folderItems.channelId, chatChannels.id))
        .where(and(...conditions))
        .orderBy(desc(folderItems.addedAt))
        .limit(limit)
        .offset(offset);

      return rows.map((row) => ({
        ...row.item,
        artifactTitle: row.artifactTitle ?? null,
        documentTitle: row.documentTitle ?? null,
        channelName: row.channelName ?? null,
      }));
    },
  };
}
