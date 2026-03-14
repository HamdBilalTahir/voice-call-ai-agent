/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState, useRef } from "react";
import { translateToEnglish } from "@/lib/translation";
import { AgentConfig } from "@/lib/agents/registry";

interface TranscriptLine {
  segmentId: string;
  speaker: "Agent" | "Caller";
  text: string;
  translation?: string;
  isFinal: boolean;
}

function TranscriptView({ agentKey }: { agentKey: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdentityRef = useRef<string | undefined>(undefined);
  const translatedSegmentsRef = useRef<Set<string>>(new Set());
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localIdentityRef.current = localParticipant?.identity;
  }, [localParticipant?.identity]);

  useEffect(() => {
    if (!room) return;
    let mounted = true;

    const handler = async (reader: any, participantInfo: any) => {
      const segmentId =
        reader.info.attributes?.["lk.segment_id"] || reader.info.id;
      const isInterimStream =
        reader.info.attributes?.["lk.transcription_final"] === "false";
      const isAgent =
        participantInfo.identity !== localIdentityRef.current &&
        !participantInfo.identity.startsWith("phone-");
      const speaker: "Agent" | "Caller" = isAgent ? "Agent" : "Caller";

      setTranscripts((prev) => {
        if (prev.some((t) => t.segmentId === segmentId)) return prev;
        return [...prev, { segmentId, speaker, text: "", isFinal: false }];
      });

      let accumulated = "";
      for await (const chunk of reader) {
        accumulated += chunk;
        if (!mounted) return;
        setTranscripts((prev) =>
          prev.map((t) =>
            t.segmentId === segmentId ? { ...t, text: accumulated } : t,
          ),
        );
      }

      if (!mounted) return;

      setTranscripts((prev) =>
        prev.map((t) =>
          t.segmentId === segmentId ? { ...t, isFinal: true } : t,
        ),
      );

      const skipAsInterim = isInterimStream && !isAgent;
      if (
        agentKey === "restaurant-es" &&
        accumulated.length > 2 &&
        !skipAsInterim &&
        !translatedSegmentsRef.current.has(segmentId)
      ) {
        translatedSegmentsRef.current.add(segmentId);
        const translation = await translateToEnglish(accumulated, (partial) => {
          setTranscripts((prev) =>
            prev.map((t) =>
              t.segmentId === segmentId ? { ...t, translation: partial } : t,
            ),
          );
        });
        setTranscripts((prev) =>
          prev.map((t) =>
            t.segmentId === segmentId ? { ...t, translation } : t,
          ),
        );
      }
    };

    room.registerTextStreamHandler("lk.transcription", handler);

    return () => {
      mounted = false;
      room.unregisterTextStreamHandler("lk.transcription");
    };
  }, [room, agentKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyTranscript = () => {
    const text = transcripts
      .filter((t) => t.isFinal && t.text.trim())
      .map((t) => `${t.speaker}: ${t.text}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full h-[480px] bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden flex flex-col mt-4">
      <div className="bg-neutral-800 px-5 py-3 border-b border-neutral-700 text-base font-medium text-white flex items-center justify-between">
        <span>Live Transcript</span>
        {transcripts.length > 0 && (
          <button
            onClick={copyTranscript}
            className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
          >
            {copied ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </>
            )}
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {transcripts.length === 0 ? (
          <div className="text-neutral-500 text-center text-sm py-8">
            Waiting for someone to speak...
          </div>
        ) : (
          transcripts.map((t) => {
            const isAgent = t.speaker === "Agent";
            return (
              <div
                key={t.segmentId}
                className={`flex flex-col max-w-[90%] ${
                  isAgent
                    ? "items-start self-start"
                    : "items-end self-end ml-auto"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-medium ${
                      isAgent ? "text-blue-400" : "text-green-400"
                    }`}
                  >
                    {isAgent ? "Agent" : "Caller"}
                  </span>
                </div>
                <div
                  className={`px-3 py-2 rounded-xl text-sm ${
                    isAgent
                      ? "bg-blue-600/20 border border-blue-500/30 text-blue-50"
                      : "bg-neutral-700 border border-neutral-600 text-neutral-50"
                  }`}
                >
                  <div>{t.text}</div>
                  {agentKey === "restaurant-es" &&
                    t.isFinal &&
                    t.text.length > 2 &&
                    t.translation !== "" && (
                      <div className="mt-1 text-xs italic text-neutral-400">
                        {t.translation ?? "Translating..."}
                      </div>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function InboundTestPanel({ agentKey }: { agentKey: string }) {
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectToAgent = async () => {
    setIsConnecting(true);
    setError("");
    try {
      // Ensure the agent process is running before connecting
      await fetch("/api/agents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, action: "start" }),
      });

      const roomName = `test-${agentKey}-${Date.now()}`;

      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          participantName: "Test User",
          participantIdentity: `test-user-${Math.random().toString(36).substring(7)}`,
        }),
      });
      if (!tokenRes.ok) throw new Error("Failed to get token");
      const tokenData = await tokenRes.json();

      const dispatchRes = await fetch("/api/calls/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, agentKey }),
      });
      if (!dispatchRes.ok) throw new Error("Failed to dispatch agent");

      setToken(tokenData.token);
      setUrl(tokenData.url);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to connect to agent");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center py-8 gap-5">
        <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
        <p className="text-sm text-neutral-400 text-center">
          Test this agent via your browser microphone without placing a phone
          call.
        </p>
        {error && (
          <div className="text-red-400 text-xs bg-red-900/20 p-3 rounded-lg border border-red-900/50 w-full">
            {error}
          </div>
        )}
        <button
          onClick={connectToAgent}
          disabled={isConnecting}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isConnecting && (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          )}
          {isConnecting ? "Connecting..." : "Connect Microphone"}
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={url}
      connect={true}
      onDisconnected={async () => {
        setToken("");
        setUrl("");
        await fetch("/api/agents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentKey, action: "stop" }),
        });
      }}
      data-lk-theme="default"
    >
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-blue-600 animate-pulse flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
        </div>
        <p className="text-sm text-white font-medium">Connected to Agent</p>
        <VoiceAssistantControlBar controls={{ leave: true }} />
        <RoomAudioRenderer />
      </div>
      <TranscriptView agentKey={agentKey} />
    </LiveKitRoom>
  );
}

function OutboundCallPanel({ agentKey }: { agentKey: string }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCalling, setIsCalling] = useState(false);

  const handleCall = async () => {
    if (!phoneNumber) return;
    setIsCalling(true);
    try {
      await fetch("/api/agents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, action: "start" }),
      });

      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: phoneNumber, agentKey }),
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      setPhoneNumber("");
    } catch (e) {
      console.error(e);
      alert("Error triggering call");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <p className="text-sm text-neutral-400">
        Enter a phone number to initiate an outbound call.
      </p>
      <input
        type="text"
        placeholder="+1234567890"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCall()}
        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
      />
      <button
        onClick={handleCall}
        disabled={isCalling || !phoneNumber}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg font-medium text-sm transition-colors"
      >
        {isCalling ? "Calling..." : "Call"}
      </button>
    </div>
  );
}

export function TestCallPanel({
  agent,
  agentKey,
}: {
  agent: AgentConfig;
  agentKey: string;
}) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-700">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
          Test Call
        </h2>
      </div>
      <div className="px-4 pb-4">
        {agent.direction === "inbound" ? (
          <InboundTestPanel agentKey={agentKey} />
        ) : (
          <OutboundCallPanel agentKey={agentKey} />
        )}
      </div>
    </div>
  );
}
