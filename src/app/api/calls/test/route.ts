import { NextResponse } from "next/server";
import { AgentDispatchClient } from "livekit-server-sdk";
import { z } from "zod";

const testCallSchema = z.object({
  agentKey: z.string().min(1),
  roomName: z.string().min(1),
});

const agentDispatchClient = new AgentDispatchClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = testCallSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { roomName } = parsed.data;

    // Dispatch the agent to the specific test room
    // The "voice-agent" name matches the dispatch rules/setup for the SDK
    await agentDispatchClient.createDispatch(roomName, "voice-agent");

    return NextResponse.json({
      success: true,
      message: "Agent dispatched to test room successfully",
    });
  } catch (error: any) {
    console.error("Failed to dispatch test call:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
