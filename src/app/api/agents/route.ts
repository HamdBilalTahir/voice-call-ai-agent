import { NextResponse } from "next/server";
import { listAgents } from "@/lib/firebase/agents";

export async function GET() {
  const agents = await listAgents();
  return NextResponse.json(agents);
}
