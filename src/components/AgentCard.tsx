"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentConfig } from "@/lib/agents/registry";

export function AgentCard({ agent }: { agent: AgentConfig }) {
  const [activeCalls, setActiveCalls] = useState(0);

  useEffect(() => {
    // Only poll when the document is visible to save requests when user is on another tab
    // However, when changing Next.js pages, components might not completely unmount instantly in Dev Mode.
    // Adding an unmounted flag ensures async fetches don't set state after unmount
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchActiveCalls = async () => {
      if (!isMounted) return;

      try {
        const res = await fetch(`/api/rooms/active?agent=${agent.key}`);
        if (res.ok && isMounted) {
          const rooms = await res.json();
          setActiveCalls(rooms.length);
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching active calls:", error);
      }

      if (isMounted) {
        timeoutId = setTimeout(fetchActiveCalls, 5000);
      }
    };

    fetchActiveCalls();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [agent.key]);

  return (
    <Link href={`/agents/${agent.direction}/${agent.key}`}>
      <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700 hover:border-blue-500 transition-colors cursor-pointer relative group h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              {agent.description}
            </h2>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <span className="capitalize px-2 py-0.5 bg-neutral-700 rounded-md text-neutral-300 text-xs font-medium">
                {agent.direction}
              </span>
              <span>{agent.key}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-300">
              {activeCalls} active
            </span>
            <div
              className={`w-3 h-3 rounded-full ${
                activeCalls > 0
                  ? "bg-green-500 animate-pulse"
                  : "bg-neutral-600"
              }`}
            />
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-neutral-700">
          <div className="text-sm text-neutral-400 flex items-center gap-2">
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
          </div>
        </div>
      </div>
    </Link>
  );
}
