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
  // Tracks which segmentIds have already triggered translation (interim + final both complete)
  const translatedSegmentsRef = useRef<Set<string>>(new Set());
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localIdentityRef.current = localParticipant?.identity;
  }, [localParticipant?.identity]);

  useEffect(() => {
    if (!room) return;
    let mounted = true;

    // Per LiveKit docs: each segment produces two streams (interim + final) sharing lk.segment_id.
    // We merge them by segment_id so only one bubble appears per utterance.
    // for-await yields delta CHUNKS — we must accumulate them manually.
    const handler = async (reader: any, participantInfo: any) => {
      const segmentId =
        reader.info.attributes?.["lk.segment_id"] || reader.info.id;
      // lk.transcription_final = "false" → interim STT stream (partial text, skip translation)
      // lk.transcription_final = "true"  → final STT stream (complete text, translate)
      // not set                           → agent speech stream (always translate)
      const isInterimStream =
        reader.info.attributes?.["lk.transcription_final"] === "false";
      const isAgent =
        participantInfo.identity !== localIdentityRef.current &&
        !participantInfo.identity.startsWith("phone-");
      const speaker: "Agent" | "Caller" = isAgent ? "Agent" : "Caller";

      // Add entry only if it doesn't exist yet (interim stream arrives first)
      setTranscripts((prev) => {
        if (prev.some((t) => t.segmentId === segmentId)) return prev;
        return [...prev, { segmentId, speaker, text: "", isFinal: false }];
      });

      // Accumulate delta chunks into full text
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

      // Skip translation only for interim CALLER streams (partial STT text).
      // Agent speech may arrive with lk.transcription_final="false" but is always complete — translate it.
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
        // Final call: clears row if English (""), or sets the complete translated text
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
      <div className="bg-neutral-800 px-4 py-2 border-b border-neutral-700 text-sm font-medium text-white flex items-center justify-between">
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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

interface TestCallModalProps {
  agentKey: string;
  onClose: () => void;
}

export function TestCallModal({ agentKey, onClose }: TestCallModalProps) {
  const [token, setToken] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectToAgent = async () => {
    setIsConnecting(true);
    setError("");
    try {
      const roomName = `test-${agentKey}-${Date.now()}`;

      // 1. Get LiveKit Token
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

      // 2. Dispatch Agent to Room
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

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        style={{ width: "min(900px, calc(100vw - 2rem))" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">Test Call</h2>

        {!token ? (
          <div className="flex flex-col items-center py-8">
            <p className="text-neutral-400 text-center mb-6">
              Connect via your browser microphone to test the {agentKey} agent
              directly without placing a phone call.
            </p>
            {error && (
              <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-3 rounded-lg border border-red-900/50">
                {error}
              </div>
            )}
            <button
              onClick={connectToAgent}
              disabled={isConnecting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              {isConnecting && (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              )}
              {isConnecting ? "Connecting..." : "Connect Microphone"}
            </button>
          </div>
        ) : (
          <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl={url}
            connect={true}
            onDisconnected={onClose}
            className="flex flex-col items-center justify-center py-8"
            data-lk-theme="default"
          >
            <div className="bg-neutral-800 rounded-xl p-6 w-full flex flex-col items-center gap-6 border border-neutral-700">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 animate-pulse flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
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
              <p className="text-white font-medium text-center">
                Connected to Agent
              </p>

              <div className="w-full">
                <VoiceAssistantControlBar controls={{ leave: true }} />
                <RoomAudioRenderer />
                <TranscriptView agentKey={agentKey} />
              </div>
            </div>
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
