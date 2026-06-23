import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface PromptSections {
  roleAndResponsibilities?: string;
  personaLanguageAndTone?: string;
  mistakesToAvoid?: string;
  additionalInstructions?: string;
}

export interface PostCallAction {
  trigger: string;
  action: string;
}

export interface CompiledPromptConfig {
  // Pure conversational instructions for the call agent — no action/KB clutter
  callAgentPrompt: string;
  // Plain-English phrase used to search Qdrant at call start
  kbSearchHint: string;
  // Post-call actions parsed from the prompt
  postCallActions: PostCallAction[];
  // SHA-256 (first 16 chars) of the 4 sections — used to skip unnecessary recompiles
  sourceHash: string;
  compiledAt: number;
}

export function hashPromptSections(sections: PromptSections): string {
  const content = [
    sections.roleAndResponsibilities ?? "",
    sections.personaLanguageAndTone ?? "",
    sections.mistakesToAvoid ?? "",
    sections.additionalInstructions ?? "",
  ].join("\n---\n");
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

const COMPILE_SYSTEM_PROMPT = `You are parsing an AI voice agent configuration written in plain English by a non-technical user. Extract exactly 3 things and return ONLY valid JSON — no markdown, no explanation.

JSON shape:
{
  "callAgentPrompt": "string — conversational instructions only: who the agent is, its persona, tone, what topics to cover, what to avoid during conversation. Exclude any knowledge base hints or post-call action mentions.",
  "kbSearchHint": "string — a plain descriptive phrase of the information the agent needs to retrieve from documents (e.g. 'property listings, floor plans, pricing, availability'). Empty string if nothing mentioned.",
  "postCallActions": [{ "trigger": "string — condition (e.g. 'if caller showed interest')", "action": "string — what to do (e.g. 'add to CRM', 'send follow-up email')" }]
}

Rules:
- callAgentPrompt must be self-contained and ready to prepend to a voice system prompt.
- kbSearchHint should be a noun phrase, not a sentence.
- postCallActions is empty array [] if no post-call actions are mentioned.
- Never invent information not present in the input.`;

function buildCompileInput(sections: PromptSections): string {
  return [
    sections.roleAndResponsibilities?.trim()
      ? `[ROLE AND RESPONSIBILITIES]\n${sections.roleAndResponsibilities.trim()}`
      : "",
    sections.personaLanguageAndTone?.trim()
      ? `[PERSONA LANGUAGE AND TONE]\n${sections.personaLanguageAndTone.trim()}`
      : "",
    sections.mistakesToAvoid?.trim()
      ? `[MISTAKES TO AVOID]\n${sections.mistakesToAvoid.trim()}`
      : "",
    sections.additionalInstructions?.trim()
      ? `[ADDITIONAL INSTRUCTIONS]\n${sections.additionalInstructions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function compilePromptSections(
  sections: PromptSections,
  apiKey: string,
): Promise<CompiledPromptConfig> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent({
    systemInstruction: COMPILE_SYSTEM_PROMPT,
    contents: [
      { role: "user", parts: [{ text: buildCompileInput(sections) }] },
    ],
    generationConfig: { responseMimeType: "application/json" },
  });

  const raw = result.response.text();
  const parsed = JSON.parse(raw) as {
    callAgentPrompt?: string;
    kbSearchHint?: string;
    postCallActions?: PostCallAction[];
  };

  return {
    callAgentPrompt: parsed.callAgentPrompt ?? "",
    kbSearchHint: parsed.kbSearchHint ?? "",
    postCallActions: Array.isArray(parsed.postCallActions)
      ? parsed.postCallActions
      : [],
    sourceHash: hashPromptSections(sections),
    compiledAt: Date.now(),
  };
}
