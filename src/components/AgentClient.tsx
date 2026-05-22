/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentConfig } from "@/lib/agents/registry";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  MoreHorizontal,
  Sparkles,
  Pencil,
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

interface AgentClientProps {
  agent: AgentConfig;
  agentKey: string;
}

// ---- helpers ----------------------------------------------------------------

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---- KebabMenu --------------------------------------------------------------

function KebabMenu({ onAction }: { onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

// ---- RecentActivityPanel ----------------------------------------------------

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

          {callHistory.slice(0, 8).map((record) => (
            <div
              key={record.id}
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

// ---- Tabs -------------------------------------------------------------------

const TABS = [
  { id: "job-description", label: "Instructions" },
  { id: "knowledge-base", label: "Knowledge" },
  { id: "agent-settings", label: "Voice & Behavior" },
  { id: "actions", label: "Tools & Actions" },
  { id: "connect", label: "Phone & Channels" },
] as const;

function TabContent({ tab, agentKey }: { tab: string; agentKey: string }) {
  if (tab === "job-description") {
    return <InstructionsTab agentKey={agentKey} />;
  }
  return (
    <div className="bg-card border border-border rounded-xl px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}

// ---- AgentClient ------------------------------------------------------------

export function AgentClient({ agent, agentKey }: AgentClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isStartingAgent, setIsStartingAgent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(agent.name);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  const activeTab = searchParams.get("tab") ?? "job-description";

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    if (!agent) return;
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchAllData = async () => {
      if (!isMounted) return;
      try {
        const [activeRes, historyRes, statusRes] = await Promise.all([
          fetch(`/api/rooms/active?agent=${agentKey}`),
          fetch(`/api/history?agent=${agentKey}`),
          fetch(`/api/agents/process?agentKey=${agentKey}`),
        ]);
        if (isMounted) {
          if (activeRes.ok) setActiveCalls(await activeRes.json());
          if (historyRes.ok) setCallHistory(await historyRes.json());
          if (statusRes.ok)
            setIsAgentRunning((await statusRes.json()).isRunning);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching agent data:", error);
      }
      if (isMounted) {
        timeoutId = setTimeout(fetchAllData, 3000);
      }
    };

    fetchAllData();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [agentKey, agent]);

  const toggleAgent = async () => {
    setIsStartingAgent(true);
    try {
      const action = isAgentRunning ? "stop" : "start";
      const res = await fetch("/api/agents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, action }),
      });
      if (res.ok) setIsAgentRunning((await res.json()).isRunning);
      else throw new Error("Failed to toggle agent");
    } catch (e) {
      console.error(e);
      toast({
        message: "Couldn't update the agent — try again in a moment.",
        variant: "error",
      });
    } finally {
      setIsStartingAgent(false);
    }
  };

  const handleKebabAction = (action: string) => {
    toast({
      message: `${action} is coming soon — we're working on it.`,
      variant: "info",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          All agents
        </Link>
      </div>

      {/* Agent header */}
      <div className="bg-card border border-border rounded-xl px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: name + badges */}
          <div className="min-w-0">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape")
                    setIsEditingName(false);
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
            <p className="text-sm text-muted-foreground mt-1">
              {agent.description}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="secondary" className="gap-1.5">
                {agent.direction === "inbound" ? (
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
              <Badge variant={isAgentRunning ? "success" : "secondary"}>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAgentRunning
                      ? "bg-success animate-pulse"
                      : "bg-muted-foreground"
                  }`}
                />
                {isAgentRunning ? "Live" : "Paused"}
              </Badge>
            </div>
          </div>

          {/* Right: Test agent + toggle + kebab */}
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
                {isStartingAgent
                  ? "Working…"
                  : isAgentRunning
                    ? "Live"
                    : "Paused"}
              </span>
              <Switch
                checked={isAgentRunning}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setShowGoLiveModal(true);
                  } else {
                    void toggleAgent();
                  }
                }}
                disabled={isStartingAgent}
              />
            </div>

            <KebabMenu onAction={handleKebabAction} />
          </div>
        </div>
      </div>

      {/* Main grid: tabs left, activity right */}
      <div className="grid grid-cols-[1fr_360px] gap-8 items-start">
        {/* Left: tab nav + content */}
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
            <TabContent tab={activeTab} agentKey={agentKey} />
          </div>
        </div>

        {/* Right: recent activity */}
        <div className="sticky top-24">
          <RecentActivityPanel
            activeCalls={activeCalls}
            callHistory={callHistory}
            now={now}
          />
        </div>
      </div>

      {/* Go live confirmation modal */}
      <Dialog open={showGoLiveModal} onClose={() => setShowGoLiveModal(false)}>
        <DialogHeader>
          <DialogTitle>Go live?</DialogTitle>
          <DialogClose onClose={() => setShowGoLiveModal(false)} />
        </DialogHeader>
        <DialogContent>
          <DialogDescription>
            Your agent will start{" "}
            {agent.direction === "inbound"
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
              void toggleAgent();
            }}
          >
            Go live
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
