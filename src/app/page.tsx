import { agents } from "@/lib/agents/registry";
import { DashboardClient } from "@/components/DashboardClient";

export default function HomePage() {
  const agentList = Object.values(agents);
  return <DashboardClient agents={agentList} />;
}
