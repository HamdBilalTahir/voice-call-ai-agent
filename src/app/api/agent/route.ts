import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyLiveKitWebhook } from "@/lib/livekit";

const dispatchSchema = z.object({
  id: z.string().optional(),
  createdAt: z.number().optional(),
  event: z.string().optional(),
  room: z.object({
    name: z.string(),
  }),
});

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 },
      );
    }

    try {
      verifyLiveKitWebhook(bodyText, authHeader);
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const json = JSON.parse(bodyText);
    const result = dispatchSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid dispatch payload", details: result.error.format() },
        { status: 400 },
      );
    }

    // Acknowledge the dispatch immediately
    // In a production serverless environment, you'd offload this process.
    // In a typical Node.js long-running environment, this starts the agent.
    setTimeout(async () => {
      try {
        // We defer full agent execution here because running the entire worker logic in standard Next.js functions requires fluid compute/proper long polling environments
        console.log("Worker dispatched for room:", result.data.room.name);
      } catch (e) {
        console.error("Agent launch error", e);
      }
    }, 0);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Agent dispatch error:", error);
    return NextResponse.json(
      { error: "Internal server error during agent dispatch" },
      { status: 500 },
    );
  }
}
