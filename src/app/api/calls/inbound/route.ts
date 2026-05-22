import { NextRequest, NextResponse } from "next/server";
import { AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { z } from "zod";
import { agents } from "@/lib/agents/registry";
import { getAgent } from "@/lib/firebase/agents";
import { buildSystemPrompt } from "@/lib/agents/promptBuilder";

const bodySchema = z.object({
  agentKey: z.string(),
  callerNumber: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  if (bearer !== `Bearer ${process.env.API_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { agentKey, callerNumber } = parsed.data;

  const agent = agents[agentKey];
  if (!agent || agent.direction !== "inbound") {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const roomName = `${agentKey}-${Date.now()}`;

  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );

  await roomService.createRoom({ name: roomName });

  const dispatchClient = new AgentDispatchClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );

  // Build dispatch metadata including the compiled system prompt so the agent
  // worker can load instructions dynamically without a separate Firestore read.
  const dispatchPayload: Record<string, unknown> = { callerNumber };
  try {
    const agentData = await getAgent(agentKey);
    if (agentData) {
      dispatchPayload.systemPrompt = buildSystemPrompt(agentData);
      if (agentData.voiceGreeting?.trim()) {
        dispatchPayload.voiceGreeting = agentData.voiceGreeting.trim();
      }
    }
  } catch (err) {
    console.error(
      "[calls/inbound] prompt fetch failed — using static fallback:",
      err,
    );
  }

  await dispatchClient.createDispatch(roomName, agent.dispatchRuleName, {
    metadata: JSON.stringify(dispatchPayload),
  });

  return NextResponse.json({ roomName });
}
