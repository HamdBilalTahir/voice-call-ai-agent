import { NextRequest, NextResponse } from "next/server";
import {
  getCallHistory,
  getAgentCallHistory,
  updateCallRecordById,
} from "@/lib/history";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");

    const history = agent
      ? await getAgentCallHistory(agent)
      : (await getCallHistory()).filter((r) => !r.archived).slice(0, 500);

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { ids, updates } = (await request.json()) as {
      ids: string[];
      updates: { archived?: boolean; tags?: string[] };
    };

    if (!Array.isArray(ids)) {
      return NextResponse.json(
        { error: "ids must be an array" },
        { status: 400 },
      );
    }

    for (const id of ids) {
      await updateCallRecordById(id, updates);
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error("Error updating history:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
