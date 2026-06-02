import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCallHistory,
  getAgentCallHistory,
  updateCallRecordById,
} from "@/lib/history";
import { listAgents } from "@/lib/firebase/agents";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");

    if (agent) {
      const history = await getAgentCallHistory(agent);
      return NextResponse.json(history);
    }

    const uid = (await cookies()).get("__uid")?.value;
    const userAgents = await listAgents(uid);
    const agentKeys = userAgents.map((a) => a.key);

    const history = (await getCallHistory(agentKeys))
      .filter((r) => !r.archived)
      .slice(0, 500);

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
