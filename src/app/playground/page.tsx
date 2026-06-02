import { cookies } from "next/headers";
import { listAgents } from "@/lib/firebase/agents";
import { PlaygroundClient } from "@/components/PlaygroundClient";
import { Suspense } from "react";

export default async function PlaygroundPage() {
  const uid = (await cookies()).get("__uid")?.value;
  const agentList = await listAgents(uid);
  return (
    <Suspense>
      <PlaygroundClient agents={agentList} />
    </Suspense>
  );
}
