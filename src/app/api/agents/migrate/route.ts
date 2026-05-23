import { NextRequest, NextResponse } from "next/server";
import {
  migrateAgents,
  migrateCallHistoryJson,
  reKeyCallHistoryDocs,
  backfillPlaygroundFields,
  normalizeCallHistoryDocs,
  migrateAgentDocIds,
} from "@/lib/firebase/migration";

/**
 * POST /api/agents/migrate
 *
 * Runs one or more backfill migrations. Pass `{ target: "agents" | "callHistory" | "all" }`
 * in the body (defaults to "agents" for backwards compatibility).
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
    const body = await req.json().catch(() => ({}));
    const target: string = body.target ?? "agents";

    const results: Record<string, unknown> = {};

    if (target === "agents" || target === "all") {
      results.agents = await migrateAgents();
    }

    if (target === "callHistory" || target === "all") {
      results.callHistory = await migrateCallHistoryJson();
    }

    if (target === "reKeyCallHistory" || target === "all") {
      results.reKeyCallHistory = await reKeyCallHistoryDocs();
    }

    if (target === "backfillPlayground" || target === "all") {
      results.backfillPlayground = await backfillPlaygroundFields();
    }

    if (target === "normalizeCallHistory") {
      results.normalizeCallHistory = await normalizeCallHistoryDocs();
    }

    if (target === "agentDocIds") {
      results.agentDocIds = await migrateAgentDocIds();
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[migrate] failed:", err);
    return NextResponse.json(
      { error: "Migration failed — check server logs." },
      { status: 500 },
    );
  }
}
