/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import {
  MicOff,
  PauseCircle,
  PhoneOff,
  UserPlus,
  ChevronDown,
  Check,
  Copy,
  Share2,
  Flag,
  Smile,
  Meh,
  Frown,
  Phone,
} from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { translateToEnglish } from "@/lib/translation";
import type { CallSummary } from "@/app/api/calls/summary/route";

// ── Types ─────────────────────────────────────────────────────────────────────

type CallStatus =
  | "dialing"
  | "ringing"
  | "connected"
  | "ended"
  | "failed"
  | "summarizing"
  | "summary";

interface TranscriptLine {
  id: string;
  speaker: "Agent" | "Caller";
  text: string;
  timestamp: number;
  translation?: string;
  isFinal: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WAVE_HEIGHTS = [4, 10, 18, 24, 16, 28, 32, 22, 26, 18, 12, 8, 16, 24, 20];

const STATUS_CONFIG: Record<CallStatus, { dot: string; label: string }> = {
  dialing: { dot: "bg-warning", label: "Dialing…" },
  ringing: { dot: "bg-warning animate-pulse", label: "Ringing…" },
  connected: { dot: "bg-success animate-pulse", label: "Connected" },
  ended: { dot: "bg-destructive", label: "Ended" },
  failed: { dot: "bg-destructive", label: "Not answered" },
  summarizing: { dot: "bg-muted-foreground", label: "Summarizing…" },
  summary: { dot: "bg-muted-foreground", label: "Ended" },
};

const TRANSLATE_LANGS = [
  { code: "en", label: "English", disabled: false },
  { code: "es", label: "Spanish (coming soon)", disabled: true },
  { code: "ar", label: "Arabic (coming soon)", disabled: true },
  { code: "fr", label: "French (coming soon)", disabled: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function transcriptToText(lines: TranscriptLine[]): string {
  return lines
    .filter((l) => l.isFinal && l.text.trim())
    .map((l) => `${l.speaker}: ${l.text}`)
    .join("\n");
}

// ── AgentWaveform ─────────────────────────────────────────────────────────────

function AgentWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-0.5 h-10">
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-1 bg-primary rounded-full transition-all duration-300"
          style={{
            height: active ? h : 3,
            transitionDelay: `${i * 40}ms`,
            opacity: active ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}

// ── DialProgress ──────────────────────────────────────────────────────────────

function DialProgress({
  status,
  toNumber,
}: {
  status: CallStatus;
  toNumber?: string;
}) {
  const steps: { label: string; id: CallStatus }[] = [
    { label: "Dialing", id: "dialing" },
    { label: "Ringing", id: "ringing" },
    { label: "Connected", id: "connected" },
  ];
  const activeIdx = status === "dialing" ? 0 : status === "ringing" ? 1 : 2;

  return (
    <div className="flex flex-col items-center justify-center gap-6 flex-1 py-16">
      <div
        className={`size-20 rounded-full flex items-center justify-center ${
          status === "connected" ? "bg-success/10" : "bg-accent"
        }`}
      >
        <Phone
          className={`size-9 transition-colors ${
            status === "connected"
              ? "text-success"
              : "text-primary animate-pulse"
          }`}
        />
      </div>

      {toNumber && (
        <p className="text-base font-semibold text-foreground font-mono tracking-wide">
          {toNumber}
        </p>
      )}

      <div className="flex items-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`size-2 rounded-full transition-colors ${
                  idx < activeIdx
                    ? "bg-success"
                    : idx === activeIdx
                      ? "bg-primary animate-pulse"
                      : "bg-muted-foreground/25"
                }`}
              />
              <span
                className={`text-xs font-medium transition-colors ${
                  idx <= activeIdx
                    ? "text-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {status === "dialing" && "Placing your call via Twilio SIP…"}
        {status === "ringing" && "Phone is ringing on the other end…"}
        {status === "connected" &&
          "Call connected — transcript will appear shortly."}
      </p>
    </div>
  );
}

// ── PostCallSummary ───────────────────────────────────────────────────────────

function PostCallSummary({
  summary,
  transcript,
  onClose,
}: {
  summary: CallSummary | null;
  transcript: TranscriptLine[];
  onClose: () => void;
}) {
  const { toast } = useToast();

  const shareTranscript = () => {
    const text = transcriptToText(transcript);
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ message: "Transcript copied.", variant: "success" }));
  };

  const sentimentIcon =
    summary?.sentiment === "positive" ? (
      <Smile className="size-5 text-success" />
    ) : summary?.sentiment === "negative" ? (
      <Frown className="size-5 text-destructive" />
    ) : (
      <Meh className="size-5 text-warning" />
    );

  return (
    <div className="flex flex-col gap-6 overflow-y-auto flex-1 px-6 py-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Call Summary
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-generated · {transcript.filter((l) => l.isFinal).length} lines
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sentimentIcon}
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-foreground capitalize">
              {summary?.sentiment ?? "neutral"} sentiment
            </span>
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (summary?.sentimentScore ?? 50) >= 60
                    ? "bg-success"
                    : (summary?.sentimentScore ?? 50) >= 40
                      ? "bg-warning"
                      : "bg-destructive"
                }`}
                style={{ width: `${summary?.sentimentScore ?? 50}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bullets */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key Points
        </h4>
        {summary ? (
          <ul className="flex flex-col gap-2">
            {summary.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-foreground"
              >
                <div className="size-1.5 rounded-full bg-primary shrink-0 mt-[7px]" />
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>

      {/* Action items */}
      {(summary?.actionItems ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Action Items
          </h4>
          <ul className="flex flex-col gap-2">
            {summary!.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="size-4 rounded border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="size-2.5 text-muted-foreground" />
                </div>
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full transcript */}
      {transcript.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Full Transcript
          </h4>
          <div className="bg-muted/40 border border-border rounded-xl p-3 max-h-44 overflow-y-auto space-y-2">
            {transcript
              .filter((l) => l.isFinal && l.text.trim())
              .map((l) => (
                <p
                  key={l.id}
                  className="text-xs text-foreground leading-relaxed"
                >
                  <span
                    className={`font-semibold ${
                      l.speaker === "Agent" ? "text-primary" : "text-success"
                    }`}
                  >
                    {l.speaker}:
                  </span>{" "}
                  {l.text}
                </p>
              ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex items-center gap-3 pt-1 border-t border-border mt-auto">
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={shareTranscript}
          className="gap-1.5"
        >
          <Share2 className="size-3.5" />
          Share transcript
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-1.5 text-muted-foreground"
          onClick={() =>
            toast({ message: "Got it — we'll take a look.", variant: "info" })
          }
        >
          <Flag className="size-3.5" />
          Report issue
        </Button>
      </div>
    </div>
  );
}

// ── CallNotAnswered ───────────────────────────────────────────────────────────

function CallNotAnswered({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 flex-1 px-6 py-16 text-center">
      <div className="size-20 rounded-full bg-destructive/10 flex items-center justify-center">
        <PhoneOff className="size-9 text-destructive" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold text-foreground">
          Call not answered
        </h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          The call ended before anyone picked up — it may have been declined,
          gone to voicemail, or rung out. Try again when you&apos;re ready.
        </p>
      </div>
      <Button size="sm" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

// ── TestCallModal ─────────────────────────────────────────────────────────────

export function TestCallModal({
  open,
  onClose,
  agent,
  agentKey,
  toNumber,
  roomName,
}: {
  open: boolean;
  onClose: () => void;
  agent: AgentConfig;
  agentKey: string;
  toNumber?: string;
  roomName?: string;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<CallStatus>("dialing");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [duration, setDuration] = useState(0);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const statusRef = useRef<CallStatus>("dialing");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the PSTN/SIP participant lifecycle independently of the observer's
  // own LiveKit connection: whether the callee actually answered, and whether
  // the call has already terminated (so we transition to post-call exactly once).
  const sipActiveRef = useRef(false);
  const callEndedRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStatus("dialing");
    setTranscript([]);
    setSummary(null);
    setDuration(0);
    setConnectedAt(null);
    setShowEndConfirm(false);
    setShowJumpToLatest(false);
    transcriptRef.current = [];
    sipActiveRef.current = false;
    callEndedRef.current = false;
  }, [open]);

  // Dialing → ringing after 2 s
  useEffect(() => {
    if (!open || status !== "dialing") return;
    const t = setTimeout(() => {
      if (statusRef.current === "dialing") setStatus("ringing");
    }, 2000);
    return () => clearTimeout(t);
  }, [open, status]);

  // Duration ticker
  useEffect(() => {
    if (!connectedAt) return;
    const id = setInterval(
      () => setDuration(Math.floor((Date.now() - connectedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [connectedAt]);

  // Auto-scroll when at bottom
  useEffect(() => {
    if (!showJumpToLatest && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, showJumpToLatest]);

  // LiveKit observer
  useEffect(() => {
    if (!open || !roomName) return;
    let mounted = true;

    const connect = async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            participantName: "Dashboard Observer",
            participantIdentity: `observer-${Math.random().toString(36).slice(7)}`,
          }),
        });
        if (!res.ok) throw new Error("Token request failed");
        const { token, url } = await res.json();

        const room = new Room();
        roomRef.current = room;
        const translatedIds = new Set<string>();

        // SIP participants join as `phone-<number>` (see /api/calls/outbound).
        const isSipParticipant = (identity?: string) =>
          !!identity && identity.startsWith("phone-");

        // No-answer fallback: if the callee never answers, the SIP participant
        // is torn down with no transcript. Matches the worker's 60s wait.
        let noAnswerTimer: ReturnType<typeof setTimeout> | null = null;
        const clearNoAnswerTimer = () => {
          if (noAnswerTimer) {
            clearTimeout(noAnswerTimer);
            noAnswerTimer = null;
          }
        };

        // The callee picked up — either sip.callStatus flipped to "active" or the
        // first transcript line arrived (some trunks never set the attribute).
        const markConnected = () => {
          if (sipActiveRef.current || callEndedRef.current) return;
          sipActiveRef.current = true;
          clearNoAnswerTimer();
          if (!mounted) return;
          setStatus("connected");
          setConnectedAt(Date.now());
        };

        // Run the post-call summary flow exactly once.
        const finishCall = async () => {
          if (callEndedRef.current) return;
          callEndedRef.current = true;
          clearNoAnswerTimer();
          if (!mounted) return;
          setStatus("summarizing");
          const text = transcriptToText(transcriptRef.current);
          try {
            const sumRes = await fetch("/api/calls/summary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: text }),
            });
            if (mounted) {
              setSummary(await sumRes.json());
              setStatus("summary");
            }
          } catch {
            if (mounted) setStatus("summary");
          }
        };

        // The call ended before the callee ever answered (no answer / busy /
        // declined) — skip the empty summary and show a terminal state.
        const markNotAnswered = () => {
          if (callEndedRef.current) return;
          callEndedRef.current = true;
          clearNoAnswerTimer();
          if (mounted) setStatus("failed");
          room.disconnect();
        };

        // The SIP participant left the room: a hangup if they had answered,
        // otherwise a missed/declined call.
        const handleSipGone = () => {
          if (callEndedRef.current) return;
          if (sipActiveRef.current) {
            finishCall();
          } else {
            markNotAnswered();
          }
        };

        room.registerTextStreamHandler(
          "lk.transcription",
          async (reader: any, participantInfo: any) => {
            const segmentId =
              reader.info.attributes?.["lk.segment_id"] || reader.info.id;
            const isInterimStream =
              reader.info.attributes?.["lk.transcription_final"] === "false";
            const isAgent = !participantInfo.identity.startsWith("phone-");
            const speaker: "Agent" | "Caller" = isAgent ? "Agent" : "Caller";

            // A transcript line means audio is flowing — the call is live even
            // if the sip.callStatus attribute never arrived.
            markConnected();

            if (!transcriptRef.current.some((l) => l.id === segmentId)) {
              transcriptRef.current = [
                ...transcriptRef.current,
                {
                  id: segmentId,
                  speaker,
                  text: "",
                  timestamp: Date.now(),
                  isFinal: false,
                },
              ];
              if (mounted) setTranscript([...transcriptRef.current]);
            }

            let accumulated = "";
            for await (const chunk of reader) {
              accumulated += chunk;
              if (!mounted) return;
              transcriptRef.current = transcriptRef.current.map((l) =>
                l.id === segmentId ? { ...l, text: accumulated } : l,
              );
              setTranscript([...transcriptRef.current]);
            }

            if (!mounted) return;
            transcriptRef.current = transcriptRef.current.map((l) =>
              l.id === segmentId ? { ...l, isFinal: true } : l,
            );
            setTranscript([...transcriptRef.current]);

            const skipAsInterim = isInterimStream && !isAgent;
            if (
              agentKey === "restaurant-es" &&
              accumulated.length > 2 &&
              !skipAsInterim &&
              !translatedIds.has(segmentId)
            ) {
              translatedIds.add(segmentId);
              await translateToEnglish(accumulated, (partial) => {
                transcriptRef.current = transcriptRef.current.map((l) =>
                  l.id === segmentId ? { ...l, translation: partial } : l,
                );
                if (mounted) setTranscript([...transcriptRef.current]);
              });
            }
          },
        );

        // Observer joined the room — the phone is still ringing until the SIP
        // participant reports "active". If it already answered before we joined,
        // pick that up immediately.
        room.on(RoomEvent.Connected, () => {
          if (!mounted || callEndedRef.current) return;
          if (!sipActiveRef.current) setStatus("ringing");
          room.remoteParticipants.forEach((p: any) => {
            if (
              isSipParticipant(p.identity) &&
              p.attributes?.["sip.callStatus"] === "active"
            ) {
              markConnected();
            }
          });
          noAnswerTimer = setTimeout(() => {
            if (!sipActiveRef.current) markNotAnswered();
          }, 60_000);
        });

        // Callee answered: the SIP bridge flips sip.callStatus to "active".
        room.on(
          RoomEvent.ParticipantAttributesChanged,
          (changed: Record<string, string>, p: any) => {
            if (
              isSipParticipant(p.identity) &&
              changed["sip.callStatus"] === "active"
            ) {
              markConnected();
            }
          },
        );

        // Callee hung up (or never answered): the SIP participant leaves.
        room.on(RoomEvent.ParticipantDisconnected, (p: any) => {
          if (isSipParticipant(p.identity)) handleSipGone();
        });

        // The room itself closed (e.g. worker deleted it after a farewell, or a
        // network drop) — fall back to the post-call view.
        room.on(RoomEvent.Disconnected, () => {
          handleSipGone();
        });

        await room.connect(url, token);
      } catch (err: any) {
        console.error("[TestCallModal]", err);
        if (mounted) {
          toast({
            message:
              "Couldn't connect to the call — check your network and try again.",
            variant: "error",
          });
          setStatus("ended");
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomName]);

  const endCall = useCallback(() => {
    setShowEndConfirm(false);
    if (roomRef.current) {
      roomRef.current.disconnect();
    } else {
      setStatus("ended");
    }
  }, []);

  const handleClose = useCallback(() => {
    const active =
      status !== "ended" &&
      status !== "failed" &&
      status !== "summary" &&
      status !== "summarizing";
    if (active) {
      setShowEndConfirm(true);
    } else {
      onClose();
    }
  }, [status, onClose]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowJumpToLatest(scrollHeight - scrollTop - clientHeight > 80);
  };

  const { dot, label } = STATUS_CONFIG[status];
  const isActive = status === "connected";
  const showTranscript =
    status === "connected" || status === "ended" || status === "summarizing";

  const [mobileTxTab, setMobileTxTab] = useState<"original" | "translation">(
    "original",
  );
  const [copiedOriginal, setCopiedOriginal] = useState(false);

  const copyOriginalTranscript = () => {
    const text = transcriptToText(transcript);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      mobileSheet
      className="sm:max-w-4xl sm:h-[82vh] h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl"
    >
      {/* ── Header ── */}
      <DialogHeader className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold text-foreground truncate">
              {agent.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Listening in</p>
          </div>
          <Badge
            variant={isActive ? "success" : "secondary"}
            className="gap-1.5 shrink-0"
          >
            <span className={`size-1.5 rounded-full ${dot}`} />
            {label}
          </Badge>
          {isActive && duration > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
              {formatDuration(duration)}
            </span>
          )}
        </div>

        {showEndConfirm ? (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="text-xs text-foreground">End call?</span>
            <button
              onClick={endCall}
              className="text-xs text-destructive font-semibold hover:text-destructive/80"
            >
              End
            </button>
            <button
              onClick={() => setShowEndConfirm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <DialogClose onClose={handleClose} />
        )}
      </DialogHeader>

      {/* ── Not-answered view ── */}
      {status === "failed" ? (
        <CallNotAnswered onClose={onClose} />
      ) : status === "summary" || status === "summarizing" ? (
        /* ── Summary view ── */
        <PostCallSummary
          summary={status === "summarizing" ? null : summary}
          transcript={transcript}
          onClose={onClose}
        />
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* ── Call controls (~25%) ── */}
          <div className="shrink-0 px-5 py-3.5 border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
                {isActive ? (
                  <AgentWaveform active />
                ) : (
                  <div className="size-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Phone className="size-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  {toNumber && (
                    <p className="text-sm font-semibold text-foreground font-mono truncate">
                      {toNumber}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(
                  [
                    {
                      icon: MicOff,
                      label: "Mute",
                      title: "Not available for phone calls",
                    },
                    { icon: PauseCircle, label: "Hold", title: "Coming soon" },
                  ] as const
                ).map(({ icon: Icon, label: lbl, title }) => (
                  <button
                    key={lbl}
                    disabled
                    title={title}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-card border border-border text-muted-foreground opacity-40 cursor-not-allowed"
                  >
                    <Icon className="size-4" />
                    <span className="text-[10px]">{lbl}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowEndConfirm(true)}
                  disabled={!isActive}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PhoneOff className="size-4" />
                  <span className="text-[10px] font-medium">End</span>
                </button>
                <button
                  disabled
                  title="Human handoff coming soon"
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-card border border-border text-muted-foreground opacity-40 cursor-not-allowed"
                >
                  <UserPlus className="size-4" />
                  <span className="text-[10px]">Take over</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Transcript (~75%) ── */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            {!showTranscript ? (
              <DialProgress status={status} toNumber={toNumber} />
            ) : (
              <>
                {/* Desktop column headers — hidden on mobile */}
                <div className="hidden sm:grid grid-cols-2 border-b border-border shrink-0">
                  <div className="px-5 py-2 border-r border-border flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Original
                    </span>
                    <button
                      onClick={copyOriginalTranscript}
                      disabled={
                        transcript.filter((l) => l.isFinal && l.text.trim())
                          .length === 0
                      }
                      title="Copy transcript"
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {copiedOriginal ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="px-5 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Translation
                    </span>
                    <select className="text-xs border border-border rounded-md px-1.5 py-0.5 bg-card text-foreground focus:outline-none">
                      {TRANSLATE_LANGS.map((l) => (
                        <option
                          key={l.code}
                          value={l.code}
                          disabled={l.disabled}
                        >
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mobile tab toggle — hidden on desktop */}
                <div className="sm:hidden flex border-b border-border shrink-0">
                  {(["original", "translation"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMobileTxTab(tab)}
                      className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                        mobileTxTab === tab
                          ? "text-primary border-b-2 border-primary -mb-px"
                          : "text-muted-foreground"
                      }`}
                    >
                      {tab === "original" ? "Original" : "Translation"}
                    </button>
                  ))}
                </div>

                {/* Scrollable body */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto"
                >
                  {transcript.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                      <div className="size-6 border-2 border-border border-t-primary rounded-full animate-spin" />
                      <p className="text-xs text-muted-foreground">
                        Waiting for conversation to start…
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop: two-column grid */}
                      <div className="hidden sm:grid grid-cols-2 min-h-full">
                        {/* Original column */}
                        <div className="border-r border-border px-5 py-4 space-y-4">
                          {transcript.map((line) => {
                            const isAgent = line.speaker === "Agent";
                            return (
                              <div
                                key={line.id}
                                className="flex flex-col gap-1"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-semibold uppercase tracking-wide ${isAgent ? "text-primary" : "text-success"}`}
                                  >
                                    {line.speaker}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {new Date(
                                      line.timestamp,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                  {!line.isFinal && (
                                    <span className="text-[10px] text-muted-foreground/50 italic">
                                      …
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${isAgent ? "bg-accent border border-primary/10 text-accent-foreground" : "bg-secondary border border-border text-secondary-foreground"}`}
                                >
                                  {line.text || (
                                    <span className="italic text-muted-foreground/50">
                                      Transcribing…
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Translation column */}
                        <div className="px-5 py-4 space-y-4">
                          {transcript.map((line) => {
                            const isAgent = line.speaker === "Agent";
                            const showTranslation =
                              agentKey === "restaurant-es" &&
                              line.isFinal &&
                              line.text.length > 2;
                            return (
                              <div
                                key={line.id}
                                className="flex flex-col gap-1"
                              >
                                <div className="h-[18px]" />
                                <div
                                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${isAgent ? "bg-accent/50 border border-primary/5 text-accent-foreground" : "bg-secondary/50 border border-border/50 text-secondary-foreground"}`}
                                >
                                  {showTranslation ? (
                                    line.translation === "" ? (
                                      <span className="italic text-muted-foreground/50">
                                        (already in English)
                                      </span>
                                    ) : (
                                      (line.translation ?? (
                                        <span className="italic text-muted-foreground/50">
                                          Translating…
                                        </span>
                                      ))
                                    )
                                  ) : (
                                    <span className="italic text-muted-foreground/40 text-[11px]">
                                      {agentKey === "restaurant-es"
                                        ? "Translation pending…"
                                        : "No translation needed"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mobile: single column */}
                      <div className="sm:hidden px-4 py-4 space-y-4">
                        {transcript.map((line) => {
                          const isAgent = line.speaker === "Agent";
                          const showTranslation =
                            agentKey === "restaurant-es" &&
                            line.isFinal &&
                            line.text.length > 2;
                          const content =
                            mobileTxTab === "original" ? (
                              line.text || (
                                <span className="italic text-muted-foreground/50">
                                  Transcribing…
                                </span>
                              )
                            ) : showTranslation ? (
                              line.translation === "" ? (
                                <span className="italic text-muted-foreground/50">
                                  (already in English)
                                </span>
                              ) : (
                                (line.translation ?? (
                                  <span className="italic text-muted-foreground/50">
                                    Translating…
                                  </span>
                                ))
                              )
                            ) : (
                              <span className="italic text-muted-foreground/40 text-[11px]">
                                {agentKey === "restaurant-es"
                                  ? "Translation pending…"
                                  : "No translation needed"}
                              </span>
                            );
                          return (
                            <div key={line.id} className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wide ${isAgent ? "text-primary" : "text-success"}`}
                                >
                                  {line.speaker}
                                </span>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {new Date(line.timestamp).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    },
                                  )}
                                </span>
                                {!line.isFinal && (
                                  <span className="text-[10px] text-muted-foreground/50 italic">
                                    …
                                  </span>
                                )}
                              </div>
                              <div
                                className={`px-3 py-2.5 rounded-xl text-xs leading-relaxed ${isAgent ? "bg-accent border border-primary/10 text-accent-foreground" : "bg-secondary border border-border text-secondary-foreground"}`}
                              >
                                {content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Jump to latest */}
                {showJumpToLatest && (
                  <button
                    onClick={() => {
                      scrollRef.current?.scrollTo({
                        top: scrollRef.current.scrollHeight,
                        behavior: "smooth",
                      });
                      setShowJumpToLatest(false);
                    }}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-medium shadow-lg z-10 hover:bg-primary/90 transition-colors animate-in slide-in-from-bottom-2 duration-150"
                  >
                    <ChevronDown className="size-3" />
                    Jump to latest
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Dummy DialogContent to satisfy portal structure */}
      <DialogContent className="hidden" />
    </Dialog>
  );
}
