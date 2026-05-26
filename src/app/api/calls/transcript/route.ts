import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase/admin";

export interface TranscriptTurn {
  speaker: "agent" | "user";
  text: string;
  ts: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const callId = searchParams.get("callId");
  if (!callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  try {
    const snap = await getDb()
      .collection("callHistory")
      .doc(callId)
      .collection("transcripts")
      .orderBy("ts", "asc")
      .get();

    const turns: TranscriptTurn[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        speaker: data.speaker as "agent" | "user",
        text: data.text as string,
        ts: data.ts as number,
      };
    });

    return NextResponse.json({ turns });
  } catch (err) {
    console.error("[transcript] fetch failed", err);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 },
    );
  }
}
