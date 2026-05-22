import { NextResponse } from "next/server";
import { getCallHistory, CallRecord } from "@/lib/history";
import { agents } from "@/lib/agents/registry";

const DAY_MS = 86_400_000;

type FinishedCall = CallRecord & { status: "completed" | "missed" };

function isFinished(r: CallRecord): r is FinishedCall {
  return r.status === "completed" || r.status === "missed";
}

function avgDur(calls: CallRecord[]): number | null {
  const withDur = calls.filter((r) => r.duration != null && r.duration > 0);
  if (!withDur.length) return null;
  return Math.round(
    withDur.reduce((s, r) => s + (r.duration ?? 0), 0) / withDur.length,
  );
}

function successRate(calls: CallRecord[]): number | null {
  const finished = calls.filter(isFinished);
  if (!finished.length) return null;
  return Math.round(
    (finished.filter((r) => r.status === "completed").length /
      finished.length) *
      100,
  );
}

function trend(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

export interface DashboardStats {
  callsToday: number;
  callsTodayTrend: number | null;
  avgDuration: number | null;
  avgDurationTrend: number | null;
  successRate: number | null;
  successRateTrend: number | null;
  callsSparkline: number[];
  durationSparkline: number[];
  successSparkline: number[];
}

export interface DashboardResponse {
  stats: DashboardStats;
  recentCalls: CallRecord[];
}

export async function GET() {
  const all = getCallHistory();
  const now = Date.now();

  const today = all.filter((r) => r.startTime >= now - DAY_MS);
  const yesterday = all.filter(
    (r) => r.startTime >= now - 2 * DAY_MS && r.startTime < now - DAY_MS,
  );

  // 7-day daily sparklines (index 0 = 7 days ago, index 6 = today)
  const callsSparkline: number[] = [];
  const durationSparkline: number[] = [];
  const successSparkline: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const start = now - (i + 1) * DAY_MS;
    const end = now - i * DAY_MS;
    const slice = all.filter((r) => r.startTime >= start && r.startTime < end);
    callsSparkline.push(slice.length);
    durationSparkline.push(avgDur(slice) ?? 0);
    successSparkline.push(successRate(slice) ?? 0);
  }

  const stats: DashboardStats = {
    callsToday: today.length,
    callsTodayTrend: trend(today.length, yesterday.length),
    avgDuration: avgDur(today),
    avgDurationTrend: trend(avgDur(today), avgDur(yesterday)),
    successRate: successRate(today),
    successRateTrend: (() => {
      const t = successRate(today);
      const y = successRate(yesterday);
      return t !== null && y !== null ? t - y : null;
    })(),
    callsSparkline,
    durationSparkline,
    successSparkline,
  };

  const recentCalls = [...all]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 5);

  const agentList = Object.values(agents);

  return NextResponse.json({
    stats,
    recentCalls,
    agents: agentList,
  } satisfies DashboardResponse & { agents: typeof agentList });
}
