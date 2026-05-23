import { listAgents } from "@/lib/firebase/agents";
import { CallHistoryClient } from "@/components/CallHistoryClient";

export default async function CallHistoryPage() {
  const agentList = await listAgents();
  return <CallHistoryClient agents={agentList} />;
}
