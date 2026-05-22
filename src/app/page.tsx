import { listAgents } from "@/lib/firebase/agents";
import { DashboardClient } from "@/components/DashboardClient";

export default async function HomePage() {
  const agentList = await listAgents();
  return <DashboardClient agents={agentList} />;
}
