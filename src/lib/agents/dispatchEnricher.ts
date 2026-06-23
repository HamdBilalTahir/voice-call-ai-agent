import "server-only";
import { getCompiledPrompt } from "@/lib/firebase/agentCompiled";
import { retrieveKBContext } from "@/lib/kb/retrieve";
import {
  buildSystemPrompt,
  PLATFORM_VOICE_RULES,
  LOCALE_LANGUAGE_INSTRUCTION,
} from "./promptBuilder";
import type { AgentFullData } from "@/lib/firebase/agents";

/**
 * Builds the system prompt for the call agent, enriched with KB context.
 *
 * Priority:
 *  1. Uses compiled callAgentPrompt (extracted from 4 sections at save time)
 *  2. Falls back to buildSystemPrompt from raw sections if not yet compiled
 *
 * If kbSearchHint is present in the compiled config, retrieves the top
 * relevant KB chunks from Qdrant and appends them as [KNOWLEDGE BASE].
 *
 * This is called once per call start — Firestore read + optional Qdrant search.
 * Both are non-blocking on failure so the call always proceeds.
 */
export async function enrichSystemPrompt(
  agentKey: string,
  agentData: AgentFullData,
): Promise<string> {
  const liveApiLanguage = agentData.voiceSettings?.liveApiLanguage;

  const compiled = await getCompiledPrompt(agentKey).catch(() => null);

  let basePrompt: string;
  if (compiled?.callAgentPrompt) {
    const languageInstruction = liveApiLanguage
      ? LOCALE_LANGUAGE_INSTRUCTION[liveApiLanguage]
      : undefined;
    basePrompt = [
      languageInstruction ? `[LANGUAGE]: ${languageInstruction}` : "",
      PLATFORM_VOICE_RULES,
      compiled.callAgentPrompt.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
  } else {
    basePrompt = buildSystemPrompt({ ...agentData, liveApiLanguage });
  }

  const kbContext = compiled?.kbSearchHint?.trim()
    ? await retrieveKBContext(agentKey, compiled.kbSearchHint)
    : "";

  return kbContext ? `${basePrompt}\n\n${kbContext}` : basePrompt;
}
