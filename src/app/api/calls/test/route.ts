/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { AgentDispatchClient } from "livekit-server-sdk";
import { z } from "zod";
import { agents } from "@/lib/agents/registry";

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

    const { roomName, agentKey } = parsed.data;

    const agent = agents[agentKey];
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Dispatch the agent to the specific test room
    // The dispatch name matches the agent's configured dispatchRuleName

    // Add a 5 second timeout to prevent the UI from hanging on "Connecting..." forever
    // if the LiveKit server or dispatch agent is unresponsive
    const dispatchPromise = agentDispatchClient.createDispatch(
      roomName,
      agent.dispatchRuleName,
    );
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Agent dispatch timed out")), 5000);
    });

    await Promise.race([dispatchPromise, timeoutPromise]);

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
