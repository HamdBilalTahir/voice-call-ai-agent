import { agents } from "@/lib/agents/registry";
import { AgentClient } from "@/components/AgentClient";
import Link from "next/link";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{
    direction: string;
    agentKey: string;
  }>;
}

export default async function AgentPage({ params }: PageProps) {
  const { direction, agentKey } = await params;
  const agent = agents[agentKey];

  if (!agent || agent.direction !== direction) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Agent not found
        </h1>
        <p className="text-muted-foreground">
          The requested agent could not be found.
        </p>
        <Link
          href="/"
          className="inline-flex items-center h-9 px-4 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
        >
          Return home
        </Link>
      </div>
    );
  }

  return (
    <Suspense>
      <AgentClient agent={agent} agentKey={agentKey} />
    </Suspense>
  );
}
