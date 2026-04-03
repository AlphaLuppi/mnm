import { eq, and, sql, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { documents, documentChunks, chatContextLinks, artifacts } from "@mnm/db";
import { logger } from "../middleware/logger.js";

export function ragService(db: Db) {
  return {
    /**
     * Search document chunks using pgvector cosine similarity.
     * Returns top-K most similar chunks to the query embedding.
     */
    async searchChunks(
      companyId: string,
      documentIds: string[],
      queryEmbedding: number[],
      opts?: { topK?: number; threshold?: number },
    ) {
      const topK = opts?.topK ?? 5;
      const threshold = opts?.threshold ?? 0.0;

      if (documentIds.length === 0 || queryEmbedding.length === 0) {
        return [];
      }

      const vectorStr = `[${queryEmbedding.join(",")}]`;

      const result = await db.execute(sql`
        SELECT
          id,
          document_id,
          chunk_index,
          content,
          token_count,
          metadata,
          1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM document_chunks
        WHERE document_id = ANY(${documentIds})
          AND company_id = ${companyId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${topK}
      `);

      type ChunkRow = {
        id: string;
        document_id: string;
        chunk_index: number;
        content: string;
        token_count: number | null;
        metadata: Record<string, unknown> | null;
        similarity: number;
      };
      const raw = result as unknown as { rows?: ChunkRow[] } | ChunkRow[];
      const rows: ChunkRow[] = Array.isArray(raw) ? raw : (raw.rows ?? []);

      return rows
        .filter((row) => row.similarity >= threshold)
        .map((row) => ({
          id: row.id,
          documentId: row.document_id,
          chunkIndex: row.chunk_index,
          content: row.content,
          tokenCount: row.token_count,
          metadata: row.metadata,
          similarity: row.similarity,
        }));
    },

    /**
     * Build RAG context for a chat channel by gathering linked documents and artifacts.
     * This assembles relevant content from context-linked items.
     */
    async buildContextFromChannel(
      companyId: string,
      channelId: string,
      queryText: string,
    ): Promise<string> {
      // 1. Get all chat_context_links for this channel
      const links = await db
        .select()
        .from(chatContextLinks)
        .where(
          and(
            eq(chatContextLinks.channelId, channelId),
            eq(chatContextLinks.companyId, companyId),
          ),
        );

      if (links.length === 0) {
        return "";
      }

      const contextParts: string[] = [];

      // 2. Process linked documents
      const docIds = links
        .filter((l) => l.linkType === "document" && l.documentId)
        .map((l) => l.documentId!);

      if (docIds.length > 0) {
        const docs = await db
          .select()
          .from(documents)
          .where(
            and(
              inArray(documents.id, docIds),
              eq(documents.companyId, companyId),
            ),
          );

        for (const doc of docs) {
          // If small doc with extracted_text, include it
          if (doc.extractedText) {
            contextParts.push(
              `--- Document: ${doc.title} ---\n${doc.extractedText}`,
            );
            continue;
          }

          // If has chunks, use first few chunks as context (stub: no embedding search yet)
          const chunks = await db
            .select()
            .from(documentChunks)
            .where(
              and(
                eq(documentChunks.documentId, doc.id),
                eq(documentChunks.companyId, companyId),
              ),
            )
            .orderBy(documentChunks.chunkIndex)
            .limit(5);

          if (chunks.length > 0) {
            const chunkText = chunks.map((c) => c.content).join("\n\n");
            contextParts.push(
              `--- Document: ${doc.title} (first ${chunks.length} chunks) ---\n${chunkText}`,
            );
          }
        }
      }

      // 3. Process linked artifacts (include current version content)
      const artifactIds = links
        .filter((l) => l.linkType === "artifact" && l.artifactId)
        .map((l) => l.artifactId!);

      if (artifactIds.length > 0) {
        const artifactRows = await db
          .select()
          .from(artifacts)
          .where(
            and(
              inArray(artifacts.id, artifactIds),
              eq(artifacts.companyId, companyId),
            ),
          );

        for (const artifact of artifactRows) {
          contextParts.push(
            `--- Artifact: ${artifact.title} (type: ${artifact.artifactType}) ---`,
          );
        }
      }

      if (contextParts.length === 0) {
        logger.info(
          { channelId, linkCount: links.length },
          "Context links found but no extractable content available",
        );
      }

      return contextParts.join("\n\n");
    },
  };
}
