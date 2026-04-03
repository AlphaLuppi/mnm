export type IngestionStatus = "pending" | "processing" | "completed" | "failed";

export interface Document {
  id: string;
  companyId: string;
  assetId: string | null;
  title: string;
  mimeType: string;
  byteSize: number | null;
  pageCount: number | null;
  tokenCount: number | null;
  ingestionStatus: IngestionStatus;
  ingestionError: string | null;
  summary: string | null;
  extractedText: string | null;
  metadata: Record<string, unknown> | null;
  createdByUserId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  companyId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  embedding: number[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
