import { NextResponse } from "next/server";
import { getCallRecord, updateCallRecord } from "@/lib/history";

type Params = { roomName: string };

// Client-side fallback: marks a call "completed" if the room_finished webhook
// hasn't already done it. Called from PlaygroundClient ~15s after disconnect
// to cover cases where the webhook URL was unreachable (e.g. ngrok not running).
export async function POST(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const { roomName } = await params;
  try {
    const record = await getCallRecord(roomName);
    if (!record) return NextResponse.json({ skipped: "not found" });
    if (record.status !== "in-progress")
      return NextResponse.json({ skipped: "already completed" });
    await updateCallRecord(roomName, {
      status: "completed",
      outcome: "completed",
      endTime: Date.now(),
      callEndedAt: Date.now(),
      ...(record.startTime
        ? { duration: Math.round((Date.now() - record.startTime) / 1000) }
        : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
