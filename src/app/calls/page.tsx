import { cookies } from "next/headers";
import { listAgents } from "@/lib/firebase/agents";
import { CallHistoryClient } from "@/components/CallHistoryClient";

export default async function CallHistoryPage() {
  const uid = (await cookies()).get("__uid")?.value;
  const [userAgents, allAgents] = await Promise.all([
    listAgents(uid),
    listAgents(),
  ]);
  return (
    <CallHistoryClient
      agents={allAgents}
      userAgentKeys={userAgents.map((a) => a.key)}
    />
  );
}
