/**
 * Embedding provider abstraction.
 *
 * Configurable via env vars:
 *   EMBEDDING_MODEL      (default "text-embedding-3-small")
 *   EMBEDDING_PROVIDER   (default "openai")
 *   EMBEDDING_DIMENSIONS (default 1536)
 *   OPENAI_API_KEY       (required for OpenAI provider)
 *
 * Gracefully degrades: when no API key is set, all functions return null
 * and RAG falls back to the first-chunks strategy.
 */

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || "1536", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

function createOpenAIProvider(): EmbeddingProvider {
  return {
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts: string[]): Promise<number[][]> {
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY not configured — cannot generate embeddings");
      }
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI embedding error: ${response.status} ${err}`);
      }
      const data = (await response.json()) as any;
      return data.data.map((d: any) => d.embedding as number[]);
    },
  };
}

let _provider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (_provider) return _provider;
  if (EMBEDDING_PROVIDER === "openai" && OPENAI_API_KEY) {
    _provider = createOpenAIProvider();
    return _provider;
  }
  // No provider configured
  return null;
}

export async function embedText(text: string): Promise<number[] | null> {
  const provider = getEmbeddingProvider();
  if (!provider) return null;
  const [embedding] = await provider.embed([text]);
  return embedding ?? null;
}

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const provider = getEmbeddingProvider();
  if (!provider) return texts.map(() => null);
  // Batch in groups of 100 (OpenAI limit is 2048 but let's be safe)
  const results: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const embeddings = await provider.embed(batch);
    results.push(...embeddings);
  }
  return results;
}
