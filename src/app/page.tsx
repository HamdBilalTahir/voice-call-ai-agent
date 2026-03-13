import { agents } from "@/lib/agents/registry";
import { AgentCard } from "@/components/AgentCard";

export default function Home() {
  const agentList = Object.values(agents);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Agents Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agentList.map((agent) => (
          <AgentCard key={agent.key} agent={agent} />
        ))}
      </div>
    </div>
  );
}
