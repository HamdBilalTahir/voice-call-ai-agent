/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Download,
  Archive,
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  Clock,
  Play,
  FileText,
  X,
  Check,
  Copy,
  ChevronUp,
  ChevronDown,
  Smile,
  Meh,
  Frown,
  Plus,
  Loader2,
} from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import type { CallRecord, CallUsage } from "@/lib/history";
import { calculateCost, formatCost } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallSummary } from "@/app/api/calls/summary/route";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FilterState {
  search: string;
  agentKey: string;
  direction: string;
  outcome: string;
  sentiment: string;
  dateRange: string;
}

interface SavedView {
  name: string;
  filters: FilterState;
}

type SortCol =
  | "startTime"
  | "duration"
  | "agentKey"
  | "phoneNumber"
  | "outcome"
  | "sentiment";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: FilterState = {
  search: "",
  agentKey: "",
  direction: "",
  outcome: "",
  sentiment: "",
  dateRange: "all",
};

const STORAGE_KEY = "call-history-views";

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const SELECT_CLS =
  "h-8 px-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(secs?: number): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isInDateRange(ts: number, range: string): boolean {
  const now = Date.now();
  const sod = new Date();
  sod.setHours(0, 0, 0, 0);
  if (range === "today") return ts >= sod.getTime();
  if (range === "yesterday") {
    const prev = new Date(sod);
    prev.setDate(prev.getDate() - 1);
    return ts >= prev.getTime() && ts < sod.getTime();
  }
  if (range === "7d") return ts >= now - 7 * 86_400_000;
  if (range === "30d") return ts >= now - 30 * 86_400_000;
  return true;
}

function deriveDirection(record: CallRecord, agents: AgentConfig[]): string {
  if (record.direction) return record.direction;
  return agents.find((a) => a.key === record.agentKey)?.direction ?? "outbound";
}

function deriveOutcome(record: CallRecord): string {
  return record.outcome ?? record.status ?? "";
}

function applyFilters(
  records: CallRecord[],
  filters: FilterState,
  agents: AgentConfig[],
): CallRecord[] {
  return records.filter((r) => {
    const direction = deriveDirection(r, agents);
    const outcome = deriveOutcome(r);

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const agentName =
        agents.find((a) => a.key === r.agentKey)?.name.toLowerCase() ?? "";
      if (
        !(r.phoneNumber ?? "").toLowerCase().includes(q) &&
        !agentName.includes(q)
      )
        return false;
    }
    if (filters.agentKey && r.agentKey !== filters.agentKey) return false;
    if (filters.direction && direction !== filters.direction) return false;
    if (filters.outcome && outcome !== filters.outcome) return false;
    if (filters.sentiment && r.sentiment !== filters.sentiment) return false;
    if (!isInDateRange(r.startTime, filters.dateRange)) return false;
    return true;
  });
}

