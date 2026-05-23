import { NextRequest, NextResponse } from "next/server";
import { getAgent, updateAgentConfig } from "@/lib/firebase/agents";

// ─── GET /api/agents/[agentKey]/prompt ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  try {
    const { agentKey } = await params;

    // Try Firestore first (works for both dynamic and static agents)
    const agentData = await getAgent(agentKey);
    if (!agentData) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({
      roleAndResponsibilities: agentData.roleAndResponsibilities ?? "",
      personaLanguageAndTone: agentData.personaLanguageAndTone ?? "",
      mistakesToAvoid: agentData.mistakesToAvoid ?? "",
      additionalInstructions: agentData.additionalInstructions ?? "",
      voiceGreeting: agentData.voiceGreeting ?? "",
    });
  } catch (error) {
    console.error("[prompt/GET] failed:", error);
    return NextResponse.json(
      { error: "Failed to read prompt" },
      { status: 500 },
    );
  }
}

// ─── POST /api/agents/[agentKey]/prompt ──────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  try {
    const { agentKey } = await params;

    const {
      roleAndResponsibilities,
      personaLanguageAndTone,
      mistakesToAvoid,
      additionalInstructions,
      voiceGreeting,
    } = await request.json();

    const result = await updateAgentConfig(
      agentKey,
      {
        roleAndResponsibilities,
        personaLanguageAndTone,
        mistakesToAvoid,
        additionalInstructions,
        voiceGreeting,
      },
      { updatedBy: "system", updatedByName: "App User" },
    );

    if (!result.ok) {
      if ("conflict" in result && result.conflict) {
        return NextResponse.json(result, { status: 409 });
      }
      const msg = "error" in result ? result.error : "Save failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[prompt/POST] failed:", error);
    return NextResponse.json(
      { error: "Failed to save prompt" },
      { status: 500 },
    );
  }
}
