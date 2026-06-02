/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  PhoneCall,
  PhoneMissed,
  PhoneIncoming,
  TrendingUp,
  TrendingDown,
  Minus,
  Bot,
  Plus,
  Clock,
  BarChart2,
  Users,
  ExternalLink,
} from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import { CallRecord } from "@/lib/history";
import type { DashboardStats } from "@/app/api/dashboard/route";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 64;
  const H = 28;
  const pad = 2;

  const pts = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * (W - pad * 2) + pad;
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className="opacity-70"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function TrendChip({
  value,
  positiveGood = true,
}: {
  value: number | null;
  positiveGood?: boolean;
}) {
  if (value === null) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
        <Minus className="size-3" /> No prior day
      </span>
    );
  }
  const isPositive = value >= 0;
  const isGood = positiveGood ? isPositive : !isPositive;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        isGood ? "text-success" : "text-destructive",
      )}
    >
      {isPositive ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {Math.abs(value)}% vs yesterday
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: React.ReactNode;
  trend: number | null;
  sparkline: number[];
  icon: React.ElementType;
  href: string;
  loading?: boolean;
  positiveGood?: boolean;
  accentClass?: string;
}

function KPICard({
  title,
  value,
  trend,
  sparkline,
  icon: Icon,
  href,
  loading,
  positiveGood = true,
  accentClass = "text-primary",
}: KPICardProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-3 w-24 mb-4" />
        <Skeleton className="h-7 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </Card>
    );
  }

  return (
    <Link href={href} className="block group/kpi">
      <Card className="p-5 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Icon className={cn("size-3.5 shrink-0", accentClass)} />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
          </div>
          <span className={cn(accentClass)}>
            <Sparkline data={sparkline} />
          </span>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums mb-1.5">
          {value ?? <span className="text-muted-foreground text-lg">—</span>}
        </p>
        <TrendChip value={trend} positiveGood={positiveGood} />
      </Card>
    </Link>
  );
}

// ─── Live Activity Panel ──────────────────────────────────────────────────────

