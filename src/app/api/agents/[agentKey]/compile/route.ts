import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/lib/firebase/agents";
import {
  compilePromptSections,
  hashPromptSections,
} from "@/lib/agents/promptCompiler";
import {
  getCompiledPrompt,
  saveCompiledPrompt,
} from "@/lib/firebase/agentCompiled";

type Params = Promise<{ agentKey: string }>;

/**
 * POST /api/agents/[agentKey]/compile
 *
 * Manually triggers a prompt compile for an agent. Skips if the source hash
 * hasn't changed since the last compile. Pass ?force=true to recompile anyway.
 *
 * Returns the compiled config on success.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { agentKey } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 },
    );
  }

  const agent = await getAgent(agentKey);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const sections = {
    roleAndResponsibilities: agent.roleAndResponsibilities,
    personaLanguageAndTone: agent.personaLanguageAndTone,
    mistakesToAvoid: agent.mistakesToAvoid,
    additionalInstructions: agent.additionalInstructions,
  };

  if (!force) {
    const newHash = hashPromptSections(sections);
    const existing = await getCompiledPrompt(agentKey);
    if (existing?.sourceHash === newHash) {
      return NextResponse.json({ skipped: true, compiled: existing });
    }
  }

  try {
    const compiled = await compilePromptSections(sections, apiKey);
    await saveCompiledPrompt(agentKey, compiled);
    return NextResponse.json({ skipped: false, compiled });
  } catch (err) {
    console.error("[compile] failed:", err);
    return NextResponse.json({ error: "Compile failed" }, { status: 500 });
  }
}

/**
 * GET /api/agents/[agentKey]/compile
 *
 * Returns the current compiled config, or null if not yet compiled.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { agentKey } = await params;
  const compiled = await getCompiledPrompt(agentKey);
  if (!compiled) {
    return NextResponse.json({ compiled: null });
  }
  return NextResponse.json({ compiled });
}
