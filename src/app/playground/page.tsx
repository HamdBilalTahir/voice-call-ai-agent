import { agents } from "@/lib/agents/registry";
import { PlaygroundClient } from "@/components/PlaygroundClient";
import { Suspense } from "react";

export default function PlaygroundPage() {
  const agentList = Object.values(agents);
  return (
    <Suspense>
      <PlaygroundClient agents={agentList} />
    </Suspense>
  );
}
