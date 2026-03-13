import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");

    const livekitHost = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitHost || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 },
      );
    }

    const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    const rooms = await roomService.listRooms();

    // Filter rooms based on the agent if provided
    const filteredRooms = agent
      ? rooms.filter((room) => room.name.startsWith(agent))
      : rooms;

    return NextResponse.json(filteredRooms);
  } catch (error) {
    console.error("Error fetching active rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch active rooms" },
      { status: 500 },
    );
  }
}
