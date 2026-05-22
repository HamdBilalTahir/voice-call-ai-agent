/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Copy,
  Check,
  Mic,
  Phone,
} from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { translateToEnglish } from "@/lib/translation";
import { TestCallModal } from "@/components/TestCallModal";

// ---- Types ------------------------------------------------------------------

interface TranscriptLine {
  segmentId: string;
  speaker: "Agent" | "Caller";
  text: string;
  translation?: string;
  isFinal: boolean;
}

interface PromptSections {
  roleAndResponsibilities: string;
  personaLanguageAndTone: string;
  mistakesToAvoid: string;
  additionalInstructions: string;
}

interface PlaygroundSession {
  id: string;
  agentKey: string;
  agentName: string;
  mode: "web" | "phone";
  startedAt: number;
  lineCount: number;
}

// ---- Constants --------------------------------------------------------------

const COUNTRY_CODES = [
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+92", label: "PK (+92)" },
  { code: "+91", label: "IN (+91)" },
  { code: "+61", label: "AU (+61)" },
  { code: "+49", label: "DE (+49)" },
  { code: "+33", label: "FR (+33)" },
];

const SECTION_LABELS: Record<keyof PromptSections, string> = {
  roleAndResponsibilities: "What it does",
  personaLanguageAndTone: "How it talks",
  mistakesToAvoid: "What to avoid",
  additionalInstructions: "Anything else",
};

const STORAGE_KEY = "playground-sessions";

