import "server-only";
import { randomUUID } from "crypto";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "@/lib/firebase/admin";
import { getQdrantClient, ensureCollection, COLLECTION_NAME } from "./qdrant";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentMetadata {
  docId: string;
  agentKey: string;
  fileName: string;
  chunkCount: number;
  status: "ready" | "processing" | "error";
  uploadedAt: number;
}

// ─── Text chunking ────────────────────────────────────────────────────────────

const MAX_WORDS_PER_CHUNK = 500;
const MIN_WORDS_PER_CHUNK = 50;

export function chunkText(text: string): string[] {
  // Split on double newlines (paragraph boundaries) first
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = "";
  let currentWords = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;

    if (words > MAX_WORDS_PER_CHUNK) {
      // Flush current buffer first
      if (current.trim()) chunks.push(current.trim());
      current = "";
      currentWords = 0;
      // Split oversized paragraph into fixed-size pieces
      const paraWords = para.split(/\s+/);
      for (let i = 0; i < paraWords.length; i += MAX_WORDS_PER_CHUNK) {
        chunks.push(paraWords.slice(i, i + MAX_WORDS_PER_CHUNK).join(" "));
      }
      continue;
    }

    if (currentWords + words > MAX_WORDS_PER_CHUNK && currentWords > 0) {
      if (currentWords >= MIN_WORDS_PER_CHUNK) {
        chunks.push(current.trim());
        current = para;
        currentWords = words;
      } else {
        // Too small to standalone — merge and flush
        current += " " + para;
        chunks.push(current.trim());
        current = "";
        currentWords = 0;
      }
    } else {
      current += (current ? "\n\n" : "") + para;
      currentWords += words;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.split(/\s+/).length >= MIN_WORDS_PER_CHUNK);
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedTexts(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  // Gemini embedding API allows batch requests
  const results = await Promise.all(
    texts.map((t) =>
      model.embedContent({ content: { role: "user", parts: [{ text: t }] } }),
    ),
  );

  return results.map((r) => r.embedding.values);
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

function docMetaRef(agentKey: string, docId: string) {
  return getDb()
    .collection("agents")
    .doc(agentKey)
    .collection("documents")
    .doc(docId);
}

// ─── Main ingest function ─────────────────────────────────────────────────────

export async function ingestPdf(
  agentKey: string,
  fileName: string,
  fileBuffer: Buffer,
): Promise<DocumentMetadata> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const docId = randomUUID();

  // Write pending metadata immediately so the UI can show upload progress
  await docMetaRef(agentKey, docId).set({
    docId,
    agentKey,
    fileName,
    chunkCount: 0,
    status: "processing",
    uploadedAt: Date.now(),
  } satisfies DocumentMetadata);

  try {
    // 1. Extract text from PDF
    const { text } = await pdfParse(fileBuffer);

    // 2. Split into chunks
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No readable text found in PDF");

    // 3. Embed all chunks
    const vectors = await embedTexts(chunks, apiKey);

    // 4. Upsert into Qdrant
    await ensureCollection();
    const client = getQdrantClient();
    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: chunks.map((text, i) => ({
        id: randomUUID(),
        vector: vectors[i],
        payload: { agentKey, docId, chunkIndex: i, text, fileName },
      })),
    });

    // 5. Update Firestore metadata to ready
    const meta: DocumentMetadata = {
      docId,
      agentKey,
      fileName,
      chunkCount: chunks.length,
      status: "ready",
      uploadedAt: Date.now(),
    };
    await docMetaRef(agentKey, docId).set(meta);
    return meta;
  } catch (err) {
    await docMetaRef(agentKey, docId).update({ status: "error" });
    throw err;
  }
}

// ─── Delete a document's chunks from Qdrant + Firestore ──────────────────────

export async function deleteDocument(
  agentKey: string,
  docId: string,
): Promise<void> {
  await ensureCollection();
  const client = getQdrantClient();

  // Delete all Qdrant points that belong to this document
  await client.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [
        { key: "agentKey", match: { value: agentKey } },
        { key: "docId", match: { value: docId } },
      ],
    },
  });

  // Remove Firestore metadata
  await docMetaRef(agentKey, docId).delete();
}

// ─── List documents for an agent ─────────────────────────────────────────────

export async function listDocuments(
  agentKey: string,
): Promise<DocumentMetadata[]> {
  const snap = await getDb()
    .collection("agents")
    .doc(agentKey)
    .collection("documents")
    .orderBy("uploadedAt", "desc")
    .get();

  return snap.docs.map((d) => d.data() as DocumentMetadata);
}
