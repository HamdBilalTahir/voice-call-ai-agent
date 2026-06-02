/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { type AgentFullData } from "@/lib/firebase/agents";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  MoreHorizontal,
  Sparkles,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { InstructionsTab } from "./AIJobDescriptionTab";
import { VoiceBehaviorTab } from "./VoiceBehaviorTab";

interface AgentClientProps {
  agentData: AgentFullData;
  agentKey: string;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function KebabMenu({ onAction }: { onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        aria-label="More options"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-44 bg-card border border-border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
          {["Duplicate", "Export config", "View logs"].map((action) => (
            <button
              key={action}
              onClick={() => {
                onAction(action);
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {action}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => {
              onAction("Delete");
              setOpen(false);
            }}
            className="w-full text-left px-3.5 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
          >
            Delete agent
          </button>
        </div>
      )}
    </div>
  );
}

function RecentActivityPanel({
  activeCalls,
  callHistory,
  now,
}: {
  activeCalls: any[];
  callHistory: any[];
  now: number;
}) {
  const isEmpty = activeCalls.length === 0 && callHistory.length === 0;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Recent activity
        </h2>
        {activeCalls.length > 0 && (
          <Badge variant="success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {activeCalls.length} live
          </Badge>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Phone className="size-5" />}
          title="No activity yet"
          description="Calls will appear here once they start."
        />
      ) : (
        <div className="divide-y divide-border">
          {activeCalls.map((room) => {
            const duration = Math.floor(
              (now - room.creationTime * 1000) / 1000,
            );
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            return (
              <div
                key={room.name}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Active call
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mins}:{secs.toString().padStart(2, "0")} &middot;{" "}
                    {room.numParticipants} participants
                  </p>
                </div>
                <Link href={`/calls/${room.name}`}>
                  <button className="px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors">
                    Watch
                  </button>
                </Link>
              </div>
            );
          })}

          {callHistory.slice(0, 8).map((record, i) => (
            <div
              key={record.id || record.roomName || i}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {record.phoneNumber || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {relativeTime(record.startTime)}
                  {record.duration ? ` · ${record.duration}s` : ""}
                </p>
              </div>
              <Badge
                variant={
                  record.status === "completed"
                    ? "success"
                    : record.status === "missed"
                      ? "destructive"
                      : "default"
                }
                className="capitalize shrink-0 ml-3"
              >
                {record.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const TABS = [
  { id: "job-description", label: "Instructions" },
  { id: "agent-settings", label: "Voice & Behavior" },
  { id: "knowledge-base", label: "Knowledge" },
  { id: "actions", label: "Tools & Actions" },
  { id: "connect", label: "Phone & Channels" },
] as const;

function ReadOnlyTab({ title }: { title: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">
        Managed by admin — editing coming soon.
      </p>
    </div>
  );
}

function TabContent({
  tab,
  agentKey,
  agentData,
  onVoiceEnabledChange,
}: {
  tab: string;
  agentKey: string;
  agentData: AgentFullData;
  onVoiceEnabledChange: (enabled: boolean) => void;
}) {
  if (tab === "job-description") {
    return <InstructionsTab agentKey={agentKey} initialData={agentData} />;
  }
  if (tab === "agent-settings") {
    return (
      <VoiceBehaviorTab
        agentKey={agentKey}
        initialData={agentData}
        onVoiceEnabledChange={onVoiceEnabledChange}
      />
    );
  }
  if (tab === "knowledge-base") return <ReadOnlyTab title="Knowledge base" />;
  if (tab === "actions") return <ReadOnlyTab title="Tools & Actions" />;
  if (tab === "connect") return <ReadOnlyTab title="Phone & Channels" />;
  return null;
}

export function AgentClient({ agentData, agentKey }: AgentClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(agentData.voiceEnabled);
  const [isTogglingLive, setIsTogglingLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(agentData.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(
    agentData.description ?? "",
  );
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  const saveName = useCallback(async () => {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === agentData.name) {
      setIsEditingName(false);
      return;
    }
    setIsEditingName(false);
    try {
      await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { name: trimmed },
          updatedBy: "system",
          updatedByName: "App User",
        }),
      });
    } catch {
      setEditedName(agentData.name);
      toast({
        message: "Failed to save name — please try again.",
        variant: "error",
      });
    }
  }, [editedName, agentData.name, agentKey, toast]);

  const saveDescription = useCallback(async () => {
    const trimmed = editedDescription.trim();
    setIsEditingDescription(false);
    if (trimmed === (agentData.description ?? "")) return;
    // Keep the optimistic value visible while the request is in flight
    setEditedDescription(trimmed);
    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { description: trimmed },
          updatedBy: "system",
          updatedByName: "App User",
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      router.refresh();
    } catch {
      setEditedDescription(agentData.description ?? "");
      toast({
        message: "Failed to save description — please try again.",
        variant: "error",
      });
    }
  }, [editedDescription, agentData.description, agentKey, toast, router]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  // Keep editedName/editedDescription in sync when server delivers fresh agentData
  useEffect(() => {
    if (!isEditingName) setEditedName(agentData.name);
  }, [agentData.name, isEditingName]);

  useEffect(() => {
    setEditedDescription(agentData.description ?? "");
  }, [agentData.description]);

  const activeTab = searchParams.get("tab") ?? "job-description";

  const setTab = (tab: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.push(`?${p.toString()}`);
  };

  // Poll active rooms every 5s (LiveKit lookup — cheap).
  useEffect(() => {
    let mounted = true;
    let tid: NodeJS.Timeout;
    const poll = async () => {
      if (!mounted) return;
      try {
        const res = await fetch(`/api/rooms/active?agent=${agentKey}`);
        if (mounted && res.ok) setActiveCalls(await res.json());
      } catch {
        // non-critical
      }
      if (mounted) tid = setTimeout(poll, 5000);
    };
    poll();
    return () => {
      mounted = false;
      clearTimeout(tid);
    };
  }, [agentKey]);

  // Poll call history every 60s — Firestore reads are quota-limited and
  // history only changes when a call ends, so frequent polling is wasteful.
  useEffect(() => {
    let mounted = true;
    let tid: NodeJS.Timeout;
    const poll = async () => {
      if (!mounted) return;
      try {
        const res = await fetch(`/api/history?agent=${agentKey}`);
        if (mounted && res.ok) setCallHistory(await res.json());
      } catch {
        // non-critical
      }
      if (mounted) tid = setTimeout(poll, 60_000);
    };
    poll();
    return () => {
      mounted = false;
      clearTimeout(tid);
    };
  }, [agentKey]);

  const toggleLive = useCallback(
    async (newValue: boolean) => {
      setVoiceEnabled(newValue);
      setIsTogglingLive(true);
      try {
        const res = await fetch(`/api/agents/${agentKey}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: { voiceEnabled: newValue },
            updatedBy: "system",
            updatedByName: "App User",
          }),
        });
        if (!res.ok) throw new Error("Failed");
      } catch {
        setVoiceEnabled(!newValue);
        toast({
          message:
            "Couldn't update live status — check your connection and try again.",
          variant: "error",
        });
      } finally {
        setIsTogglingLive(false);
      }
    },
    [agentKey, toast],
  );

  const handleKebabAction = (action: string) => {
    toast({
      message: `${action} is coming soon — we're working on it.`,
      variant: "info",
    });
  };

  const lastEditedLabel = agentData.updatedAt
    ? `Last edited ${relativeTime(agentData.updatedAt)}${agentData.updatedByName ? ` by ${agentData.updatedByName}` : ""}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          All agents
        </Link>
      </div>

      {voiceEnabled && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          This agent is live. Changes apply to the next call, not calls already
          in progress.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditedName(agentData.name);
                    setIsEditingName(false);
                  }
                }}
                className="text-[26px] font-semibold text-foreground tracking-tight bg-transparent border-b-2 border-primary outline-none w-full pb-0.5"
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="group flex items-center gap-2 text-left"
              >
                <h1 className="text-[26px] font-semibold text-foreground tracking-tight">
                  {editedName}
                </h1>
                <Pencil className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
            {isEditingDescription ? (
              <textarea
                ref={descriptionInputRef}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onBlur={saveDescription}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveDescription();
                  }
                  if (e.key === "Escape") {
                    setEditedDescription(agentData.description ?? "");
                    setIsEditingDescription(false);
                  }
                }}
                rows={1}
                className="text-sm text-foreground bg-transparent border-b border-primary outline-none w-full mt-1 resize-none leading-snug"
              />
            ) : (
              <button
                onClick={() => {
                  setIsEditingDescription(true);
                  setTimeout(() => descriptionInputRef.current?.focus(), 0);
                }}
                className="group flex items-center gap-1.5 text-left mt-1"
              >
                <p className="text-sm text-muted-foreground">
                  {editedDescription || (
                    <span className="italic">Add a description…</span>
                  )}
                </p>
                <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="secondary" className="gap-1.5">
                {agentData.direction === "inbound" ? (
                  <>
                    <PhoneIncoming className="size-3" />
                    Answers calls
                  </>
                ) : (
                  <>
                    <PhoneOutgoing className="size-3" />
                    Makes calls
                  </>
                )}
              </Badge>
              <Badge variant={voiceEnabled ? "success" : "secondary"}>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    voiceEnabled
                      ? "bg-success animate-pulse"
                      : "bg-muted-foreground"
                  }`}
                />
                {voiceEnabled ? "Live" : "Paused"}
              </Badge>
              {lastEditedLabel && (
                <span className="text-xs text-muted-foreground">
                  {lastEditedLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Link
              href={`/playground?agent=${agentKey}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium border border-border bg-white text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Sparkles className="size-3.5" />
              Try it out
            </Link>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {isTogglingLive
                  ? "Updating…"
                  : voiceEnabled
                    ? "Live"
                    : "Paused"}
              </span>
              <Switch
                checked={voiceEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setShowGoLiveModal(true);
                  } else {
                    void toggleLive(false);
                  }
                }}
                disabled={isTogglingLive}
              />
            </div>

            <KebabMenu onAction={handleKebabAction} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-8 items-start">
        <div className="min-w-0">
          <div className="border-b border-border">
            <nav className="flex gap-0 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="pt-6">
            <TabContent
              tab={activeTab}
              agentKey={agentKey}
              agentData={agentData}
              onVoiceEnabledChange={setVoiceEnabled}
            />
          </div>
        </div>

        <div className="sticky top-24">
          <RecentActivityPanel
            activeCalls={activeCalls}
            callHistory={callHistory}
            now={now}
          />
        </div>
      </div>

      <Dialog open={showGoLiveModal} onClose={() => setShowGoLiveModal(false)}>
        <DialogHeader>
          <DialogTitle>Go live?</DialogTitle>
          <DialogClose onClose={() => setShowGoLiveModal(false)} />
        </DialogHeader>
        <DialogContent>
          <DialogDescription>
            Your agent will start{" "}
            {agentData.direction === "inbound"
              ? "answering real incoming"
              : "placing outgoing"}{" "}
            calls right away. Give it a quick test first if you haven&apos;t
            already.
          </DialogDescription>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowGoLiveModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowGoLiveModal(false);
              void toggleLive(true);
            }}
          >
            Go live
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
