import { listAgents } from "@/lib/firebase/agents";
import { PlaygroundClient } from "@/components/PlaygroundClient";
import { Suspense } from "react";

export default async function PlaygroundPage() {
  const agentList = await listAgents();
  return (
    <Suspense>
      <PlaygroundClient agents={agentList} />
    </Suspense>
  );
}
