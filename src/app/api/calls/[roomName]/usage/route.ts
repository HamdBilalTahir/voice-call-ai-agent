import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { updateCallRecord, type CallUsage } from "@/lib/history";

type Params = { roomName: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const { roomName } = await params;
  const usageFile = path.join(
    process.cwd(),
    ".agent-usage",
    `${roomName}.json`,
  );
  try {
    const raw = fs.readFileSync(usageFile, "utf-8");
    const parsed = JSON.parse(raw);

    // Persist to Firestore so call history shows cost/tokens even when the
    // room_finished webhook arrived before the worker finished writing the file.
    if (parsed.type === "call_usage") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { type: _type, ...rest } = parsed;
      updateCallRecord(roomName, { usage: rest as CallUsage }).catch(() => {});
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Usage data not yet available" },
      { status: 404 },
    );
  }
}
