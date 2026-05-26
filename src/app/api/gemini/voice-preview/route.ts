import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getProviderConfig } from "@/lib/firebase/providerConfigs";

const SAMPLE_TEXT = "Hello! I'm ready to help. How can I assist you today?";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Server-side cache keyed by "voice:apiKeyPrefix" — avoids re-generating
// the same clip on every request. Cleared on server restart.
const wavCache = new Map<string, Buffer>();

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
  return process.env.GEMINI_API_KEY ?? null;
}

function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get("voice");
  if (!voice) {
    return NextResponse.json({ error: "Missing voice param" }, { status: 400 });
  }

  const apiKey = await resolveApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini API key configured" },
      { status: 400 },
    );
  }

  // Cache key scoped to voice + first 8 chars of API key (different keys → different voices bucket)
  const cacheKey = `${voice}:${apiKey.slice(0, 8)}`;
  const cached = wavCache.get(cacheKey);
  if (cached) {
    return new Response(cached.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SAMPLE_TEXT }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Gemini API error", detail: body },
        { status: res.status },
      );
    }

    const data = await res.json();
    const audioBase64: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      return NextResponse.json(
        { error: "No audio in response" },
        { status: 500 },
      );
    }

    const pcm = Buffer.from(audioBase64, "base64");
    const wav = pcmToWav(pcm);
    wavCache.set(cacheKey, wav);

    return new Response(wav.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[api/gemini/voice-preview]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