// ---- Helpers ----------------------------------------------------------------

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function loadSessions(agentKey: string): PlaygroundSession[] {
  if (typeof window === "undefined") return [];
  try {
    const all: PlaygroundSession[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return all.filter((s) => s.agentKey === agentKey).slice(0, 5);
  } catch {
    return [];
  }
}

function persistSession(session: PlaygroundSession): void {
  if (typeof window === "undefined") return;
  try {
    const all: PlaygroundSession[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([session, ...all].slice(0, 20)),
    );
  } catch {
    // ignore
  }
}

// ---- SandboxBanner ----------------------------------------------------------

function SandboxBanner({
  onSave,
  onDiscard,
  saving,
}: {
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-xs">
      <AlertTriangle className="size-3.5 text-warning shrink-0" />
      <span className="flex-1 text-warning font-medium">Unsaved changes</span>
      <button
        onClick={onDiscard}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Discard
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="text-primary font-semibold hover:text-primary/80 transition-colors disabled:opacity-50 ml-1"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// ---- TranscriptCapture (must live inside <LiveKitRoom>) ---------------------

function TranscriptCapture({
  agentKey,
  onUpdate,
}: {
  agentKey: string;
  onUpdate: (lines: TranscriptLine[]) => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const localIdentityRef = useRef<string | undefined>(undefined);
  const translatedRef = useRef<Set<string>>(new Set());
  const linesRef = useRef<TranscriptLine[]>([]);

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

      if (!linesRef.current.some((t) => t.segmentId === segmentId)) {
        linesRef.current = [
          ...linesRef.current,
          { segmentId, speaker, text: "", isFinal: false },
        ];
        onUpdate([...linesRef.current]);
      }

      let accumulated = "";
      for await (const chunk of reader) {
        accumulated += chunk;
        if (!mounted) return;
        linesRef.current = linesRef.current.map((t) =>
          t.segmentId === segmentId ? { ...t, text: accumulated } : t,
        );
        onUpdate([...linesRef.current]);
      }

      if (!mounted) return;
      linesRef.current = linesRef.current.map((t) =>
        t.segmentId === segmentId ? { ...t, isFinal: true } : t,
      );
      onUpdate([...linesRef.current]);

      const skipAsInterim = isInterimStream && !isAgent;
      if (
        agentKey === "restaurant-es" &&
        accumulated.length > 2 &&
        !skipAsInterim &&
        !translatedRef.current.has(segmentId)
      ) {
        translatedRef.current.add(segmentId);
        await translateToEnglish(accumulated, (partial) => {
          linesRef.current = linesRef.current.map((t) =>
            t.segmentId === segmentId ? { ...t, translation: partial } : t,
          );
          onUpdate([...linesRef.current]);
        });
      }
    };

    room.registerTextStreamHandler("lk.transcription", handler);
    return () => {
      mounted = false;
      room.unregisterTextStreamHandler("lk.transcription");
    };
  }, [room, agentKey, onUpdate]);

  return null;
}

// ---- TranscriptPanel (right pane) -------------------------------------------

function TranscriptPanel({
  transcript,
  agentKey,
}: {
  transcript: TranscriptLine[];
  agentKey: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const copyTranscript = () => {
    const text = transcript
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
    <Card className="overflow-hidden flex flex-col" style={{ height: 580 }}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Live transcript
        </span>
        {transcript.length > 0 && (
          <button
            onClick={copyTranscript}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        {transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <Mic className="size-8 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Start a call to see the live transcript here.
            </p>
          </div>
        ) : (
          transcript.map((t) => {
            const isAgent = t.speaker === "Agent";
            return (
              <div
                key={t.segmentId}
                className={`flex flex-col max-w-[90%] ${
                  isAgent ? "self-start" : "self-end ml-auto"
                }`}
              >
                <span
                  className={`text-[10px] font-semibold mb-1 uppercase tracking-wide ${
                    isAgent ? "text-primary" : "text-success"
                  }`}
                >
                  {t.speaker}
                </span>
                <div
                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    isAgent
                      ? "bg-accent text-accent-foreground border border-primary/10"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {t.text}
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
    </Card>
  );
}

// ---- WebTestPanel -----------------------------------------------------------

function WebTestPanel({
  agentKey,
  onTranscriptUpdate,
  onSessionEnd,
}: {
  agentKey: string;
  onTranscriptUpdate: (lines: TranscriptLine[]) => void;
  onSessionEnd: () => void;
}) {
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setIsConnecting(true);
    setError("");
    try {
      await fetch("/api/agents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, action: "start" }),
      });

      const roomName = `playground-${agentKey}-${Date.now()}`;

      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          participantName: "Test User",
          participantIdentity: `test-user-${Math.random().toString(36).slice(7)}`,
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

      onTranscriptUpdate([]);
      setToken(tokenData.token);
      setUrl(tokenData.url);
    } catch (e: any) {
      setError(e.message || "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center py-12 gap-5">
        <div className="size-16 rounded-full bg-accent flex items-center justify-center">
          <Mic className="size-7 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Browser mic test
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
            Hear exactly how your agent sounds — no phone call needed.
          </p>
        </div>
        {error && (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 px-3 py-2 rounded-lg max-w-[260px] text-center">
            {error}
          </p>
        )}
        <Button
          onClick={connect}
          disabled={isConnecting}
          className="gap-2 px-8"
        >
          {isConnecting && (
            <span className="size-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          )}
          {isConnecting ? "Connecting…" : "Start call"}
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
        onSessionEnd();
        await fetch("/api/agents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentKey, action: "stop" }),
        });
      }}
      data-lk-theme="default"
    >
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="size-14 rounded-full bg-accent flex items-center justify-center">
          <div className="size-10 rounded-full bg-primary animate-pulse flex items-center justify-center">
            <Mic className="size-5 text-white" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground">Connected</p>
        <VoiceAssistantControlBar controls={{ leave: true }} />
        <RoomAudioRenderer />
      </div>
      <TranscriptCapture agentKey={agentKey} onUpdate={onTranscriptUpdate} />
    </LiveKitRoom>
  );
}

// ---- PhoneTestPanel ---------------------------------------------------------

function PhoneTestPanel({
  agent,
  agentKey,
}: {
  agent: AgentConfig;
  agentKey: string;
}) {
  const [countryCode, setCountryCode] = useState("+1");
  const [localNumber, setLocalNumber] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [callRoomName, setCallRoomName] = useState("");
  const [dialedNumber, setDialedNumber] = useState("");
  const { toast } = useToast();

  if (agent.direction === "inbound") {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <div className="size-16 rounded-full bg-accent flex items-center justify-center">
          <Phone className="size-7 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Call this number to test
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This agent answers incoming calls on:
          </p>
          {agent.phoneNumber ? (
            <p className="text-xl font-semibold text-foreground mt-2 font-mono tracking-wide">
              {agent.phoneNumber}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              No number assigned yet.{" "}
              <span className="text-primary">
                Add one in Phone &amp; Channels.
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  const handleCall = async () => {
    const fullNumber = `${countryCode}${localNumber.replace(/\s/g, "")}`;
    if (!localNumber.trim()) return;
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
        body: JSON.stringify({ toNumber: fullNumber, agentKey }),
      });
      if (!res.ok) throw new Error("Call failed");
      const data = await res.json();
      setDialedNumber(fullNumber);
      setCallRoomName(data.roomName ?? "");
      setLocalNumber("");
      setModalOpen(true);
    } catch {
      toast({
        message: "Could not place the call. Please try again.",
        variant: "error",
      });
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-12 gap-5">
      <div className="size-16 rounded-full bg-accent flex items-center justify-center">
        <Phone className="size-7 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Phone test</p>
        <p className="text-xs text-muted-foreground mt-1">
          We&apos;ll call your phone with this agent.
        </p>
      </div>
      <div className="flex gap-2 w-full max-w-[320px]">
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="h-9 px-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors shrink-0"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <Input
          type="tel"
          placeholder="Phone number"
          value={localNumber}
          onChange={(e) => setLocalNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCall()}
          className="flex-1"
        />
      </div>
      <Button
        onClick={handleCall}
        disabled={isCalling || !localNumber.trim()}
        className="gap-2 px-8"
      >
        {isCalling && (
          <span className="size-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        )}
        {isCalling ? "Calling…" : "Call me"}
      </Button>

      <TestCallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agent={agent}
        agentKey={agentKey}
        toNumber={dialedNumber}
        roomName={callRoomName}
      />
    </div>
  );
}

// ---- SessionHistory ---------------------------------------------------------

function SessionHistory({ sessions }: { sessions: PlaygroundSession[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent sessions
      </h3>
      <div className="flex flex-col gap-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl"
          >
            <div className="flex items-center gap-3">
              <Clock className="size-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">
                  {s.mode === "web" ? "Browser call" : "Phone call"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {relativeTime(s.startedAt)}
                  {s.lineCount > 0 ? ` · ${s.lineCount} lines` : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">
              {s.mode}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- PlaygroundClient (main) ------------------------------------------------

export function PlaygroundClient({ agents }: { agents: AgentConfig[] }) {
  const searchParams = useSearchParams();
  const initialKey = searchParams.get("agent") ?? agents[0]?.key ?? "";
  const { toast } = useToast();

  const [selectedAgentKey, setSelectedAgentKey] = useState(initialKey);
  const [testMode, setTestMode] = useState<"web" | "phone">("web");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [savedSections, setSavedSections] = useState<PromptSections | null>(
    null,
  );
  const [sandboxSections, setSandboxSections] = useState<PromptSections | null>(
    null,
  );
  const [promptLoading, setPromptLoading] = useState(false);
  const [isSavingSandbox, setIsSavingSandbox] = useState(false);
  const [sessions, setSessions] = useState<PlaygroundSession[]>(() =>
    loadSessions(initialKey),
  );
  const transcriptRef = useRef<TranscriptLine[]>([]);

  const selectedAgent =
    agents.find((a) => a.key === selectedAgentKey) ?? agents[0];

  useEffect(() => {
    if (!selectedAgentKey) return;
    setPromptLoading(true);
    setSavedSections(null);
    setSandboxSections(null);
    setSandboxOpen(false);
    setTranscript([]);
    transcriptRef.current = [];
    setSessions(loadSessions(selectedAgentKey));

    fetch(`/api/agents/${selectedAgentKey}/prompt`)
      .then((r) => r.json())
      .then((data: PromptSections) => {
        setSavedSections(data);
        setSandboxSections(data);
      })
      .finally(() => setPromptLoading(false));
  }, [selectedAgentKey]);

  const hasSandboxChanges =
    savedSections !== null &&
    sandboxSections !== null &&
    JSON.stringify(savedSections) !== JSON.stringify(sandboxSections);

  const handleSaveSandbox = async () => {
    if (!sandboxSections) return;
    setIsSavingSandbox(true);
    try {
      const res = await fetch(`/api/agents/${selectedAgentKey}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sandboxSections),
      });
      if (!res.ok) throw new Error();
      setSavedSections(sandboxSections);
      toast({
        message: "Saved — changes are live in a few seconds.",
        variant: "success",
      });
    } catch {
      toast({
        message: "Couldn't save — check your connection and try again.",
        variant: "error",
      });
    } finally {
      setIsSavingSandbox(false);
    }
  };

  const handleTranscriptUpdate = useCallback((lines: TranscriptLine[]) => {
    transcriptRef.current = lines;
    setTranscript([...lines]);
  }, []);

  const handleSessionEnd = useCallback(() => {
    const session: PlaygroundSession = {
      id: Date.now().toString(),
      agentKey: selectedAgentKey,
      agentName: selectedAgent?.name ?? "",
      mode: testMode,
      startedAt: Date.now(),
      lineCount: transcriptRef.current.filter((t) => t.isFinal).length,
    };
    persistSession(session);
    setSessions(loadSessions(selectedAgentKey));
  }, [selectedAgentKey, selectedAgent, testMode]);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-lg font-semibold text-foreground">No agents yet</p>
        <p className="text-sm text-muted-foreground">
          Create an agent first, then come back to test it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Playground</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test your agent before it goes live. Edits here are sandboxed.
        </p>
      </div>

      {/* 3-pane layout */}
      <div className="flex gap-6 items-start">
        {/* ── Left pane ── */}
        <div className="w-[272px] shrink-0 flex flex-col gap-4">
          {/* Agent picker */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="playground-agent"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Agent
            </label>
            <div className="relative">
              <select
                id="playground-agent"
                value={selectedAgentKey}
                onChange={(e) => setSelectedAgentKey(e.target.value)}
                className="w-full h-9 pl-3 pr-8 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors appearance-none"
              >
                {agents.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {selectedAgent && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedAgent.description}
              </p>
            )}
          </div>

          {/* Sandbox banner */}
          {hasSandboxChanges && (
            <SandboxBanner
              onSave={handleSaveSandbox}
              onDiscard={() => setSandboxSections(savedSections)}
              saving={isSavingSandbox}
            />
          )}

          {/* Instructions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Instructions
              </p>
              <button
                onClick={() => setSandboxOpen((v) => !v)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {sandboxOpen ? "Collapse" : "Edit in sandbox"}
              </button>
            </div>

            {!sandboxOpen ? (
              <div className="px-3 py-2.5 bg-muted/40 border border-border rounded-lg">
                {promptLoading ? (
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {savedSections?.roleAndResponsibilities ||
                      "No instructions yet."}
                  </p>
                )}
              </div>
            ) : promptLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sandboxSections &&
                  (
                    Object.keys(SECTION_LABELS) as Array<keyof PromptSections>
                  ).map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">
                        {SECTION_LABELS[key]}
                      </label>
                      <Textarea
                        value={sandboxSections[key]}
                        onChange={(e) =>
                          setSandboxSections((prev) =>
                            prev ? { ...prev, [key]: e.target.value } : prev,
                          )
                        }
                        className="text-xs font-mono leading-relaxed"
                        style={{ minHeight: "72px" }}
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Center pane ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <Card className="overflow-hidden">
            {/* Mode tabs */}
            <div className="border-b border-border px-4">
              <nav className="flex -mb-px">
                {(["web", "phone"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTestMode(mode)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      testMode === mode
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "web" ? "Web test" : "Phone test"}
                  </button>
                ))}
              </nav>
            </div>

            {/* Test surface — key forces remount on agent change */}
            <div className="px-4">
              {testMode === "web" ? (
                <WebTestPanel
                  key={`web-${selectedAgentKey}`}
                  agentKey={selectedAgentKey}
                  onTranscriptUpdate={handleTranscriptUpdate}
                  onSessionEnd={handleSessionEnd}
                />
              ) : (
                <PhoneTestPanel
                  key={`phone-${selectedAgentKey}`}
                  agent={selectedAgent}
                  agentKey={selectedAgentKey}
                />
              )}
            </div>
          </Card>

          <SessionHistory sessions={sessions} />
        </div>

        {/* ── Right pane ── */}
        <div className="w-[320px] shrink-0">
          <TranscriptPanel
            transcript={transcript}
            agentKey={selectedAgentKey}
          />
        </div>
      </div>
    </div>
  );
}
