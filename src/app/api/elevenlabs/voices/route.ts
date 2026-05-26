import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getProviderConfig } from "@/lib/firebase/providerConfigs";

async function resolveApiKey(req: NextRequest): Promise<string | null> {
  const configId = req.nextUrl.searchParams.get("configId");
  if (configId) {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const uid = await verifyToken(auth.slice(7));
      if (uid) {
        const config = await getProviderConfig(uid, configId);
        if (config) return config.apiKey;
      }
    }
  }
  return process.env.ELEVENLABS_API_KEY ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "No ElevenLabs API key configured" },
        { status: 400 },
      );
    }

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ElevenLabs API error", status: res.status },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data.voices ?? []);
  } catch (err) {
    console.error("[api/elevenlabs/voices]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