function exportCSV(records: CallRecord[], agents: AgentConfig[]) {
  const header = [
    "Time",
    "Agent",
    "Phone Number",
    "Direction",
    "Duration",
    "Outcome",
    "Sentiment",
  ];
  const rows = records.map((r) => {
    const agent = agents.find((a) => a.key === r.agentKey);
    return [
      formatTime(r.startTime),
      agent?.name ?? r.agentKey,
      r.phoneNumber,
      deriveDirection(r, agents),
      formatDuration(r.duration),
      deriveOutcome(r),
      r.sentiment ?? "—",
    ];
  });
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `call-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadSavedViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedView[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

function filtersEqual(a: FilterState, b: FilterState) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Cost helpers ──────────────────────────────────────────────────────────────

function usageCost(
  usage: CallUsage,
  record?: Pick<CallRecord, "extractionInputTokens" | "extractionOutputTokens">,
) {
  return calculateCost({
    llmProvider: "",
    llmModel: usage.llmModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    sttProvider: "",
    sttModel: usage.sttModel,
    sttAudioMs: usage.sttAudioMs,
    ttsProvider: "",
    ttsModel: usage.ttsModel,
    ttsCharacters: usage.ttsCharacters,
    ttsAudioMs: usage.ttsAudioMs,
    callDurationMs: usage.callDurationMs,
    extractionModel: "gemini-2.5-flash",
    extractionInputTokens: record?.extractionInputTokens,
    extractionOutputTokens: record?.extractionOutputTokens,
  });
}

// ── OutcomeBadge ──────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (!outcome || outcome === "in-progress") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-warning/10 text-warning border-warning/20">
        In progress
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    completed: {
      label: "Completed",
      cls: "bg-success/10 text-success border-success/20",
    },
    missed: {
      label: "Missed",
      cls: "bg-destructive/10 text-destructive border-destructive/20",
    },
    dropped: {
      label: "Dropped",
      cls: "bg-warning/10 text-warning border-warning/20",
    },
    transferred: {
      label: "Transferred",
      cls: "bg-accent text-primary border-primary/20",
    },
    failed: {
      label: "Failed",
      cls: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };
  const cfg = map[outcome];
  if (!cfg)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted text-muted-foreground border-border capitalize">
        {outcome}
      </span>
    );
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// ── SentimentBadge ────────────────────────────────────────────────────────────

function SentimentBadge({
  sentiment,
  score,
  showScore = true,
}: {
  sentiment?: string;
  score?: number;
  showScore?: boolean;
}) {
  if (!sentiment)
    return <span className="text-muted-foreground text-xs">—</span>;
  const Icon =
    sentiment === "positive" ? Smile : sentiment === "negative" ? Frown : Meh;
  const cls =
    sentiment === "positive"
      ? "text-success"
      : sentiment === "negative"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className={`flex items-center gap-1 ${cls}`}>
      <Icon className="size-3.5" />
      {showScore && score != null && (
        <span className="text-[10px]">{score}</span>
      )}
    </div>
  );
}

// ── CallSlideOver ─────────────────────────────────────────────────────────────

function CallSlideOver({
  record,
  agents,
  onClose,
}: {
  record: CallRecord;
  agents: AgentConfig[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "transcript" | "summary">(
    "overview",
  );
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [transcriptTurns, setTranscriptTurns] = useState<Array<{
    speaker: string;
    text: string;
    ts: number;
  }> | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  const agent = agents.find((a) => a.key === record.agentKey);
  const direction = deriveDirection(record, agents);
  const outcome = deriveOutcome(record);

  const fetchSummary = useCallback(async () => {
    if (!record.transcript) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/calls/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: record.transcript }),
      });
      const data = (await res.json()) as CallSummary;
      setSummary(data);
    } catch {
      // silent
    } finally {
      setSummaryLoading(false);
    }
  }, [record.transcript]);

  const fetchTranscript = useCallback(async () => {
    setTranscriptLoading(true);
    try {
      const res = await fetch(`/api/calls/transcript?callId=${record.id}`);
      if (res.ok) {
        const data = await res.json();
        setTranscriptTurns(data.turns ?? []);
      }
    } catch {
      // silent
    } finally {
      setTranscriptLoading(false);
    }
  }, [record.id]);

  useEffect(() => {
    setTab("overview");
    setSummary(null);
    setTranscriptTurns(null);
  }, [record.id]);

  useEffect(() => {
    if (tab === "summary" && !summary && !summaryLoading) void fetchSummary();
  }, [tab, summary, summaryLoading, fetchSummary]);

  useEffect(() => {
    if (tab === "transcript" && !transcriptTurns && !transcriptLoading)
      void fetchTranscript();
  }, [tab, transcriptTurns, transcriptLoading, fetchTranscript]);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "transcript", label: "Transcript" },
    { key: "summary", label: "AI Summary" },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      {}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-base font-semibold text-foreground font-mono tracking-wide">
              {record.isPlayground
                ? record.testType === "phoneCall" && record.testNumber
                  ? `Playground · ${record.testNumber}`
                  : "Playground"
                : (record.phoneNumber ?? "—")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {agent?.name ?? record.agentKey} · {formatTime(record.startTime)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-muted/30 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {direction === "inbound" ? (
              <PhoneIncoming className="size-3.5 text-primary" />
            ) : (
              <PhoneOutgoing className="size-3.5 text-success" />
            )}
            <span className="capitalize">{direction}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {formatDuration(record.duration)}
          </div>
          <OutcomeBadge outcome={outcome} />
          {record.sentiment && (
            <SentimentBadge
              sentiment={record.sentiment}
              score={record.sentimentScore}
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Overview ── */}
          {tab === "overview" && (
            <div className="p-5 flex flex-col gap-5">
              {record.sentimentScore != null && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground">
                      Sentiment score
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {record.sentimentScore}/100
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-destructive via-warning to-success transition-all"
                      style={{ width: `${record.sentimentScore}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Phone number",
                    value: record.isPlayground
                      ? record.testType === "phoneCall" && record.testNumber
                        ? `Playground · ${record.testNumber}`
                        : "Playground"
                      : (record.phoneNumber ?? "—"),
                  },
                  { label: "Agent", value: agent?.name ?? record.agentKey },
                  {
                    label: "Direction",
                    value:
                      direction.charAt(0).toUpperCase() + direction.slice(1),
                  },
                  { label: "Started", value: formatTime(record.startTime) },
                  {
                    label: "Duration",
                    value: formatDuration(record.duration),
                  },
                  {
                    label: "Outcome",
                    value:
                      outcome.charAt(0).toUpperCase() + outcome.slice(1) || "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-sm text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {record.usage &&
                (() => {
                  const cost = usageCost(record.usage, record);
                  return (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Usage &amp; estimated cost
                      </p>
                      <div className="rounded-xl border border-border overflow-hidden text-xs">
                        {/* LLM */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                          <div>
                            <span className="font-medium text-foreground">
                              LLM
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {record.usage.inputTokens.toLocaleString()} in ·{" "}
                              {record.usage.outputTokens.toLocaleString()} out
                              tokens
                            </span>
                          </div>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatCost(cost.llm.total)}
                          </span>
                        </div>
                        {/* STT */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                          <div>
                            <span className="font-medium text-foreground">
                              STT
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {(record.usage.sttAudioMs / 60000).toFixed(2)} min
                              audio
                            </span>
                          </div>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatCost(cost.stt.total)}
                          </span>
                        </div>
                        {/* TTS */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                          <div>
                            <span className="font-medium text-foreground">
                              TTS
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {record.usage.ttsCharacters.toLocaleString()}{" "}
                              chars
                            </span>
                          </div>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatCost(cost.tts.total)}
                          </span>
                        </div>
                        {/* Total */}
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-foreground">
                              Total
                            </span>
                            <span className="text-muted-foreground">
                              {formatCost(cost.perMinute)}/min
                            </span>
                          </div>
                          <span className="font-bold text-foreground tabular-nums">
                            {formatCost(cost.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {record.tags && record.tags.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {record.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-accent text-xs text-foreground rounded-full border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recording stub */}
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border border-border rounded-xl">
                <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Play className="size-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Recording
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Not available for this call
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Transcript ── */}
          {tab === "transcript" && (
            <div className="p-5">
              {transcriptLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="size-5 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Loading transcript…
                  </p>
                </div>
              ) : transcriptTurns && transcriptTurns.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const text = transcriptTurns
                          .map((t) => {
                            const time = new Date(t.ts).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            });
                            const speaker =
                              t.speaker === "agent" ? "Agent" : "Caller";
                            return `[${time}] ${speaker}: ${t.text}`;
                          })
                          .join("\n");
                        void navigator.clipboard.writeText(text).then(() => {
                          setTranscriptCopied(true);
                          setTimeout(() => setTranscriptCopied(false), 2000);
                        });
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent hover:border-border transition-colors"
                    >
                      {transcriptCopied ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {transcriptCopied ? "Copied!" : "Copy transcript"}
                    </button>
                  </div>
                  {transcriptTurns.map((turn, i) => {
                    const isAgent = turn.speaker === "agent";
                    const time = new Date(turn.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    return (
                      <div
                        key={i}
                        className={`flex flex-col max-w-[85%] ${isAgent ? "" : "ml-auto items-end"}`}
                      >
                        <div
                          className={`flex items-center gap-2 mb-1 ${isAgent ? "" : "flex-row-reverse"}`}
                        >
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide ${isAgent ? "text-primary" : "text-success"}`}
                          >
                            {isAgent ? "Agent" : "Caller"}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {time}
                          </span>
                        </div>
                        <div
                          className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${isAgent ? "bg-accent border border-primary/10" : "bg-secondary border border-border"}`}
                        >
                          {turn.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground text-center">
                    No transcript recorded for this call.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── AI Summary ── */}
          {tab === "summary" && (
            <div className="p-5">
              {!record.transcript ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground text-center">
                    No transcript available to generate a summary.
                  </p>
                </div>
              ) : summaryLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="size-5 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Generating summary…
                  </p>
                </div>
              ) : summary ? (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Summary
                    </p>
                    <ul className="space-y-2">
                      {summary.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-xs text-foreground"
                        >
                          <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Sentiment
                    </p>
                    <div className="flex items-center gap-3">
                      <SentimentBadge
                        sentiment={summary.sentiment}
                        score={summary.sentimentScore}
                      />
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-destructive via-warning to-success"
                          style={{ width: `${summary.sentimentScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {summary.sentimentScore}/100
                      </span>
                    </div>
                  </div>

                  {summary.actionItems.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Action items
                      </p>
                      <ul className="space-y-2">
                        {summary.actionItems.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-foreground"
                          >
                            <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── CallHistoryClient ─────────────────────────────────────────────────────────

export function CallHistoryClient({ agents }: { agents: AgentConfig[] }) {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRecord, setActiveRecord] = useState<CallRecord | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("startTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/history")
      .then((r) => r.json())
      .then((data: any) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setError("Could not load call history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);

  const filtered = useMemo(
    () => applyFilters(records, filters, agents),
    [records, filters, agents],
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortCol === "startTime") {
        av = a.startTime;
        bv = b.startTime;
      } else if (sortCol === "duration") {
        av = a.duration ?? 0;
        bv = b.duration ?? 0;
      } else if (sortCol === "agentKey") {
        av = agents.find((ag) => ag.key === a.agentKey)?.name ?? a.agentKey;
        bv = agents.find((ag) => ag.key === b.agentKey)?.name ?? b.agentKey;
      } else if (sortCol === "phoneNumber") {
        av = a.phoneNumber ?? "";
        bv = b.phoneNumber ?? "";
      } else if (sortCol === "outcome") {
        av = deriveOutcome(a);
        bv = deriveOutcome(b);
      } else if (sortCol === "sentiment") {
        av = a.sentiment ?? "";
        bv = b.sentiment ?? "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir, agents]);

  const handleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sorted.length && sorted.length > 0)
      setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  };

  const handleExport = () => {
    const rows =
      selected.size > 0 ? sorted.filter((r) => selected.has(r.id)) : sorted;
    exportCSV(rows, agents);
  };

  const handleArchive = async () => {
    if (selected.size === 0) return;
    setArchiving(true);
    try {
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          updates: { archived: true },
        }),
      });
      const ids = selected;
      setRecords((prev) => prev.filter((r) => !ids.has(r.id)));
      if (activeRecord && ids.has(activeRecord.id)) setActiveRecord(null);
      setSelected(new Set());
    } catch {
      // silent — table stays intact
    } finally {
      setArchiving(false);
    }
  };

  const applyView = (view: SavedView | null) => {
    setFilters(view ? view.filters : EMPTY_FILTERS);
    setSelected(new Set());
  };

  const saveView = () => {
    if (!newViewName.trim()) return;
    const view: SavedView = { name: newViewName.trim(), filters };
    const updated = [
      view,
      ...savedViews.filter((v) => v.name !== view.name),
    ].slice(0, 8);
    setSavedViews(updated);
    persistSavedViews(updated);
    setSavingView(false);
    setNewViewName("");
  };

  const deleteView = (name: string) => {
    const updated = savedViews.filter((v) => v.name !== name);
    setSavedViews(updated);
    persistSavedViews(updated);
  };

  const sortIcon = (col: SortCol) => {
    if (col !== sortCol)
      return <ChevronDown className="size-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="size-3 text-primary" />
    ) : (
      <ChevronDown className="size-3 text-primary" />
    );
  };

  const thCls =
    "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap";

  const SortTh = ({ col, label }: { col: SortCol; label: string }) => (
    <th className={thCls}>
      <button
        onClick={() => handleSort(col)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {sortIcon(col)}
      </button>
    </th>
  );

  const isFiltered = !filtersEqual(filters, EMPTY_FILTERS);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Call History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All calls across every agent.
          </p>
        </div>
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-border flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
            >
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Call History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length !== records.length
              ? `${sorted.length} of ${records.length} call${records.length !== 1 ? "s" : ""}`
              : `${records.length} call${records.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors"
        >
          <Download className="size-3.5" />
          Export CSV
        </button>
      </div>

      {/* Saved views */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => applyView(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            !isFiltered
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
          }`}
        >
          All calls
        </button>

        {savedViews.map((v) => {
          const isActive = filtersEqual(filters, v.filters);
          return (
            <div key={v.name} className="flex items-center group/view">
              <button
                onClick={() => applyView(v)}
                className={`pl-3 pr-2 py-1 rounded-l-full text-xs font-medium border-y border-l transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {v.name}
              </button>
              <button
                onClick={() => deleteView(v.name)}
                className={`pr-2 py-1 rounded-r-full text-xs border-y border-r transition-colors opacity-0 group-hover/view:opacity-100 ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-destructive"
                }`}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}

        {savingView ? (
          <div className="flex items-center gap-1.5">
            <input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveView();
                if (e.key === "Escape") setSavingView(false);
              }}
              placeholder="View name…"
              className="h-6 px-2.5 text-xs border border-border rounded-full bg-card text-foreground focus:outline-none focus:border-primary w-32 transition-colors"
            />
            <button
              onClick={saveView}
              className="text-primary text-xs font-medium hover:text-primary/80 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setSavingView(false)}
              className="text-muted-foreground text-xs hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSavingView(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <Plus className="size-3" />
            Save view
          </button>
        )}
      </div>

      {/* Filter bar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search number or agent…"
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={filters.dateRange}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateRange: e.target.value }))
            }
            className={SELECT_CLS}
          >
            {DATE_RANGES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select
            value={filters.agentKey}
            onChange={(e) =>
              setFilters((f) => ({ ...f, agentKey: e.target.value }))
            }
            className={SELECT_CLS}
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={filters.direction}
            onChange={(e) =>
              setFilters((f) => ({ ...f, direction: e.target.value }))
            }
            className={SELECT_CLS}
          >
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          <select
            value={filters.outcome}
            onChange={(e) =>
              setFilters((f) => ({ ...f, outcome: e.target.value }))
            }
            className={SELECT_CLS}
          >
            <option value="">All outcomes</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="dropped">Dropped</option>
            <option value="failed">Failed</option>
            <option value="transferred">Transferred</option>
          </select>

          <select
            value={filters.sentiment}
            onChange={(e) =>
              setFilters((f) => ({ ...f, sentiment: e.target.value }))
            }
            className={SELECT_CLS}
          >
            <option value="">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          {isFiltered && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-xs font-medium text-foreground">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Archive className="size-3.5" />
            {archiving ? "Archiving…" : "Archive"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Phone className="size-8 text-muted-foreground/25" />
            <p className="text-sm font-medium text-foreground">
              No calls found
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {isFiltered
                ? "Try adjusting your filters or clearing them to see all calls."
                : "Calls will appear here once your agents start making or receiving them."}
            </p>
            {isFiltered ? (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Clear filters
              </button>
            ) : (
              <a
                href="/playground"
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors mt-1"
              >
                <Plus className="size-3.5" />
                Try a test call in Playground
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border">
              {sorted.map((record) => {
                const agent = agents.find((a) => a.key === record.agentKey);
                const direction = deriveDirection(record, agents);
                const outcome = deriveOutcome(record);
                const isActive = activeRecord?.id === record.id;
                return (
                  <button
                    key={record.id}
                    onClick={() => setActiveRecord(isActive ? null : record)}
                    className={`w-full text-left px-4 py-3.5 cursor-pointer transition-colors ${isActive ? "bg-primary/5" : "hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {direction === "inbound" ? (
                          <PhoneIncoming className="size-3.5 text-primary shrink-0" />
                        ) : (
                          <PhoneOutgoing className="size-3.5 text-success shrink-0" />
                        )}
                        {record.isPlayground ? (
                          <span className="text-sm font-medium text-primary truncate">
                            Playground
                          </span>
                        ) : (
                          <span className="text-sm font-mono font-medium text-foreground truncate">
                            {record.phoneNumber ?? "—"}
                          </span>
                        )}
                      </div>
                      <OutcomeBadge outcome={outcome} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground truncate">
                          {agent?.name ?? record.agentKey}
                        </span>
                        {record.duration != null && record.duration > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            · {formatDuration(record.duration)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SentimentBadge
                          sentiment={record.sentiment}
                          score={record.sentimentScore}
                          showScore={false}
                        />
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {relativeTime(record.startTime)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          selected.size === sorted.length && sorted.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                    <SortTh col="startTime" label="Time" />
                    <SortTh col="agentKey" label="Agent" />
                    <SortTh col="phoneNumber" label="Caller / Recipient" />
                    <th className={thCls}>Dir</th>
                    <SortTh col="duration" label="Duration" />
                    <SortTh col="outcome" label="Outcome" />
                    <SortTh col="sentiment" label="Sentiment" />
                    <th className={thCls}>Pipeline</th>
                    <th className={thCls}>LLM</th>
                    <th className={thCls}>Tokens</th>
                    <th className={thCls}>TTS</th>
                    <th className={thCls}>Cost</th>
                    <th className={thCls}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((record) => {
                    const agent = agents.find((a) => a.key === record.agentKey);
                    const direction = deriveDirection(record, agents);
                    const outcome = deriveOutcome(record);
                    const isActive = activeRecord?.id === record.id;

                    return (
                      <tr
                        key={record.id}
                        onClick={() =>
                          setActiveRecord(isActive ? null : record)
                        }
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          isActive
                            ? "bg-primary/5"
                            : selected.has(record.id)
                              ? "bg-muted/50"
                              : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Checkbox */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(record.id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(record.id)}
                            onChange={() => {}}
                            className="rounded border-border accent-primary cursor-pointer"
                          />
                        </td>

                        {/* Time */}
                        <td className="px-3 py-3">
                          <p className="text-xs font-medium text-foreground">
                            {relativeTime(record.startTime)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatTime(record.startTime)}
                          </p>
                        </td>

                        {/* Agent */}
                        <td className="px-3 py-3">
                          <p className="text-xs text-foreground whitespace-nowrap">
                            {agent?.name ?? record.agentKey}
                          </p>
                        </td>

                        {/* Caller / Recipient */}
                        <td className="px-3 py-3">
                          {record.isPlayground ? (
                            <div>
                              <p className="text-xs font-medium text-primary">
                                Playground
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                {record.testNumber ?? "Widget"}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs font-mono text-foreground">
                              {record.phoneNumber ?? "—"}
                            </p>
                          )}
                        </td>

                        {/* Direction */}
                        <td className="px-3 py-3">
                          {direction === "inbound" ? (
                            <PhoneIncoming className="size-3.5 text-primary" />
                          ) : (
                            <PhoneOutgoing className="size-3.5 text-success" />
                          )}
                        </td>

                        {/* Duration */}
                        <td className="px-3 py-3">
                          <p className="text-xs text-foreground tabular-nums">
                            {formatDuration(record.duration)}
                          </p>
                        </td>

                        {/* Outcome */}
                        <td className="px-3 py-3">
                          <OutcomeBadge outcome={outcome} />
                        </td>

                        {/* Sentiment */}
                        <td className="px-3 py-3">
                          <SentimentBadge
                            sentiment={record.sentiment}
                            score={record.sentimentScore}
                            showScore={false}
                          />
                        </td>

                        {/* Pipeline */}
                        <td className="px-3 py-3">
                          {record.pipelineMode === "live_api" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-500/15 text-violet-600 dark:text-violet-400 whitespace-nowrap">
                              Live API
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              Cascading
                            </span>
                          )}
                        </td>

                        {/* LLM */}
                        <td className="px-3 py-3 max-w-[130px]">
                          <span
                            className="text-xs text-foreground font-mono block truncate"
                            title={record.usage?.llmModel}
                          >
                            {record.usage?.llmModel ?? "—"}
                          </span>
                        </td>

                        {/* Tokens (in / out) */}
                        <td className="px-3 py-3">
                          {record.usage ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-foreground tabular-nums whitespace-nowrap">
                                {record.usage.inputTokens.toLocaleString()} in
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                {record.usage.outputTokens.toLocaleString()} out
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>

                        {/* TTS chars */}
                        <td className="px-3 py-3">
                          <span className="text-xs text-foreground tabular-nums">
                            {record.usage
                              ? record.usage.ttsCharacters.toLocaleString()
                              : "—"}
                          </span>
                        </td>

                        {/* Cost */}
                        <td className="px-3 py-3">
                          {record.usage ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                                ~
                                {formatCost(
                                  usageCost(record.usage, record).total,
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                {formatCost(
                                  usageCost(record.usage, record).perMinute,
                                )}
                                /min
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>

                        {/* Quick actions */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-0.5">
                            <button
                              title="Play recording"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <Play className="size-3.5" />
                            </button>
                            <button
                              title="View transcript"
                              onClick={() =>
                                setActiveRecord((prev) =>
                                  prev?.id === record.id ? null : record,
                                )
                              }
                              className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <FileText className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Slide-over detail panel */}
      {activeRecord && (
        <CallSlideOver
          record={activeRecord}
          agents={agents}
          onClose={() => setActiveRecord(null)}
        />
      )}
    </div>
  );
}
