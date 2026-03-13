"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Room, RoomEvent } from "livekit-client";
import { agents } from "@/lib/agents/registry";

interface PageProps {
  params: Promise<{
    roomName: string;
  }>;
}

interface TranscriptLine {
  id: string;
  speaker: "Agent" | "Caller";
  text: string;
  timestamp: number;
}

export default function TranscriptPage({ params }: PageProps) {
  const router = useRouter();
  const { roomName } = use(params);

  // Derive agent from roomName prefix (e.g. sales-en-someid)
  const agentKey = Object.keys(agents).find((key) => roomName.startsWith(key));
  const agent = agentKey ? agents[agentKey] : null;

  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [isEnded, setIsEnded] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let mounted = true;

    const connectToRoom = async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            participantName: "Dashboard Observer",
            participantIdentity: `observer-${Math.random().toString(36).substring(7)}`,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to get token");
        }

        const { token, url } = await res.json();

        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (topic === "transcript") {
            try {
              const data = JSON.parse(new TextDecoder().decode(payload));
              const text = data.text;
              const isAgent =
                data.isAgent ||
                participant?.identity.includes("agent") ||
                data.participantIdentity?.includes("agent");

              setTranscripts((prev) => [
                ...prev,
                {
                  id: Math.random().toString(36).substring(7),
                  speaker: isAgent ? "Agent" : "Caller",
                  text,
                  timestamp: Date.now(),
                },
              ]);
            } catch (e) {
              console.error("Error parsing transcript:", e);
            }
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (mounted) setIsEnded(true);
        });

        await room.connect(url, token);
      } catch (err: any) {
        console.error(err);
        if (mounted) setError(err.message || "Failed to connect");
      }
    };

    connectToRoom();

    return () => {
      mounted = false;
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [roomName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-12rem)] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (agent) {
                router.push(`/agents/${agent.direction}/${agent.key}`);
              } else {
                router.push("/");
              }
            }}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Live Transcript</h1>
            <p className="text-sm text-neutral-400">
              Room: {roomName} {agent && `• Agent: ${agent.description}`}
            </p>
          </div>
        </div>
        {isEnded && (
          <span className="px-3 py-1 bg-neutral-800 text-neutral-400 rounded-full text-sm font-medium border border-neutral-700">
            Call Ended
          </span>
        )}
      </div>

      <div className="flex-1 bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden flex flex-col">
        {error && (
          <div className="p-4 bg-red-900/50 border-b border-red-800 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {transcripts.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-3">
              {!isEnded && (
                <div className="w-8 h-8 border-2 border-neutral-600 border-t-blue-500 rounded-full animate-spin" />
              )}
              <p>
                {isEnded
                  ? "No transcript data received."
                  : "Waiting for conversation to start..."}
              </p>
            </div>
          ) : (
            transcripts.map((line) => (
              <div
                key={line.id}
                className={`flex flex-col max-w-[80%] ${
                  line.speaker === "Agent"
                    ? "items-start self-start"
                    : "items-end self-end ml-auto"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium ${
                      line.speaker === "Agent"
                        ? "text-blue-400"
                        : "text-green-400"
                    }`}
                  >
                    {line.speaker}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {new Date(line.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    line.speaker === "Agent"
                      ? "bg-blue-600/20 border border-blue-500/30 text-blue-50"
                      : "bg-neutral-700 border border-neutral-600 text-neutral-50"
                  }`}
                >
                  {line.text}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
