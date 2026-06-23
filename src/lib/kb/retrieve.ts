import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getQdrantClient, COLLECTION_NAME } from "./qdrant";

const TOP_K = 10;

async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text: query }] },
  });
  return result.embedding.values;
}

/**
 * Retrieves the most relevant KB chunks for an agent using the kbSearchHint
 * as the search query. Returns formatted text ready to inject into the system prompt.
 * Returns empty string if no documents are indexed or Qdrant is unreachable.
 */
export async function retrieveKBContext(
  agentKey: string,
  kbSearchHint: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !kbSearchHint.trim()) return "";

  try {
    const vector = await embedQuery(kbSearchHint, apiKey);
    const client = getQdrantClient();

    const results = await client.search(COLLECTION_NAME, {
      vector,
      limit: TOP_K,
      filter: {
        must: [{ key: "agentKey", match: { value: agentKey } }],
      },
      with_payload: true,
    });

    if (results.length === 0) return "";

    const chunks = results
      .filter((r) => r.score > 0.3) // discard low-relevance results
      .map((r) => (r.payload as { text: string }).text)
      .filter(Boolean);

    if (chunks.length === 0) return "";

    return `[KNOWLEDGE BASE]\n${chunks.join("\n\n---\n\n")}`;
  } catch (err) {
    // Non-fatal — call proceeds without KB context rather than failing
    console.error("[kb/retrieve] failed:", err);
    return "";
  }
}
