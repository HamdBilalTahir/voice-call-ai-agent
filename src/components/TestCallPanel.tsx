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
import { Mic, Copy, Check } from "lucide-react";
import { translateToEnglish } from "@/lib/translation";
import { AgentConfig } from "@/lib/agents/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="w-full h-[420px] border border-border rounded-xl overflow-hidden flex flex-col mt-4 bg-card">
      <div className="bg-secondary/60 px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Live transcript
        </span>
        {transcripts.length > 0 && (
          <button
            onClick={copyTranscript}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy transcript"
          >
            {copied ? (
              <>
                <Check className="size-3 text-success" />
                <span className="text-success">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcripts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Waiting for someone to speak…
          </p>
        ) : (
          transcripts.map((t) => {
            const isAgent = t.speaker === "Agent";
            return (
              <div
                key={t.segmentId}
                className={`flex flex-col max-w-[88%] ${
                  isAgent
                    ? "items-start self-start"
                    : "items-end self-end ml-auto"
                }`}
              >
                <span
                  className={`text-[10px] font-semibold mb-1 uppercase tracking-wide ${
                    isAgent ? "text-primary" : "text-success"
                  }`}
                >
                  {isAgent ? "Agent" : "Caller"}
                </span>
                <div
                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    isAgent
                      ? "bg-accent text-accent-foreground border border-primary/10"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  <span>{t.text}</span>
                  {agentKey === "restaurant-es" &&
                    t.isFinal &&
                    t.text.length > 2 &&
                    t.translation !== "" && (
                      <p className="mt-1 italic text-muted-foreground">
                        {t.translation ?? "Translating…"}
                      </p>
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
      <div className="flex flex-col items-center py-8 gap-4">
        <div className="size-14 rounded-full bg-accent flex items-center justify-center">
          <Mic className="size-6 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[240px]">
          Talk to your agent directly — no phone number needed.
        </p>
        {error && (
          <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 px-3 py-2 rounded-lg w-full">
            {error}
          </div>
        )}
        <Button
          onClick={connectToAgent}
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting && (
            <span className="size-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          )}
          {isConnecting ? "Connecting…" : "Start talking"}
        </Button>
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
      <div className="flex flex-col items-center gap-2.5 pt-4">
        <div className="size-11 rounded-full bg-accent flex items-center justify-center">
          <div className="size-8 rounded-full bg-primary animate-pulse flex items-center justify-center">
            <Mic className="size-4 text-white" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground">You&apos;re live</p>
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_INTERNAL_API_SECRET}`,
        },
        body: JSON.stringify({ toNumber: phoneNumber, agentKey }),
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      setPhoneNumber("");
    } catch (e) {
      console.error(e);
      console.error("Error triggering call");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="text-xs text-muted-foreground">
        We&apos;ll call you so you can hear your agent in action.
      </p>
      <Input
        type="tel"
        placeholder="+1 (555) 000-0000"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCall()}
      />
      <Button
        onClick={handleCall}
        disabled={isCalling || !phoneNumber}
        className="w-full"
      >
        {isCalling ? "Calling…" : "Call"}
      </Button>
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
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-border bg-secondary/40">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Try it out
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
