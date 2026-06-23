import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION_NAME = "knowledge_base";
export const VECTOR_SIZE = 768; // text-embedding-004 output dimension

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    const url = process.env.QDRANT_URL;
    if (!url) throw new Error("QDRANT_URL is not set");
    _client = new QdrantClient({
      url,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  return _client;
}

/**
 * Ensures the shared knowledge_base collection exists.
 * Safe to call on every ingest — skips creation if already present.
 */
export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient();
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION_NAME);
  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
}
