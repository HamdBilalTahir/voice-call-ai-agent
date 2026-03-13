"use client";

import { useEffect, useState } from "react";
import { AgentConfig } from "@/lib/agents/registry";
import Link from "next/link";
import { TestCallModal } from "./TestCallModal";

interface AgentClientProps {
  agent: AgentConfig;
  agentKey: string;
}

export function AgentClient({ agent, agentKey }: AgentClientProps) {
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isStartingAgent, setIsStartingAgent] = useState(false);

  useEffect(() => {
    if (!agent) return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchAllData = async () => {
      if (!isMounted) return;

      try {
        // Fetch all data concurrently
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

      if (res.ok) {
        const data = await res.json();
        setIsAgentRunning(data.isRunning);
      } else {
        throw new Error("Failed to toggle agent");
      }
    } catch (e) {
      console.error(e);
      alert("Error toggling agent");
    } finally {
      setIsStartingAgent(false);
    }
  };

  const handleCall = async () => {
    if (!phoneNumber) return;
    setIsCalling(true);
    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: phoneNumber, agentKey }),
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      setPhoneNumber("");
    } catch (e) {
      console.error(e);
      alert("Error triggering call");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold text-white">
              {agent.description}
            </h1>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isAgentRunning ? "bg-green-900/30 text-green-400 border border-green-800/50" : "bg-neutral-800 text-neutral-400 border border-neutral-700"}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${isAgentRunning ? "bg-green-500 animate-pulse" : "bg-neutral-500"}`}
              />
              {isAgentRunning ? "Running" : "Stopped"}
            </div>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <span className="capitalize px-2 py-0.5 bg-neutral-800 rounded-md text-neutral-300 text-sm font-medium border border-neutral-700">
              {agent.direction}
            </span>
            <span className="text-sm">Key: {agent.key}</span>
            <span className="text-sm flex items-center gap-1">
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
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              {agent.phoneNumber || "No number assigned"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
        <h2 className="text-xl font-bold text-white mb-4 flex justify-between items-center">
          Actions
          <div className="flex gap-2">
            <button
              onClick={toggleAgent}
              disabled={isStartingAgent}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isAgentRunning
                  ? "bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-800/50"
                  : "bg-green-600 hover:bg-green-700 text-white"
              } disabled:opacity-50`}
            >
              {isStartingAgent
                ? "Working..."
                : isAgentRunning
                  ? "Stop Agent"
                  : "Start Agent"}
            </button>
            <button
              onClick={() => setIsTestModalOpen(true)}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors"
            >
              Test via Browser
            </button>
          </div>
        </h2>
        {agent.direction === "outbound" ? (
          <div className="flex items-center gap-4 mt-4">
            <input
              type="text"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleCall}
              disabled={isCalling || !phoneNumber}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isCalling ? "Calling..." : "Call"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-neutral-400 py-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Awaiting inbound calls on {agent.phoneNumber}</span>
          </div>
        )}
      </div>

      {isTestModalOpen && (
        <TestCallModal
          agentKey={agentKey}
          onClose={() => setIsTestModalOpen(false)}
        />
      )}

      {/* Active Calls Panel */}
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
                (Date.now() - room.creationTime * 1000) / 1000,
              );
              const mins = Math.floor(duration / 60);
              const secs = duration % 60;
              return (
                <div
                  key={room.name}
                  className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg border border-neutral-700"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{room.name}</span>
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

      {/* Call History Panel */}
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
  );
}
