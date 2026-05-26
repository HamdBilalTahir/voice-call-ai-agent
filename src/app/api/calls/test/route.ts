/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { AgentDispatchClient } from "livekit-server-sdk";
import { z } from "zod";
import { agents } from "@/lib/agents/registry";
import { getAgent } from "@/lib/firebase/agents";
import { buildDispatchMetadata } from "@/lib/agents/promptBuilder";
import { resolveProviderKeys } from "@/lib/firebase/resolveProviderKeys";
import { addCallRecord } from "@/lib/history";

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

    // For dynamic agents not in the static registry, look up dispatch rule from Firestore
    let dispatchRuleName: string;
    if (agents[agentKey]) {
      dispatchRuleName = agents[agentKey].dispatchRuleName;
    } else {
      const agentData = await getAgent(agentKey);
      if (!agentData) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      dispatchRuleName = agentData.dispatchRuleName;
    }

    // Build dispatch metadata with compiled prompt so the agent worker can
    // serve dynamic instructions without a separate Firestore read at runtime.
    let dispatchMetadata: string | undefined;
    let pipelineMode: "cascading" | "live_api" = "cascading";
    try {
      const agentData = await getAgent(agentKey);
      if (agentData) {
        const resolvedKeys = await resolveProviderKeys(agentData);
        dispatchMetadata = buildDispatchMetadata(agentData, {}, resolvedKeys);
        pipelineMode = agentData.voiceSettings?.useLiveApi
          ? "live_api"
          : "cascading";
      }
    } catch (err) {
      console.error(
        "[calls/test] prompt fetch failed — using static fallback:",
        err,
      );
    }
    console.info("[Pipeline] dispatch", { pipelineMode, agentKey, roomName });

    // Add a 5 second timeout to prevent the UI from hanging on "Connecting..." forever
    // if the LiveKit server or dispatch agent is unresponsive
    const dispatchPromise = agentDispatchClient.createDispatch(
      roomName,
      dispatchRuleName,
      dispatchMetadata ? { metadata: dispatchMetadata } : undefined,
    );
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Agent dispatch timed out")), 5000);
    });

    await Promise.race([dispatchPromise, timeoutPromise]);

    // Record playground browser test in call history
    try {
      await addCallRecord({
        id: roomName,
        roomName,
        agentKey,
        agentId: agentKey,
        startTime: Date.now(),
        status: "in-progress",
        isPlayground: true,
        testType: "widget",
        pipelineMode,
      });
    } catch (err) {
      console.error("[calls/test] failed to write call record:", err);
    }

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
