import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { documents, documentChunks, assets } from "@mnm/db";
import { documentService } from "./document.js";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";

export function createIngestionQueue(redisConnection: ConnectionOptions) {
  return new Queue("document-ingestion", { connection: redisConnection });
}

/**
 * Extract text from file buffer based on mime type.
 */
async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<{ text: string | null; pageCount?: number }> {
  // Plain text, markdown, JSON, YAML, code, etc.
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/x-yaml" ||
    mimeType === "application/yaml" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/xml"
  ) {
    return { text: buffer.toString("utf-8") };
  }

  // PDF extraction via pdf-parse
  if (mimeType === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")) as any;
      const parse = typeof pdfParse.default === "function" ? pdfParse.default : pdfParse;
      const result = await parse(buffer);
      return {
        text: result.text || null,
        pageCount: result.numpages ?? undefined,
      };
    } catch (err) {
      logger.warn({ err, mimeType }, "pdf-parse failed; skipping text extraction");
      return { text: null };
    }
  }

  // Unsupported mime types: no extraction
  logger.info({ mimeType }, "No text extraction available for this mime type");
  return { text: null };
}

/**
 * Estimate token count from text (~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks by paragraphs/headings, with a fallback sliding window.
 */
function chunkText(
  text: string,
  maxTokens = 1000,
  overlapTokens = 200,
): string[] {
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  // Try splitting by double newlines (paragraphs) or headings (# lines)
  const segments = text.split(/\n{2,}|(?=^#{1,3}\s)/m).filter((s) => s.trim());

  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    if (current.length + segment.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: keep the tail of the current chunk
      const tail = current.slice(-overlapChars);
      current = tail + segment;
    } else {
      current += (current ? "\n\n" : "") + segment;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If no paragraph-based splitting produced results, use sliding window
  if (chunks.length === 0 && text.length > 0) {
    let offset = 0;
    while (offset < text.length) {
      chunks.push(text.slice(offset, offset + maxChars).trim());
      offset += maxChars - overlapChars;
    }
  }

  return chunks;
}

export function createIngestionWorker(db: Db, redisConnection: ConnectionOptions) {
  return new Worker(
    "document-ingestion",
    async (job) => {
      const { documentId, companyId } = job.data as {
        documentId: string;
        companyId: string;
      };
      const docSvc = documentService(db);

      try {
        // 1. Update status to "extracting"
        await docSvc.updateIngestionStatus(documentId, "extracting");

        // 2. Get document + asset info
        const doc = await db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .then((rows) => rows[0] ?? null);

        if (!doc) {
          throw new Error(`Document ${documentId} not found`);
        }

        let fileBuffer: Buffer | null = null;

        if (doc.assetId) {
          const asset = await db
            .select()
            .from(assets)
            .where(eq(assets.id, doc.assetId))
            .then((rows) => rows[0] ?? null);

          if (asset?.objectKey) {
            // Get file content from storage
            try {
              const { getStorageService } = await import("../storage/index.js");
              const storage = getStorageService();
              if (storage) {
                const result = await storage.getObject(companyId, asset.objectKey);
                const bufferChunks: Buffer[] = [];
                for await (const chunk of result.stream) {
                  bufferChunks.push(
                    Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
                  );
                }
                fileBuffer = Buffer.concat(bufferChunks);
              }
            } catch (err) {
              logger.warn({ err, assetId: doc.assetId }, "Failed to read asset content for ingestion");
            }
          }
        }

        // 3. Extract text
        let extractedText: string | null = null;
        let pageCount: number | undefined;

        if (fileBuffer) {
          const result = await extractText(fileBuffer, doc.mimeType);
          extractedText = result.text;
          pageCount = result.pageCount;
        }

        // 4. Estimate token count
        const tokenCount = extractedText ? estimateTokens(extractedText) : null;

        // 5. If tokenCount > 100_000 -> chunk + embed
        if (tokenCount && tokenCount > 100_000) {
          await docSvc.updateIngestionStatus(documentId, "chunking");

          const chunks = chunkText(extractedText!);

          // Insert chunks
          for (let i = 0; i < chunks.length; i++) {
            const chunkContent = chunks[i]!;
            const chunkTokenCount = estimateTokens(chunkContent);

            // Embedding generation is a stub for now
            logger.info(
              { documentId, chunkIndex: i, chunkTokenCount },
              "Embedding provider not configured; storing chunk with null embedding",
            );

            await db.insert(documentChunks).values({
              documentId,
              companyId,
              chunkIndex: i,
              content: chunkContent,
              tokenCount: chunkTokenCount,
              embedding: null,
              metadata: { sourceDocumentId: documentId },
            });
          }

          // Update document with token count and page count (extracted text not stored for large docs)
          await docSvc.updateIngestionStatus(documentId, "ready", {
            tokenCount,
            pageCount,
          });
        } else {
          // 6. Small doc: store extracted_text on document
          await docSvc.updateIngestionStatus(documentId, "ready", {
            tokenCount: tokenCount ?? undefined,
            pageCount,
            extractedText: extractedText ?? undefined,
          });
        }

        // 8. Publish live event
        publishLiveEvent({
          companyId,
          type: "document.ingestion_complete",
          payload: {
            documentId,
            tokenCount,
            pageCount,
          },
        });

        logger.info(
          { documentId, tokenCount, pageCount },
          "Document ingestion completed",
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error({ err, documentId }, "Document ingestion failed");

        await docSvc.updateIngestionStatus(documentId, "failed", {
          error: errorMessage,
        });

        publishLiveEvent({
          companyId,
          type: "document.ingestion_error",
          payload: {
            documentId,
            error: errorMessage,
          },
        });

        throw err;
      }
    },
    { connection: redisConnection, concurrency: 3 },
  );
}
