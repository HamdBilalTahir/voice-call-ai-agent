/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentConfig } from "@/lib/agents/registry";
import Link from "next/link";
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

function TabContent({ tab }: { tab: string }) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-8 text-center">
      {tab === "job-description" ? (
        <p className="text-neutral-400">Prompt sections coming in next task.</p>
      ) : (
        <p className="text-neutral-500">Coming soon.</p>
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
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
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
      <div className="grid grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left column */}
        <div className="min-w-0 space-y-6">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">{agent.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-sm text-neutral-500">
                  ID:{" "}
                  <span className="text-neutral-400 font-mono">{agentKey}</span>
                </span>
                <span className="capitalize px-2 py-0.5 bg-neutral-800 rounded-md text-neutral-300 text-xs font-medium border border-neutral-700">
                  {agent.direction}
                </span>
                <div
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isAgentRunning
                      ? "bg-green-900/30 text-green-400 border border-green-800/50"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isAgentRunning
                        ? "bg-green-500 animate-pulse"
                        : "bg-neutral-500"
                    }`}
                  />
                  {isAgentRunning ? "Running" : "Stopped"}
                </div>
              </div>
            </div>
            <button
              onClick={toggleAgent}
              disabled={isStartingAgent}
              className="shrink-0 flex items-center gap-2.5 disabled:opacity-50 group"
              title={isAgentRunning ? "Deactivate agent" : "Activate agent"}
            >
              <span className="text-xs font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors">
                {isStartingAgent
                  ? "Working..."
                  : isAgentRunning
                    ? "Active"
                    : "Inactive"}
              </span>
              {/* Track */}
              <div
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  isAgentRunning ? "bg-green-500" : "bg-neutral-600"
                }`}
              >
                {/* Thumb */}
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    isAgentRunning ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Tab navigation */}
          <div className="border-b border-neutral-700">
            <nav className="flex gap-1 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          <TabContent tab={activeTab} />

          {/* Active Calls */}
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
              Active Calls
              {activeCalls.length > 0 && (
                <span className="text-sm font-normal px-2 py-1 bg-blue-600/20 text-blue-400 rounded-md">
                  {activeCalls.length} live
                </span>
              )}
            </h2>
            {activeCalls.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
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
                      className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg border border-neutral-700"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-white">
                          {room.name}
                        </span>
                        <span className="text-sm text-neutral-400">
                          {room.numParticipants} participants • Live: {mins}:
                          {secs.toString().padStart(2, "0")}
                        </span>
                      </div>
                      <Link href={`/calls/${room.name}`}>
                        <button className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors">
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
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <h2 className="text-xl font-bold text-white mb-4">Call History</h2>
            {callHistory.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No call history yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-700 text-sm text-neutral-400">
                      <th className="py-3 font-medium">Phone Number</th>
                      <th className="py-3 font-medium">Start Time</th>
                      <th className="py-3 font-medium">Duration</th>
                      <th className="py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {callHistory.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-neutral-700/50 last:border-0"
                      >
                        <td className="py-3 text-white font-medium">
                          {record.phoneNumber}
                        </td>
                        <td className="py-3 text-neutral-400">
                          {new Date(record.startTime).toLocaleString()}
                        </td>
                        <td className="py-3 text-neutral-400">
                          {record.duration ? `${record.duration}s` : "-"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${
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
        <div className="sticky top-24">
          <TestCallPanel agent={agent} agentKey={agentKey} />
        </div>
      </div>
    </div>
  );
}