function LiveActivityPanel({ rooms, now }: { rooms: any[]; now: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              rooms.length > 0
                ? "bg-success animate-pulse"
                : "bg-muted-foreground/40",
            )}
          />
          <h2 className="text-sm font-semibold text-foreground">Live now</h2>
        </div>
        {rooms.length > 0 && (
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            {rooms.length} active
          </Badge>
        )}
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={<PhoneIncoming className="size-5" />}
          title="No live calls right now"
          description="Your agents are standing by and ready to answer."
          className="py-8"
        />
      ) : (
        <div className="divide-y divide-border">
          {rooms.map((room: any) => {
            const elapsed = Math.floor((now - room.creationTime * 1000) / 1000);
            const m = Math.floor(elapsed / 60);
            const s = elapsed % 60;
            return (
              <div
                key={room.name}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <PhoneCall className="size-3.5 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {room.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {room.numParticipants} participant
                      {room.numParticipants !== 1 ? "s" : ""} · {m}:
                      {s.toString().padStart(2, "0")}
                    </p>
                  </div>
                </div>
                <Link href={`/calls/${room.name}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="size-3.5" />
                    Transcript
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Recent Calls ─────────────────────────────────────────────────────────────

const STATUS_MAP = {
  completed: {
    label: "Completed",
    variant: "success" as const,
    icon: PhoneCall,
  },
  missed: {
    label: "Missed",
    variant: "destructive" as const,
    icon: PhoneMissed,
  },
  "in-progress": {
    label: "Live",
    variant: "default" as const,
    icon: PhoneCall,
  },
};

function RecentCallsPanel({
  calls,
  agentMap,
  loading,
}: {
  calls: CallRecord[];
  agentMap: Record<string, AgentConfig>;
  loading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Recent calls</h2>
        <Link
          href="/calls"
          className="text-xs text-primary hover:underline font-medium"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : calls.length === 0 ? (
        <EmptyState
          icon={<Clock className="size-5" />}
          title="No calls yet"
          description="Past calls will appear here once they complete."
          action={
            <Link href="/playground">
              <Button variant="outline" size="sm">
                <ExternalLink className="size-3.5" />
                Try a test call
              </Button>
            </Link>
          }
          className="py-8"
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-border">
            {calls.map((call) => {
              const {
                label,
                variant,
                icon: StatusIcon,
              } = STATUS_MAP[call.status] ?? STATUS_MAP.completed;
              const agent = agentMap[call.agentKey];
              return (
                <div
                  key={call.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground font-mono truncate">
                      {call.phoneNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {agent?.name ?? call.agentKey}
                      {call.duration
                        ? ` · ${formatDuration(call.duration)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={variant} className="gap-1">
                      <StatusIcon className="size-2.5" />
                      {label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(call.startTime)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => {
                  const {
                    label,
                    variant,
                    icon: StatusIcon,
                  } = STATUS_MAP[call.status] ?? STATUS_MAP.completed;
                  const agent = agentMap[call.agentKey];
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium text-foreground tabular-nums">
                        {call.phoneNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {agent?.name ?? call.agentKey}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {call.duration ? formatDuration(call.duration) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant} className="gap-1">
                          <StatusIcon className="size-2.5" />
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatRelative(call.startTime)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Agents Panel ─────────────────────────────────────────────────────────────

function AgentStatusPill({
  agent,
  isRunning,
}: {
  agent: AgentConfig;
  isRunning: boolean | null;
}) {
  if (isRunning === null) {
    return <Skeleton className="h-5 w-14 rounded-full" />;
  }
  if (!agent.phoneNumber) {
    return <Badge variant="outline">Draft</Badge>;
  }
  return isRunning ? (
    <Badge variant="success">
      <span className="size-1.5 rounded-full bg-success animate-pulse" />
      Live
    </Badge>
  ) : (
    <Badge variant="secondary">Paused</Badge>
  );
}

function AgentsPanel({
  agents,
  agentStatuses,
}: {
  agents: AgentConfig[];
  agentStatuses: Record<string, boolean | null>;
}) {
  const shown = agents.slice(0, 4);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Your agents</h2>
        <Link
          href="/agents"
          className="text-xs text-primary hover:underline font-medium"
        >
          View all
        </Link>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="size-5" />}
          title="No agents yet"
          description="Create your first agent to start taking calls."
          action={
            <Button
              size="sm"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-welcome-modal"))
              }
            >
              <Plus className="size-3.5" />
              New agent
            </Button>
          }
          className="py-8"
        />
      ) : (
        <div className="divide-y divide-border">
          {shown.map((agent) => (
            <div
              key={agent.key}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {agent.name}
                </p>
                <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                  {agent.phoneNumber || "No number assigned"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AgentStatusPill
                  agent={agent}
                  isRunning={agentStatuses[agent.key] ?? null}
                />
                <Link href={`/agents/${agent.direction}/${agent.key}`}>
                  <Button variant="ghost" size="xs">
                    Test
                  </Button>
                </Link>
              </div>
            </div>
          ))}
          {agents.length > 4 && (
            <div className="px-5 py-3">
              <Link
                href="/agents"
                className="text-xs text-primary hover:underline font-medium"
              >
                +{agents.length - 4} more agents
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── First-run Empty State ────────────────────────────────────────────────────

function FirstRunState() {
  const steps = [
    {
      n: "1",
      label: "Describe the job",
      sub: "Tell us what calls your agent should handle",
    },
    {
      n: "2",
      label: "Pick a phone number",
      sub: "Choose a local or toll-free number",
    },
    { n: "3", label: "Go live", sub: "Test it, then turn it on" },
  ];

  function openWelcome() {
    window.dispatchEvent(new CustomEvent("open-welcome-modal"));
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full text-center">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Bot className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Create your first voice agent
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
          Your agent will answer calls, take messages, and handle enquiries —
          automatically, 24/7.
        </p>

        <div className="flex items-start justify-center gap-0 mb-8 text-left">
          {steps.map((step, i) => (
            <div key={step.n} className="flex items-start gap-0">
              <div className="flex flex-col items-center w-40">
                <div className="size-8 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-primary mb-2">
                  {step.n}
                </div>
                <p className="text-xs font-semibold text-foreground text-center leading-tight mb-1">
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground text-center leading-tight">
                  {step.sub}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="w-12 h-px bg-border mt-4 mx-1 shrink-0" />
              )}
            </div>
          ))}
        </div>

        <Button size="lg" onClick={openWelcome}>
          <Plus className="size-4" />
          Create your first agent
        </Button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface DashboardClientProps {
  agents: AgentConfig[];
}

export function DashboardClient({ agents }: DashboardClientProps) {
  const [greeting, setGreeting] = useState("Welcome");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<
    Record<string, boolean | null>
  >(() => Object.fromEntries(agents.map((a) => [a.key, null])));
  const [statsLoading, setStatsLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Greeting
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening",
    );
  }, []);

  // Tick for live call durations
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const agentMap = Object.fromEntries(agents.map((a) => [a.key, a]));

  // Fetch dashboard stats (slow poll)
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
      setRecentCalls(data.recentCalls);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch live rooms (fast poll)
  const fetchLiveRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms/active");
      if (res.ok) setLiveRooms(await res.json());
    } catch {
      /* non-fatal */
    }
  }, []);

  // Fetch agent run statuses
  const fetchAgentStatuses = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        agents.map(async (agent) => {
          const res = await fetch(`/api/agents/process?agentKey=${agent.key}`);
          const data = await res.json();
          return [agent.key, data.isRunning] as const;
        }),
      );
      const map: Record<string, boolean | null> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
      }
      setAgentStatuses((prev) => ({ ...prev, ...map }));
    } catch {
      /* non-fatal */
    }
  }, [agents]);

  // Initial + polling
  useEffect(() => {
    fetchStats();
    fetchLiveRooms();
    fetchAgentStatuses();

    const statsId = setInterval(fetchStats, 30_000);
    const roomsId = setInterval(fetchLiveRooms, 4_000);
    const statusId = setInterval(fetchAgentStatuses, 8_000);

    return () => {
      clearInterval(statsId);
      clearInterval(roomsId);
      clearInterval(statusId);
    };
  }, [fetchStats, fetchLiveRooms, fetchAgentStatuses]);

  // Active agents = count of running agents
  const activeAgentCount = Object.values(agentStatuses).filter(Boolean).length;
  const totalAgents = agents.length;

  // First-run state
  if (agents.length === 0) {
    return <FirstRunState />;
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-foreground tracking-tight">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {liveRooms.length > 0
              ? `${liveRooms.length} call${liveRooms.length !== 1 ? "s" : ""} happening right now`
              : "Your agents are ready to take calls"}
          </p>
        </div>
        {liveRooms.length > 0 ? (
          <Button>
            <PhoneCall className="size-4" />
            View live calls ({liveRooms.length})
          </Button>
        ) : (
          <Button variant="outline">
            <Plus className="size-4" />
            Create agent
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Calls today"
          value={stats?.callsToday}
          trend={stats?.callsTodayTrend ?? null}
          sparkline={stats?.callsSparkline ?? []}
          icon={PhoneCall}
          href="/analytics"
          loading={statsLoading}
          accentClass="text-primary"
        />
        <KPICard
          title="Avg. duration"
          value={
            stats?.avgDuration != null
              ? formatDuration(stats.avgDuration)
              : null
          }
          trend={stats?.avgDurationTrend ?? null}
          sparkline={stats?.durationSparkline ?? []}
          icon={Clock}
          href="/analytics"
          loading={statsLoading}
          accentClass="text-warning"
        />
        <KPICard
          title="Success rate"
          value={stats?.successRate != null ? `${stats.successRate}%` : null}
          trend={stats?.successRateTrend ?? null}
          sparkline={stats?.successSparkline ?? []}
          icon={BarChart2}
          href="/analytics"
          loading={statsLoading}
          accentClass="text-success"
        />
        <KPICard
          title="Active agents"
          value={`${activeAgentCount} / ${totalAgents}`}
          trend={null}
          sparkline={[]}
          icon={Users}
          href="/agents"
          loading={false}
          accentClass="text-primary"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left col: Live + Recent calls */}
        <div className="lg:col-span-3 space-y-5">
          <LiveActivityPanel rooms={liveRooms} now={now} />
          <RecentCallsPanel
            calls={recentCalls}
            agentMap={agentMap}
            loading={statsLoading}
          />
        </div>

        {/* Right col: Agents panel */}
        <div className="lg:col-span-2">
          <AgentsPanel agents={agents} agentStatuses={agentStatuses} />
        </div>
      </div>
    </div>
  );
}
