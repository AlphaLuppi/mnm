import { and, eq, asc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  chatContextLinks,
  chatChannels,
  documents,
  artifacts,
  folders,
} from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";

export function chatContextLinkService(db: Db) {
  return {
    async addLink(
      companyId: string,
      channelId: string,
      input: {
        linkType: string;
        documentId?: string | null;
        artifactId?: string | null;
        folderId?: string | null;
        linkedChannelId?: string | null;
      },
      addedByUserId: string,
    ) {
      // Validate the referenced entity exists
      if (input.linkType === "document" && input.documentId) {
        const doc = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(
            eq(documents.id, input.documentId),
            eq(documents.companyId, companyId),
          ))
          .then((rows) => rows[0] ?? null);
        if (!doc) {
          throw new Error("Referenced document not found");
        }
      }

      if (input.linkType === "artifact" && input.artifactId) {
        const art = await db
          .select({ id: artifacts.id })
          .from(artifacts)
          .where(and(
            eq(artifacts.id, input.artifactId),
            eq(artifacts.companyId, companyId),
          ))
          .then((rows) => rows[0] ?? null);
        if (!art) {
          throw new Error("Referenced artifact not found");
        }
      }

      if (input.linkType === "folder" && input.folderId) {
        const fld = await db
          .select({ id: folders.id })
          .from(folders)
          .where(and(
            eq(folders.id, input.folderId),
            eq(folders.companyId, companyId),
          ))
          .then((rows) => rows[0] ?? null);
        if (!fld) {
          throw new Error("Referenced folder not found");
        }
      }

      if (input.linkType === "channel" && input.linkedChannelId) {
        const ch = await db
          .select({ id: chatChannels.id })
          .from(chatChannels)
          .where(and(
            eq(chatChannels.id, input.linkedChannelId),
            eq(chatChannels.companyId, companyId),
          ))
          .then((rows) => rows[0] ?? null);
        if (!ch) {
          throw new Error("Referenced channel not found");
        }
      }

      const [link] = await db
        .insert(chatContextLinks)
        .values({
          channelId,
          companyId,
          linkType: input.linkType,
          documentId: input.documentId ?? null,
          artifactId: input.artifactId ?? null,
          folderId: input.folderId ?? null,
          linkedChannelId: input.linkedChannelId ?? null,
          addedByUserId,
        })
        .returning();

      publishLiveEvent({
        companyId,
        type: "chat.context_linked",
        payload: {
          linkId: link!.id,
          channelId,
          linkType: input.linkType,
          addedByUserId,
        },
      });

      return link!;
    },

    async getLinksForChannel(companyId: string, channelId: string) {
      const links = await db
        .select({
          id: chatContextLinks.id,
          channelId: chatContextLinks.channelId,
          companyId: chatContextLinks.companyId,
          linkType: chatContextLinks.linkType,
          documentId: chatContextLinks.documentId,
          artifactId: chatContextLinks.artifactId,
          folderId: chatContextLinks.folderId,
          linkedChannelId: chatContextLinks.linkedChannelId,
          addedByUserId: chatContextLinks.addedByUserId,
          addedAt: chatContextLinks.addedAt,
          // Join display info
          documentTitle: documents.title,
          artifactTitle: artifacts.title,
          folderName: folders.name,
          linkedChannelName: chatChannels.name,
        })
        .from(chatContextLinks)
        .leftJoin(documents, eq(chatContextLinks.documentId, documents.id))
        .leftJoin(artifacts, eq(chatContextLinks.artifactId, artifacts.id))
        .leftJoin(folders, eq(chatContextLinks.folderId, folders.id))
        .leftJoin(chatChannels, eq(chatContextLinks.linkedChannelId, chatChannels.id))
        .where(
          and(
            eq(chatContextLinks.companyId, companyId),
            eq(chatContextLinks.channelId, channelId),
          ),
        )
        .orderBy(asc(chatContextLinks.addedAt));

      return links;
    },

    async removeLink(companyId: string, channelId: string, linkId: string) {
      await db
        .delete(chatContextLinks)
        .where(
          and(
            eq(chatContextLinks.id, linkId),
            eq(chatContextLinks.channelId, channelId),
            eq(chatContextLinks.companyId, companyId),
          ),
        );
    },
  };
}
