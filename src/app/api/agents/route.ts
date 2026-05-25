import { NextResponse } from "next/server";
import { listAgents, createAgent } from "@/lib/firebase/agents";
import { agents as registryAgents } from "@/lib/agents/registry";
import { verifyToken } from "@/lib/firebase/providerConfigs";

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const uid = token ? ((await verifyToken(token)) ?? undefined) : undefined;
  const agents = await listAgents(uid);
  return NextResponse.json(agents);
}

const DIRECTION_MAP: Record<string, "inbound" | "outbound"> = {
  inbound: "inbound",
  outbound: "outbound",
  both: "outbound",
};

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  other: "en-US",
};

function templateDispatchRule(direction: "inbound" | "outbound"): string {
  if (direction === "inbound")
    return (
      process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES ??
      registryAgents["restaurant-es"]?.dispatchRuleName ??
      ""
    );
  return (
    process.env.AGENT_DISPATCH_RULE_SALES_EN ??
    registryAgents["sales-en"]?.dispatchRuleName ??
    ""
  );
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const userId = token ? await verifyToken(token) : null;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      name,
      description,
      whatItDoes,
      howItTalks,
      whatToAvoid,
      anythingElse,
      openingLine,
      purpose,
      industry,
      language,
    } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 },
      );
    }

    const direction = DIRECTION_MAP[purpose] ?? "outbound";

    const result = await createAgent({
      name: name.trim(),
      direction,
      language: LANG_MAP[language] ?? "en-US",
      dispatchRuleName: templateDispatchRule(direction),
      description:
        description?.trim() || whatItDoes?.trim() || `${direction} agent`,
      roleAndResponsibilities: whatItDoes?.trim() ?? "",
      personaLanguageAndTone: howItTalks?.trim() ?? "",
      mistakesToAvoid: whatToAvoid?.trim() ?? "",
      additionalInstructions: anythingElse?.trim() ?? "",
      voiceGreeting: openingLine?.trim() ?? "",
      industry: industry ?? "other",
      userId: userId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ key: result.key, name: name.trim() });
  } catch (err) {
    console.error("[POST /api/agents] failed:", err);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 },
    );
  }
}
