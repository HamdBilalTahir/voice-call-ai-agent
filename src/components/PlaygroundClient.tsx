/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import {
  ChevronDown,
  Copy,
  Check,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
} from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { translateToEnglish } from "@/lib/translation";
import { TestCallModal } from "@/components/TestCallModal";
import { type UsageData, calculateCost, formatCost } from "@/lib/pricing";

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
  voiceGreeting: string;
}

// ---- Constants --------------------------------------------------------------

const COUNTRY_CODES = [
  // ── Frequently used ──────────────────────────────────────────────
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+92", label: "PK (+92)" },
  { code: "+91", label: "IN (+91)" },
  { code: "+61", label: "AU (+61)" },
  { code: "+49", label: "DE (+49)" },
  { code: "+33", label: "FR (+33)" },
  // ── Middle East & North Africa ───────────────────────────────────
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+973", label: "Bahrain (+973)" },
  { code: "+965", label: "Kuwait (+965)" },
  { code: "+968", label: "Oman (+968)" },
  { code: "+962", label: "Jordan (+962)" },
  { code: "+961", label: "Lebanon (+961)" },
  { code: "+20", label: "Egypt (+20)" },
  { code: "+212", label: "Morocco (+212)" },
  { code: "+216", label: "Tunisia (+216)" },
  { code: "+213", label: "Algeria (+213)" },
  { code: "+90", label: "Turkey (+90)" },
  { code: "+972", label: "Israel (+972)" },
  { code: "+98", label: "Iran (+98)" },
  { code: "+964", label: "Iraq (+964)" },
  // ── Europe ───────────────────────────────────────────────────────
  { code: "+353", label: "Ireland (+353)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+32", label: "Belgium (+32)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+43", label: "Austria (+43)" },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)" },
  { code: "+45", label: "Denmark (+45)" },
  { code: "+358", label: "Finland (+358)" },
  { code: "+48", label: "Poland (+48)" },
  { code: "+420", label: "Czechia (+420)" },
  { code: "+30", label: "Greece (+30)" },
  { code: "+40", label: "Romania (+40)" },
  { code: "+36", label: "Hungary (+36)" },
  { code: "+380", label: "Ukraine (+380)" },
  { code: "+7", label: "Russia/KZ (+7)" },
  // ── Asia-Pacific ─────────────────────────────────────────────────
  { code: "+86", label: "China (+86)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+886", label: "Taiwan (+886)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+62", label: "Indonesia (+62)" },
  { code: "+63", label: "Philippines (+63)" },
  { code: "+66", label: "Thailand (+66)" },
  { code: "+84", label: "Vietnam (+84)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+94", label: "Sri Lanka (+94)" },
  { code: "+977", label: "Nepal (+977)" },
  { code: "+93", label: "Afghanistan (+93)" },
  { code: "+64", label: "New Zealand (+64)" },
  // ── Americas ─────────────────────────────────────────────────────
  { code: "+52", label: "Mexico (+52)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+54", label: "Argentina (+54)" },
  { code: "+56", label: "Chile (+56)" },
  { code: "+57", label: "Colombia (+57)" },
  { code: "+51", label: "Peru (+51)" },
  // ── Africa ───────────────────────────────────────────────────────
  { code: "+27", label: "South Africa (+27)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+254", label: "Kenya (+254)" },
  { code: "+233", label: "Ghana (+233)" },
  { code: "+251", label: "Ethiopia (+251)" },
];

