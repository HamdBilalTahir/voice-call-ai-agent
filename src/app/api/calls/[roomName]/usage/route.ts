import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "Usage data not yet available" },
      { status: 404 },
    );
  }
}
