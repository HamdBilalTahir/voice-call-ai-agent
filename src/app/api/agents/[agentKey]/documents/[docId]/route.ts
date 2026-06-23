import { NextRequest, NextResponse } from "next/server";
import { deleteDocument } from "@/lib/kb/ingest";

type Params = Promise<{ agentKey: string; docId: string }>;

/**
 * DELETE /api/agents/[agentKey]/documents/[docId]
 *
 * Removes all Qdrant chunks belonging to this document and deletes
 * the Firestore metadata record.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Params },
) {
  const { agentKey, docId } = await params;
  try {
    await deleteDocument(agentKey, docId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[documents/delete] failed:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
