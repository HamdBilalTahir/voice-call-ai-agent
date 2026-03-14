import { NextRequest, NextResponse } from "next/server";
import { agents } from "@/lib/agents/registry";
import fs from "fs/promises";
import path from "path";

const getPromptPath = (agentKey: string, direction: string) => {
  return path.join(
    process.cwd(),
    "src",
    "lib",
    "agents",
    direction,
    agentKey,
    "prompt.ts",
  );
};

function extractSection(content: string, sectionName: string): string {
  const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\[|$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  try {
    const { agentKey } = await params;
    const agent = agents[agentKey];

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const promptPath = getPromptPath(agentKey, agent.direction);
    const content = await fs.readFile(promptPath, "utf-8");

    const roleAndResponsibilities = extractSection(
      content,
      "ROLE AND RESPONSIBILITIES",
    );
    const personaLanguageAndTone = extractSection(
      content,
      "PERSONA LANGUAGE AND TONE",
    );
    const mistakesToAvoid = extractSection(content, "MISTAKES TO AVOID");
    const additionalInstructions = extractSection(
      content,
      "ADDITIONAL INSTRUCTIONS",
    );

    return NextResponse.json({
      roleAndResponsibilities,
      personaLanguageAndTone,
      mistakesToAvoid,
      additionalInstructions,
    });
  } catch (error) {
    console.error("Error reading prompt:", error);
    return NextResponse.json(
      { error: "Failed to read prompt" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  try {
    const { agentKey } = await params;
    const agent = agents[agentKey];

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const {
      roleAndResponsibilities,
      personaLanguageAndTone,
      mistakesToAvoid,
      additionalInstructions,
    } = await request.json();

    const newContent = `export const AGENT_SYSTEM_PROMPT = \`[ROLE AND RESPONSIBILITIES]
${roleAndResponsibilities}

[PERSONA LANGUAGE AND TONE]
${personaLanguageAndTone}

[MISTAKES TO AVOID]
${mistakesToAvoid}

[ADDITIONAL INSTRUCTIONS]
${additionalInstructions}
\`;
`;

    const promptPath = getPromptPath(agentKey, agent.direction);
    await fs.writeFile(promptPath, newContent, "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing prompt:", error);
    return NextResponse.json(
      { error: "Failed to save prompt" },
      { status: 500 },
    );
  }
}
