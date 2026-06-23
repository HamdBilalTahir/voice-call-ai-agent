import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { verifyLiveKitWebhook } from "@/lib/livekit";
import { getCallRecord, updateCallRecord, type CallUsage } from "@/lib/history";
import { extractCallData } from "@/lib/agents/callExtractor";
import { executePostCallActions } from "@/lib/agents/actionExecutor";

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
    const event: string = json.event ?? "";
    const roomName: string = json.room?.name ?? "";
    // LiveKit room.creation_time is Unix seconds
    const lkCreationTime: number | undefined = json.room?.creation_time
      ? json.room.creation_time * 1000
      : undefined;

    if (event === "room_started" && roomName && lkCreationTime) {
      // Record the exact time LiveKit considers the call to have started.
      // createIfMissing handles inbound calls where no record was pre-created.
      await updateCallRecord(
        roomName,
        { callStartedAt: lkCreationTime },
        { createIfMissing: true },
      );
    }

    if (event === "room_finished" && roomName) {
      // Worker is persistent and shared across calls — do not kill it here.
      const callEndedAt = Date.now();
      const record = await getCallRecord(roomName);
      if (record && record.status === "in-progress") {
        const duration = record.startTime
          ? Math.round((callEndedAt - record.startTime) / 1000)
          : undefined;

        // Read usage file written by the agent worker on session close
        let usage: CallUsage | undefined;
        try {
          const usageFile = path.join(
            process.cwd(),
            ".agent-usage",
            `${roomName}.json`,
          );
          const raw = fs.readFileSync(usageFile, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed.type === "call_usage") {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type: _type, ...rest } = parsed;
            usage = rest as CallUsage;
          }
        } catch {
          // usage file not available — phone calls or calls that ended before agent wrote it
        }

        await updateCallRecord(roomName, {
          status: "completed",
          outcome: "completed",
          endTime: callEndedAt,
          callEndedAt,
          duration,
          ...(lkCreationTime ? { callStartedAt: lkCreationTime } : {}),
          ...(usage ? { usage } : {}),
        });
        console.log(
          `[webhook] room_finished — marked ${roomName} completed (${duration}s)${usage ? ", usage saved" : ""}`,
        );

        // Fire-and-forget post-call extraction — reads the transcript subcollection
        // and runs an LLM pass to extract qualification, tasks, meeting, and messages.
        if (record.id && record.agentKey) {
          extractCallData(record.id, record.agentKey, roomName).catch((err) => {
            console.error("[webhook] post-call extraction failed:", err);
          });
          executePostCallActions(record.id, record.agentKey, roomName).catch(
            (err) => {
              console.error(
                "[webhook] post-call action execution failed:",
                err,
              );
            },
          );
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