// Searchable country-code combobox. Native <select> can't host a search box, so
// this is a lightweight button + popover with a filter input. Matches on both the
// label and the dial code (so "92", "pk", or "pakistan" all find +92).
function CountryCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRY_CODES.find((c) => c.code === value);

  const filtered = COUNTRY_CODES.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    // Match on label or dial code; bare digits ("92") and "+92" both work since
    // the code string contains the digits.
    return c.label.toLowerCase().includes(q) || c.code.includes(q);
  });

  // Anchor the (portaled) popover to the trigger button. fixed-positioned via
  // viewport coordinates so it escapes the surrounding Card's overflow-hidden.
  const updatePos = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: 240 });
  }, []);

  // Close on outside click / Escape; keep the popover aligned on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  // Focus the search field when the popover opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) {
            setQuery("");
            updatePos();
          }
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-9 px-2 flex items-center gap-1 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-border">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search country or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-white px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
              />
            </div>
            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  No matches
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.code === value}
                      onClick={() => {
                        onChange(c.code);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-muted/60 transition-colors ${
                        c.code === value ? "bg-muted/40 font-medium" : ""
                      }`}
                    >
                      <span>{c.label}</span>
                      {c.code === value && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

const SECTION_LABELS: Record<keyof PromptSections, string> = {
  roleAndResponsibilities: "What it does",
  personaLanguageAndTone: "How it talks",
  mistakesToAvoid: "What to avoid",
  additionalInstructions: "Anything else",
  voiceGreeting: "Opening line",
};

// ---- Helpers ----------------------------------------------------------------

// ---- TranscriptCapture (must live inside <LiveKitRoom>) ---------------------

function TranscriptCapture({
  agentKey,
  translateEnabled,
  onUpdate,
}: {
  agentKey: string;
  translateEnabled?: boolean;
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
      try {
        for await (const chunk of reader) {
          accumulated += chunk;
          if (!mounted) return;
          linesRef.current = linesRef.current.map((t) =>
            t.segmentId === segmentId ? { ...t, text: accumulated } : t,
          );
          onUpdate([...linesRef.current]);
        }
      } catch {
        // Agent disconnected mid-stream (DataStreamError) — mark segment final
        // with whatever text was accumulated so far and stop reading.
        if (mounted && accumulated) {
          linesRef.current = linesRef.current.map((t) =>
            t.segmentId === segmentId ? { ...t, isFinal: true } : t,
          );
          onUpdate([...linesRef.current]);
        }
        return;
      }

      if (!mounted) return;
      linesRef.current = linesRef.current.map((t) =>
        t.segmentId === segmentId ? { ...t, isFinal: true } : t,
      );
      onUpdate([...linesRef.current]);

      const skipAsInterim = isInterimStream && !isAgent;
      if (
        translateEnabled &&
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
  }, [room, agentKey, onUpdate, translateEnabled]);

  return null;
}

// ---- TranscriptPanel (right pane) -------------------------------------------

function TranscriptPanel({
  transcript,
  translateEnabled,
}: {
  transcript: TranscriptLine[];
  translateEnabled?: boolean;
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
                  {translateEnabled &&
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

// ---- CostPanel --------------------------------------------------------------

function CostPanel({
  usage,
  loading,
}: {
  usage: UsageData | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Cost estimate
        </p>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </Card>
    );
  }
  if (!usage) return null;
  const cost = calculateCost(usage);
  const durationSec = Math.round(usage.callDurationMs / 1000);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cost estimate
        </p>
        <p className="text-xs text-muted-foreground">{duration}</p>
      </div>

      <div className="flex flex-col divide-y divide-border text-xs">
        {/* LLM */}
        <div className="py-2 flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="font-medium text-foreground">LLM</span>
            <span className="text-foreground font-medium">
              {formatCost(cost.llm.total)}
            </span>
          </div>
          <span className="text-muted-foreground">
            {usage.inputTokens.toLocaleString()} in ·{" "}
            {usage.outputTokens.toLocaleString()} out tokens
          </span>
        </div>

        {/* STT */}
        <div className="py-2 flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="font-medium text-foreground">STT</span>
            <span className="text-foreground font-medium">
              {formatCost(cost.stt.total)}
            </span>
          </div>
          <span className="text-muted-foreground">
            {(usage.sttAudioMs / 60000).toFixed(2)} min audio
          </span>
        </div>

        {/* TTS */}
        <div className="py-2 flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="font-medium text-foreground">TTS</span>
            <span className="text-foreground font-medium">
              {formatCost(cost.tts.total)}
            </span>
          </div>
          <span className="text-muted-foreground">
            {usage.ttsCharacters.toLocaleString()} chars ·{" "}
            {(usage.ttsAudioMs / 1000).toFixed(1)}s audio
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-xs font-semibold text-foreground">Total</span>
        <span className="text-sm font-bold text-foreground">
          {formatCost(cost.total)}
        </span>
      </div>
      <div className="flex items-center justify-between -mt-2">
        <span className="text-xs text-muted-foreground">Per minute</span>
        <span className="text-xs font-semibold text-primary">
          {formatCost(cost.perMinute)}/min
        </span>
      </div>
    </Card>
  );
}

// ---- WebTestPanel -----------------------------------------------------------

function WebTestPanel({
  agentKey,
  translateEnabled,
  onTranscriptUpdate,
  onUsage,
  onCallEnded,
}: {
  agentKey: string;
  translateEnabled?: boolean;
  onTranscriptUpdate: (lines: TranscriptLine[]) => void;
  onUsage: (u: UsageData) => void;
  onCallEnded: () => void;
}) {
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const roomNameRef = useRef<string>("");

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
      roomNameRef.current = roomName;

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
        onCallEnded();
        await fetch("/api/agents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentKey, action: "stop" }),
        });
        // Poll for usage file — agent writes it on session close (async after disconnect)
        const room = roomNameRef.current;
        if (!room) return;
        let attempts = 0;
        const tryFetch = async () => {
          try {
            const res = await fetch(`/api/calls/${room}/usage`);
            if (res.ok) {
              const data = await res.json();
              if (data.type === "call_usage") {
                onUsage(data);
                return;
              }
            }
          } catch {}
          if (++attempts < 5) setTimeout(tryFetch, 1500);
        };
        setTimeout(tryFetch, 2000);
        // Fallback: mark the call completed from the client side after 15s
        // in case the room_finished webhook was unreachable (e.g. no tunnel).
        // The API route is a no-op if the webhook already updated the status.
        setTimeout(() => {
          fetch(`/api/calls/${room}/complete`, { method: "POST" }).catch(
            () => {},
          );
        }, 15000);
      }}
    >
      <WebCallWidget />
      <RoomAudioRenderer />
      <TranscriptCapture
        agentKey={agentKey}
        translateEnabled={translateEnabled}
        onUpdate={onTranscriptUpdate}
      />
    </LiveKitRoom>
  );
}

// ---- WebCallWidget ----------------------------------------------------------
// Rendered inside <LiveKitRoom> so hooks can access the room context.

function WebCallWidget() {
  const { state: agentState, agent } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const micEnabled = localParticipant?.isMicrophoneEnabled ?? true;

  // Track whether the agent participant was ever present so we don't react to
  // the initial undefined state before the agent has joined.
  const agentWasPresent = useRef(false);
  useEffect(() => {
    if (agent !== undefined) agentWasPresent.current = true;
  }, [agent]);

  // When the agent worker closes server-side (e.g. farewell detection calling
  // ctx.room.disconnect()), the agent participant leaves the room. The browser
  // client stays connected so onDisconnected never fires naturally. Detect the
  // agent participant becoming undefined (left the room) and self-disconnect.
  // The cleanup function cancels the timer if the agent reconnects before 3s
  // (covers brief WebSocket drop/reconnect scenarios).
  useEffect(() => {
    if (agent === undefined && agentWasPresent.current) {
      const timer = setTimeout(() => {
        try {
          room.disconnect();
        } catch {
          /* already disconnecting */
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [agent, room]);

  const isSpeaking = agentState === "speaking";
  const isThinking = agentState === "thinking";

  const statusLabel: Record<string, string> = {
    listening: "Listening",
    thinking: "Thinking…",
    speaking: "Speaking",
    initializing: "Starting…",
    connecting: "Connecting…",
    disconnected: "Disconnected",
  };
  const label = statusLabel[agentState] ?? "Live";

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      {/* Agent state indicator */}
      <div className="relative flex items-center justify-center size-20">
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        )}
        <div
          className={`size-20 rounded-full flex items-center justify-center transition-colors duration-300 ${
            isSpeaking ? "bg-primary/15" : "bg-muted"
          }`}
        >
          <div
            className={`size-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
              isSpeaking
                ? "bg-primary"
                : isThinking
                  ? "bg-primary/50"
                  : "bg-primary/25"
            }`}
          >
            {isThinking ? (
              <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Mic className="size-5 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Agent is live</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => localParticipant?.setMicrophoneEnabled(!micEnabled)}
          title={micEnabled ? "Mute" : "Unmute"}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
            micEnabled
              ? "border-border text-foreground hover:bg-muted"
              : "border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/10"
          }`}
        >
          {micEnabled ? (
            <Mic className="size-3.5" />
          ) : (
            <MicOff className="size-3.5" />
          )}
          {micEnabled ? "Mute" : "Unmute"}
        </button>

        <button
          onClick={() => room.disconnect()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
        >
          <PhoneOff className="size-3.5" />
          End call
        </button>
      </div>
    </div>
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
  const [countryCode, setCountryCode] = useState(() => {
    try {
      return localStorage.getItem("playground_country_code") ?? "+1";
    } catch {
      return "+1";
    }
  });
  const [localNumber, setLocalNumber] = useState(() => {
    try {
      return localStorage.getItem("playground_local_number") ?? "";
    } catch {
      return "";
    }
  });
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
        body: JSON.stringify({
          toNumber: fullNumber,
          agentKey,
          isPlayground: true,
          testType: "phoneCall",
        }),
      });
      if (!res.ok) throw new Error("Call failed");
      const data = await res.json();
      setDialedNumber(fullNumber);
      setCallRoomName(data.roomName ?? "");
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
        <CountryCodeSelect
          value={countryCode}
          onChange={(code) => {
            setCountryCode(code);
            try {
              localStorage.setItem("playground_country_code", code);
            } catch {}
          }}
        />
        <Input
          type="tel"
          placeholder="Phone number"
          value={localNumber}
          onChange={(e) => {
            setLocalNumber(e.target.value);
            try {
              localStorage.setItem("playground_local_number", e.target.value);
            } catch {}
          }}
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

