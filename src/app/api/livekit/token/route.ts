import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLiveKitToken } from "@/lib/livekit";

const bodySchema = z.object({
  roomName: z.string().min(1, "roomName is required"),
  participantName: z.string().min(1, "participantName is required"),
  participantIdentity: z.string().min(1, "participantIdentity is required"),
  metadata: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const result = bodySchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 },
      );
    }

    const livekitUrl = process.env.LIVEKIT_URL;
    if (!livekitUrl) {
      return NextResponse.json(
        { error: "Missing LIVEKIT_URL environment variable" },
        { status: 500 },
      );
    }

    const { roomName, participantName, participantIdentity, metadata } =
      result.data;

    const token = await generateLiveKitToken(
      roomName,
      participantName,
      participantIdentity,
      metadata,
    );

    return NextResponse.json({
      token,
      url: livekitUrl,
    });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      {
        error: "Internal server error during token generation",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
