import { NextRequest, NextResponse } from "next/server";
import { AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { z } from "zod";
import { getAgent } from "@/lib/firebase/agents";
import { buildDispatchMetadata } from "@/lib/agents/promptBuilder";
import { enrichSystemPrompt } from "@/lib/agents/dispatchEnricher";
import { resolveProviderKeys } from "@/lib/firebase/resolveProviderKeys";
import { addCallRecord } from "@/lib/history";

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

  const agentData = await getAgent(agentKey);
  if (!agentData || agentData.direction !== "inbound") {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agentSlug = agentData.name
    ? agentData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : agentKey;
  const timestamp = Date.now();
  const roomName = `${agentSlug}-${callerNumber ?? "inbound"}-${timestamp}`;

  const roomService = new RoomServiceClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );

  const dispatchClient = new AgentDispatchClient(
    process.env.LIVEKIT_URL!,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );

  let dispatchMetadata: string | undefined;
  let pipelineMode: "cascading" | "live_api" = "cascading";
  try {
    const [resolvedKeys, systemPrompt] = await Promise.all([
      resolveProviderKeys(agentData),
      enrichSystemPrompt(agentKey, agentData),
    ]);
    dispatchMetadata = buildDispatchMetadata(
      agentData,
      { callerNumber, systemPrompt },
      resolvedKeys,
    );
    pipelineMode = agentData.voiceSettings?.useLiveApi
      ? "live_api"
      : "cascading";
  } catch (err) {
    console.error("[calls/inbound] failed to build dispatch metadata:", err);
  }

  // Write call record before creating the room so webhooks always find it
  await addCallRecord({
    id: roomName,
    roomName,
    agentKey,
    agentId: agentKey,
    phoneNumber: callerNumber,
    startTime: timestamp,
    status: "in-progress",
    direction: "inbound",
    pipelineMode,
  });

  await roomService.createRoom({ name: roomName });
  await dispatchClient.createDispatch(roomName, agentData.dispatchRuleName, {
    metadata: dispatchMetadata ?? JSON.stringify({ callerNumber }),
  });

  return NextResponse.json({ roomName });
}
