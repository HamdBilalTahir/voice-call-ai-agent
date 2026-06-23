import { NextRequest, NextResponse } from "next/server";
import { ingestPdf, listDocuments } from "@/lib/kb/ingest";

type Params = Promise<{ agentKey: string }>;

const MAX_FILE_SIZE_MB = 20;

/**
 * POST /api/agents/[agentKey]/documents
 *
 * Accepts a multipart form upload with a single "file" field (PDF only).
 * Extracts text, chunks it, embeds via Gemini, and stores in Qdrant.
 * Returns the document metadata on success.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { agentKey } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 },
    );
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = await ingestPdf(agentKey, file.name, buffer);
    return NextResponse.json(meta, { status: 201 });
  } catch (err) {
    console.error("[documents/upload] failed:", err);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}

/**
 * GET /api/agents/[agentKey]/documents
 *
 * Returns all documents indexed for this agent, newest first.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { agentKey } = await params;
  try {
    const docs = await listDocuments(agentKey);
    return NextResponse.json({ documents: docs });
  } catch (err) {
    console.error("[documents/list] failed:", err);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 },
    );
  }
}
