import { agents } from "@/lib/agents/registry";
import { AgentClient } from "@/components/AgentClient";
import Link from "next/link";

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
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-2xl font-bold text-white mb-4">Agent Not Found</h1>
        <p className="text-neutral-400 mb-8">
          The requested agent could not be found.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Return Home
        </Link>
      </div>
    );
  }

  return <AgentClient agent={agent} agentKey={agentKey} />;
}
