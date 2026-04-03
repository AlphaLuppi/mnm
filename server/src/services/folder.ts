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
  artifacts,
  documents,
  chatChannels,
  tagAssignments,
} from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";

export function folderService(db: Db) {
  return {
    /**
     * Create a new folder.
     */
    async create(
      companyId: string,
      input: {
        name: string;
        description?: string | null;
        icon?: string | null;
        visibility?: "private" | "team" | "public";
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
          visibility: input.visibility ?? "private",
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
     * Get a folder by ID with visibility check.
     * - Admin (bypassTagFilter) sees all folders
     * - Owner always sees it
     * - Private folders are only visible to the owner
     * - Team/public folders check tag overlap (team) or are always visible (public)
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

      // Admin bypass: skip visibility checks
      if (opts?.isAdmin) {
        const itemCount = await this.getItemCount(folderId);
        return { ...folder, itemCount };
      }

      // Owner always sees their folder
      if (folder.ownerUserId === requestingUserId) {
        const itemCount = await this.getItemCount(folderId);
        return { ...folder, itemCount };
      }

      // Private folders are invisible to non-owners
      if (folder.visibility === "private") return null;

      // Public folders are visible to everyone in the company
      if (folder.visibility === "public") {
        const itemCount = await this.getItemCount(folderId);
        return { ...folder, itemCount };
      }

      // Team folders: check tag overlap between owner and requester
      if (folder.visibility === "team" && folder.ownerUserId) {
        const [tagOverlap] = await db
          .select({ id: tagAssignments.id })
          .from(tagAssignments)
          .innerJoin(
            sql`tag_assignments AS ta2`,
            sql`${tagAssignments.tagId} = ta2.tag_id`,
          )
          .where(
            and(
              eq(tagAssignments.companyId, companyId),
              eq(tagAssignments.targetType, "user"),
              sql`${tagAssignments.targetId} = ${folder.ownerUserId}`,
              sql`ta2.target_type = 'user'`,
              sql`ta2.target_id = ${requestingUserId}`,
              sql`ta2.company_id = ${companyId}`,
            ),
          )
          .limit(1);

        if (!tagOverlap) return null;

        const itemCount = await this.getItemCount(folderId);
        return { ...folder, itemCount };
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
     * Shows: owned folders + shared/public folders visible via tag overlap.
     * Admin (isAdmin) sees all folders in the company.
     */
    async list(
      companyId: string,
      requestingUserId: string,
      opts?: { visibility?: string; limit?: number; offset?: number; isAdmin?: boolean },
    ) {
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;

      const conditions: SQL[] = [
        eq(folders.companyId, companyId),
      ];

      // Admin bypass: skip visibility filtering
      if (!opts?.isAdmin) {
        // Build visibility conditions:
        // - Owner sees all their folders
        // - Public folders are visible to everyone
        // - Team folders are visible if tag overlap exists between owner and requester
        const visibilityCondition = sql`(
          ${folders.ownerUserId} = ${requestingUserId}
          OR ${folders.visibility} = 'public'
          OR (${folders.visibility} = 'team' AND EXISTS (
            SELECT 1 FROM tag_assignments ta1
            JOIN tag_assignments ta2 ON ta1.tag_id = ta2.tag_id
            WHERE ta1.target_type = 'user' AND ta1.target_id = ${folders.ownerUserId}
              AND ta2.target_type = 'user' AND ta2.target_id = ${requestingUserId}
              AND ta1.company_id = ${companyId}
              AND ta2.company_id = ${companyId}
          ))
        )`;

        conditions.push(visibilityCondition);
      }

      if (opts?.visibility) {
        conditions.push(eq(folders.visibility, opts.visibility));
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
     * Update a folder. Only the owner can update.
     */
    async update(
      companyId: string,
      folderId: string,
      input: {
        name?: string;
        description?: string | null;
        icon?: string | null;
        visibility?: "private" | "team" | "public";
      },
      requestingUserId: string,
    ) {
      // Fetch the folder to check ownership
      const [existing] = await db
        .select()
        .from(folders)
        .where(
          and(eq(folders.id, folderId), eq(folders.companyId, companyId)),
        );

      if (!existing) return null;

      if (existing.ownerUserId !== requestingUserId) {
        return { error: "forbidden" as const };
      }

      const now = new Date();
      const updates: Record<string, unknown> = { updatedAt: now };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.visibility !== undefined) updates.visibility = input.visibility;

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
     * Delete a folder. Only the owner can delete.
     * CASCADE deletes folder_items but NOT the underlying artifacts/documents/channels.
     */
    async delete(
      companyId: string,
      folderId: string,
      requestingUserId: string,
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
     * Validates folder access and that the referenced entity exists.
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
        // Touch the folder's updatedAt
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
