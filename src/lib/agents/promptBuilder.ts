import type { AgentFullData } from "@/lib/firebase/agents";

export interface DispatchMetadata {
  systemPrompt?: string;
  voiceGreeting?: string;
  llmModel?: string;
  ttsModel?: string;
  ttsVoiceId?: string;
  sttModel?: string;
  sttLanguage?: string;
  [key: string]: unknown;
}

/**
 * Builds the full dispatch metadata payload from a Firestore agent document.
 * All voice settings from `voiceSettings` are included so the agent worker
 * uses what's configured in the database rather than its compiled defaults.
 */
export function buildDispatchMetadata(
  agentData: AgentFullData,
  extra: Record<string, unknown> = {},
): string {
  const meta: DispatchMetadata = {
    ...extra,
    systemPrompt: buildSystemPrompt(agentData),
  };
  if (agentData.voiceGreeting?.trim()) {
    meta.voiceGreeting = agentData.voiceGreeting.trim();
  }
  const vs = agentData.voiceSettings;
  if (vs?.llmModel) meta.llmModel = vs.llmModel;
  if (vs?.ttsModel) meta.ttsModel = vs.ttsModel;
  if (vs?.ttsVoiceId) meta.ttsVoiceId = vs.ttsVoiceId;
  if (vs?.sttModel) meta.sttModel = vs.sttModel;
  if (vs?.sttLanguage) meta.sttLanguage = vs.sttLanguage;
  return JSON.stringify(meta);
}

export const PLATFORM_VOICE_RULES =
  'You are speaking to the user over a voice call. Keep your responses short and conversational. DO NOT use markdown, bullet points, or special characters. Use natural filler phrases like "umm" or "let me think" sparingly. If the user interrupts you, stop talking and listen gracefully.';

export interface PromptFields {
  roleAndResponsibilities?: string;
  personaLanguageAndTone?: string;
  mistakesToAvoid?: string;
  additionalInstructions?: string;
}

/**
 * Assembles the final LLM system prompt from the platform voice rules (constant)
 * and the four user-editable instruction sections. Sections are prepended with
 * bracketed headers and omitted entirely when empty.
 */
export function buildSystemPrompt(fields: PromptFields): string {
  const parts: string[] = [PLATFORM_VOICE_RULES];

  if (fields.roleAndResponsibilities?.trim()) {
    parts.push(
      `[ROLE AND RESPONSIBILITIES]\n${fields.roleAndResponsibilities.trim()}`,
    );
  }
  if (fields.personaLanguageAndTone?.trim()) {
    parts.push(
      `[PERSONA LANGUAGE AND TONE]\n${fields.personaLanguageAndTone.trim()}`,
    );
  }
  if (fields.mistakesToAvoid?.trim()) {
    parts.push(`[MISTAKES TO AVOID]\n${fields.mistakesToAvoid.trim()}`);
  }
  if (fields.additionalInstructions?.trim()) {
    parts.push(
      `[ADDITIONAL INSTRUCTIONS]\n${fields.additionalInstructions.trim()}`,
    );
  }

  return parts.join("\n\n");
}
