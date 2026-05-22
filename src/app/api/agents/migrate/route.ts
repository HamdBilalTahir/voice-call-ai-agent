import { NextRequest, NextResponse } from "next/server";
import { migrateAgents } from "@/lib/firebase/migration";

/**
 * POST /api/agents/migrate
 *
 * One-time backfill that parses legacy voiceInstructions documents into the four
 * structured section fields. Safe to run multiple times — already-populated agents
 * are skipped.
 *
 * Requires the INTERNAL_API_SECRET header for authorization.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (
    !process.env.INTERNAL_API_SECRET ||
    auth !== `Bearer ${process.env.INTERNAL_API_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await migrateAgents();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[migrate] failed:", err);
    return NextResponse.json(
      { error: "Migration failed — check server logs." },
      { status: 500 },
    );
  }
}
