import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/lib/firebase/agents";
import { buildSystemPrompt } from "@/lib/agents/promptBuilder";

type Params = Promise<{ agentKey: string }>;

/**
 * GET /api/agents/[agentKey]/compiled-prompt
 *
 * Returns the fully assembled system prompt exactly as the LLM receives it at
 * call time: platform voice rules prepended, then the four user-editable sections
 * with bracketed headers. voiceGreeting is a separate utterance and is NOT included.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { agentKey } = await params;
    const agent = await getAgent(agentKey);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const prompt = buildSystemPrompt({
      roleAndResponsibilities: agent.roleAndResponsibilities,
      personaLanguageAndTone: agent.personaLanguageAndTone,
      mistakesToAvoid: agent.mistakesToAvoid,
      additionalInstructions: agent.additionalInstructions,
    });

    return new Response(prompt, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[compiled-prompt] failed:", err);
    return NextResponse.json(
      { error: "Failed to compile prompt" },
      { status: 500 },
    );
  }
}
