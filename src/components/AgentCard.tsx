"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { AgentConfig } from "@/lib/agents/registry";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AgentCard({ agent }: { agent: AgentConfig }) {
  const [activeCalls, setActiveCalls] = useState(0);

  useEffect(() => {
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
    <Link
      href={`/agents/${agent.direction}/${agent.key}`}
      className="block h-full"
    >
      <div
        className={cn(
          "bg-card rounded-xl p-6 border border-border shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full flex flex-col",
        )}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base font-semibold text-foreground mb-1.5 leading-snug">
              {agent.description}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">
                {agent.direction}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                activeCalls > 0 ? "bg-success animate-pulse" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                activeCalls > 0 ? "text-success" : "text-muted-foreground",
              )}
            >
              {activeCalls} active
            </span>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            <span className="truncate">
              {agent.phoneNumber || "No number assigned"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
