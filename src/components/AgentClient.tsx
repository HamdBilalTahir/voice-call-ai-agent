/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentConfig } from "@/lib/agents/registry";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { TestCallPanel } from "./TestCallPanel";

interface AgentClientProps {
  agent: AgentConfig;
  agentKey: string;
}

const TABS = [
  { id: "job-description", label: "AI Job Description" },
  { id: "knowledge-base", label: "Knowledge Base" },
  { id: "agent-settings", label: "Agent Settings" },
  { id: "actions", label: "Actions" },
  { id: "connect", label: "Connect" },
] as const;

import { AIJobDescriptionTab } from "./AIJobDescriptionTab";

function TabContent({ tab, agentKey }: { tab: string; agentKey: string }) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-10 text-center">
      {tab === "job-description" ? (
        <AIJobDescriptionTab agentKey={agentKey} />
      ) : (
        <p className="text-neutral-500 text-base">Coming soon.</p>
      )}
    </div>
  );
}

export function AgentClient({ agent, agentKey }: AgentClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isStartingAgent, setIsStartingAgent] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
      alert("Error toggling agent");
    } finally {
      setIsStartingAgent(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-base text-neutral-400 hover:text-white transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_420px] gap-8 items-start">
        {/* Left column */}
        <div className="min-w-0 space-y-8">
          {/* Page header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white">{agent.name}</h1>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-base text-neutral-500">
                  ID:{" "}
                  <span className="text-neutral-400 font-mono">{agentKey}</span>
                </span>
                <span className="capitalize px-3 py-1 bg-neutral-800 rounded-md text-neutral-300 text-sm font-medium border border-neutral-700">
                  {agent.direction}
                </span>
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    isAgentRunning
                      ? "bg-green-900/30 text-green-400 border border-green-800/50"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isAgentRunning
                        ? "bg-green-500 animate-pulse"
                        : "bg-neutral-500"
                    }`}
                  />
                  {isAgentRunning ? "Running" : "Stopped"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-medium text-neutral-400">
                {isStartingAgent
                  ? "Working..."
                  : isAgentRunning
                    ? "Active"
                    : "Inactive"}
              </span>
              <Switch
                checked={isAgentRunning}
                onCheckedChange={toggleAgent}
                disabled={isStartingAgent}
                className="data-checked:bg-green-500 data-unchecked:bg-neutral-600"
              />
            </div>
          </div>

          {/* Tab navigation */}
          <div className="border-b border-neutral-700">
            <nav className="flex gap-1 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`px-5 py-3 text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <TabContent tab={activeTab} agentKey={agentKey} />

          {/* Active Calls */}
          <div className="bg-neutral-800 rounded-xl p-7 border border-neutral-700">
            <h2 className="text-2xl font-bold text-white mb-5 flex items-center justify-between">
              Active Calls
              {activeCalls.length > 0 && (
                <span className="text-sm font-normal px-3 py-1 bg-blue-600/20 text-blue-400 rounded-md">
                  {activeCalls.length} live
                </span>
              )}
            </h2>
            {activeCalls.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-base">
                No active calls
              </div>
            ) : (
              <div className="space-y-3">
                {activeCalls.map((room) => {
                  const duration = Math.floor(
                    (now - room.creationTime * 1000) / 1000,
                  );
                  const mins = Math.floor(duration / 60);
                  const secs = duration % 60;
                  return (
                    <div
                      key={room.name}
                      className="flex items-center justify-between p-5 bg-neutral-900 rounded-lg border border-neutral-700"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-white text-base">
                          {room.name}
                        </span>
                        <span className="text-sm text-neutral-400">
                          {room.numParticipants} participants • Live: {mins}:
                          {secs.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <Link href={`/calls/${room.name}`}>
                        <button className="px-5 py-2.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-base font-medium transition-colors">
                          View Transcript
                        </button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Call History */}
          <div className="bg-neutral-800 rounded-xl p-7 border border-neutral-700">
            <h2 className="text-2xl font-bold text-white mb-5">Call History</h2>
            {callHistory.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-base">
                No call history yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-700 text-base text-neutral-400">
                      <th className="py-4 font-medium">Phone Number</th>
                      <th className="py-4 font-medium">Start Time</th>
                      <th className="py-4 font-medium">Duration</th>
                      <th className="py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-base">
                    {callHistory.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-neutral-700/50 last:border-0"
                      >
                        <td className="py-4 text-white font-medium">
                          {record.phoneNumber}
                        </td>
                        <td className="py-4 text-neutral-400">
                          {new Date(record.startTime).toLocaleString()}
                        </td>
                        <td className="py-4 text-neutral-400">
                          {record.duration ? `${record.duration}s` : "-"}
                        </td>
                        <td className="py-4">
                          <span
                            className={`px-3 py-1 rounded-md text-sm font-medium ${
                              record.status === "completed"
                                ? "bg-green-900/30 text-green-400"
                                : record.status === "missed"
                                  ? "bg-red-900/30 text-red-400"
                                  : "bg-blue-900/30 text-blue-400"
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar — sticky */}
        <div className="sticky top-24 mt-[148px]">
          <TestCallPanel agent={agent} agentKey={agentKey} />
        </div>
      </div>
    </div>
  );
}
