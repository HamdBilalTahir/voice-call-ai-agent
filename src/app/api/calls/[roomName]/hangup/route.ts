import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getCallRecord, updateCallRecord } from "@/lib/history";

type Params = { roomName: string };

// Hangs up a live call from the UI. Deleting the LiveKit room evicts the SIP
// participant, which makes the SIP bridge terminate the underlying PSTN/Twilio
// call (CANCEL while ringing, BYE once answered) and closes the agent session.
// Plain observer disconnect does NOT do this — the call would keep ringing.
export async function POST(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const { roomName } = await params;
  if (!roomName) {
    return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
  }
  try {
    const svc = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    );
    await svc.deleteRoom(roomName);

    // Mark the record completed immediately so the UI/history reflect the hangup
    // without waiting on the room_finished webhook (which may be unreachable).
    try {
      const record = await getCallRecord(roomName);
      if (record && record.status === "in-progress") {
        await updateCallRecord(roomName, {
          status: "completed",
          outcome: "completed",
          endTime: Date.now(),
          callEndedAt: Date.now(),
          ...(record.startTime
            ? { duration: Math.round((Date.now() - record.startTime) / 1000) }
            : {}),
        });
      }
    } catch {
      // Record update is best-effort; the webhook will reconcile.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
