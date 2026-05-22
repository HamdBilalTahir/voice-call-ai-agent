import { NextRequest, NextResponse } from "next/server";
import { agents } from "@/lib/agents/registry";
import { getAgent, updateAgentConfig } from "@/lib/firebase/agents";
import fs from "fs/promises";
import path from "path";

// ─── Filesystem fallback helpers (legacy read-only path) ─────────────────────

const getPromptPath = (agentKey: string, direction: string) =>
  path.join(
    process.cwd(),
    "src",
    "lib",
    "agents",
    direction,
    agentKey,
    "prompt.ts",
  );

function extractSection(content: string, sectionName: string): string {
  const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\[|$)`);
  const match = content.match(regex);
  if (!match) return "";
  return match[1]
    .trim()
    .replace(/[`;\s]+$/, "")
    .trim();
}

async function readFromFilesystem(agentKey: string, direction: string) {
  try {
    const content = await fs.readFile(
      getPromptPath(agentKey, direction),
      "utf-8",
    );
    return {
      roleAndResponsibilities: extractSection(
        content,
        "ROLE AND RESPONSIBILITIES",
      ),
      personaLanguageAndTone: extractSection(
        content,
        "PERSONA LANGUAGE AND TONE",
      ),
      mistakesToAvoid: extractSection(content, "MISTAKES TO AVOID"),
      additionalInstructions: extractSection(
        content,
        "ADDITIONAL INSTRUCTIONS",
      ),
    };
  } catch {
    return null;
  }
}

// ─── GET /api/agents/[agentKey]/prompt ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  try {
    const { agentKey } = await params;
    const config = agents[agentKey];
    if (!config) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Try Firestore first
    const agentData = await getAgent(agentKey);
    if (
      agentData &&
      (agentData.roleAndResponsibilities || agentData.personaLanguageAndTone)
    ) {
      return NextResponse.json({
        roleAndResponsibilities: agentData.roleAndResponsibilities,
        personaLanguageAndTone: agentData.personaLanguageAndTone,
        mistakesToAvoid: agentData.mistakesToAvoid,
        additionalInstructions: agentData.additionalInstructions,
      });
    }

    // Fallback to filesystem for agents not yet in Firestore
    const fsData = await readFromFilesystem(agentKey, config.direction);
    if (fsData) return NextResponse.json(fsData);

    return NextResponse.json({
      roleAndResponsibilities: "",
      personaLanguageAndTone: "",
      mistakesToAvoid: "",
      additionalInstructions: "",
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
    const config = agents[agentKey];
    if (!config) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const {
      roleAndResponsibilities,
      personaLanguageAndTone,
      mistakesToAvoid,
      additionalInstructions,
    } = await request.json();

    const result = await updateAgentConfig(
      agentKey,
      {
        roleAndResponsibilities,
        personaLanguageAndTone,
        mistakesToAvoid,
        additionalInstructions,
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
