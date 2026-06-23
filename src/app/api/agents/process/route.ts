import { NextResponse } from "next/server";
import {
  ensureWorker,
  killWorker,
  removeWorkerMeta,
  resolveAgent,
  readWorkerPid,
  isProcessRunning,
} from "@/lib/agents/workerManager";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentKey = searchParams.get("agentKey");
  if (!agentKey)
    return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

  const agent = await resolveAgent(agentKey);
  if (!agent)
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const pid = readWorkerPid(agentKey);
  const isRunning = pid !== null && isProcessRunning(pid);
  if (!isRunning) removeWorkerMeta(agentKey);
  return NextResponse.json({ isRunning });
}

export async function POST(request: Request) {
  try {
    const { agentKey, action } = await request.json();
    if (!agentKey)
      return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

    if (action === "start") {
      // Idempotent + readiness-blocking: reuses a live worker registered under the
      // current name slug, otherwise spawns one and waits until it has registered
      // with LiveKit before returning. Closes the start/dispatch race.
      const { started } = await ensureWorker(agentKey);
      return NextResponse.json({
        message: started ? "Agent started" : "Agent already running",
        isRunning: true,
      });
    }

    if (action === "stop") {
      const agent = await resolveAgent(agentKey);
      if (!agent)
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      killWorker(agentKey);
      return NextResponse.json({ message: "Agent stopped", isRunning: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error managing agent process:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message === "Agent not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
