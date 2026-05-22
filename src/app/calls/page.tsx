import { agents } from "@/lib/agents/registry";
import { CallHistoryClient } from "@/components/CallHistoryClient";

export default function CallHistoryPage() {
  const agentList = Object.values(agents);
  return <CallHistoryClient agents={agentList} />;
}