// ---- PlaygroundClient (main) ------------------------------------------------

export function PlaygroundClient({ agents }: { agents: AgentConfig[] }) {
  const searchParams = useSearchParams();
  const initialKey = searchParams.get("agent") ?? agents[0]?.key ?? "";
  const { toast } = useToast();

  const [selectedAgentKey, setSelectedAgentKey] = useState(initialKey);
  const [testMode, setTestMode] = useState<"web" | "phone">("web");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [callUsage, setCallUsage] = useState<UsageData | null>(null);
  const [isCalculatingUsage, setIsCalculatingUsage] = useState(false);
  const [savedSections, setSavedSections] = useState<PromptSections | null>(
    null,
  );
  const [playgroundSections, setPlaygroundSections] =
    useState<PromptSections | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [isSavingPlayground, setIsSavingPlayground] = useState(false);
  const [activeSection, setActiveSection] = useState<
    keyof PromptSections | null
  >(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);

  const selectedAgent =
    agents.find((a) => a.key === selectedAgentKey) ?? agents[0];

  useEffect(() => {
    if (!selectedAgentKey) return;
    setPromptLoading(true);
    setSavedSections(null);
    setPlaygroundSections(null);
    setTranscript([]);
    setCallUsage(null);
    transcriptRef.current = [];

    fetch(`/api/agents/${selectedAgentKey}/prompt`)
      .then((r) => r.json())
      .then((data: PromptSections) => {
        setSavedSections(data);
        setPlaygroundSections(data);
      })
      .finally(() => setPromptLoading(false));
  }, [selectedAgentKey]);

  const hasPlaygroundChanges =
    savedSections !== null &&
    playgroundSections !== null &&
    JSON.stringify(savedSections) !== JSON.stringify(playgroundSections);

  const handleSavePlayground = async () => {
    if (!playgroundSections) return;
    setIsSavingPlayground(true);
    try {
      const res = await fetch(`/api/agents/${selectedAgentKey}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playgroundSections),
      });
      if (!res.ok) throw new Error();
      setSavedSections(playgroundSections);
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
      setIsSavingPlayground(false);
    }
  };

  const handleTranscriptUpdate = useCallback((lines: TranscriptLine[]) => {
    transcriptRef.current = lines;
    setTranscript([...lines]);
  }, []);

  const handleCallEnded = useCallback(() => {
    setCallUsage(null);
    setIsCalculatingUsage(true);
  }, []);

  const handleUsage = useCallback((u: UsageData) => {
    setCallUsage(u);
    setIsCalculatingUsage(false);
  }, []);

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
          Test your agent before it goes live. Changes you make here are saved
          immediately.
        </p>
      </div>

      {/* 2-pane layout: left = test + transcript, right = instructions */}
      <div className="flex gap-6 items-start">
        {/* ── Left pane (test + transcript) ── */}
        <div className="w-[280px] shrink-0 flex flex-col gap-4">
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

          {/* Test panel */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-3">
              <nav className="flex -mb-px">
                {(["web", "phone"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTestMode(mode)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
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
            <div className="px-3">
              {testMode === "web" ? (
                <WebTestPanel
                  key={`web-${selectedAgentKey}`}
                  agentKey={selectedAgentKey}
                  translateEnabled={
                    !!selectedAgent?.language &&
                    !selectedAgent.language.startsWith("en")
                  }
                  onTranscriptUpdate={handleTranscriptUpdate}
                  onUsage={handleUsage}
                  onCallEnded={handleCallEnded}
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

          {/* Transcript */}
          <TranscriptPanel
            transcript={transcript}
            translateEnabled={
              !!selectedAgent?.language &&
              !selectedAgent.language.startsWith("en")
            }
          />

          {/* Cost breakdown — appears after call ends */}
          <CostPanel usage={callUsage} loading={isCalculatingUsage} />
        </div>

        {/* ── Main pane (instructions) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-foreground">
                Instructions
              </p>
              {hasPlaygroundChanges && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPlaygroundSections(savedSections)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSavePlayground}
                    disabled={isSavingPlayground}
                    className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSavingPlayground ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>

            {promptLoading ? (
              <div className="flex flex-col gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {playgroundSections &&
                  (
                    Object.keys(SECTION_LABELS) as Array<keyof PromptSections>
                  ).map((key) => {
                    const isActive = activeSection === key;
                    const value = playgroundSections[key];
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                          {SECTION_LABELS[key]}
                        </label>
                        {isActive ? (
                          <Textarea
                            value={value}
                            onChange={(e) => {
                              const el = e.target;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                              setPlaygroundSections((prev) =>
                                prev
                                  ? { ...prev, [key]: e.target.value }
                                  : prev,
                              );
                            }}
                            onFocus={(e) => {
                              const el = e.target;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            onBlur={() => {
                              blurTimerRef.current = setTimeout(
                                () => setActiveSection(null),
                                150,
                              );
                            }}
                            className="leading-relaxed resize-none overflow-hidden"
                            style={{
                              minHeight:
                                key === "voiceGreeting" ? "56px" : "80px",
                            }}
                          />
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onMouseDown={() => {
                              if (blurTimerRef.current) {
                                clearTimeout(blurTimerRef.current);
                              }
                            }}
                            onClick={() => setActiveSection(key)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && setActiveSection(key)
                            }
                            className="min-h-[48px] px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground leading-relaxed cursor-text line-clamp-3 hover:border-ring/50 transition-colors"
                          >
                            {value ? (
                              value
                            ) : (
                              <span className="text-muted-foreground italic">
                                Empty
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
