import { NextResponse } from "next/server";
import { getAgentCallHistory } from "@/lib/history";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");

    if (!agent) {
      return NextResponse.json({ error: "Agent is required" }, { status: 400 });
    }

    const history = getAgentCallHistory(agent);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
