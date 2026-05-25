import type { AgentFullData } from "@/lib/firebase/agents";

export interface DispatchMetadata {
  systemPrompt?: string;
  voiceGreeting?: string;
  llmModel?: string;
  llmProvider?: string;
  llmApiKey?: string;
  ttsModel?: string;
  ttsProvider?: string;
  ttsApiKey?: string;
  ttsVoiceId?: string;
  sttModel?: string;
  sttProvider?: string;
  sttApiKey?: string;
  sttLanguage?: string;
  [key: string]: unknown;
}

export interface ResolvedProviderKeys {
  llmApiKey?: string;
  ttsApiKey?: string;
  sttApiKey?: string;
}

/**
 * Builds the full dispatch metadata payload from a Firestore agent document.
 * Pass resolvedKeys (fetched server-side from providerConfigs) to inject API
 * keys so the worker uses per-agent credentials instead of global env vars.
 */
export function buildDispatchMetadata(
  agentData: AgentFullData,
  extra: Record<string, unknown> = {},
  resolvedKeys: ResolvedProviderKeys = {},
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
  if (vs?.llmProvider) meta.llmProvider = vs.llmProvider;
  if (resolvedKeys.llmApiKey) meta.llmApiKey = resolvedKeys.llmApiKey;
  if (vs?.ttsModel) meta.ttsModel = vs.ttsModel;
  if (vs?.ttsProvider) meta.ttsProvider = vs.ttsProvider;
  if (resolvedKeys.ttsApiKey) meta.ttsApiKey = resolvedKeys.ttsApiKey;
  if (vs?.ttsVoiceId) meta.ttsVoiceId = vs.ttsVoiceId;
  if (vs?.sttModel) meta.sttModel = vs.sttModel;
  if (vs?.sttProvider) meta.sttProvider = vs.sttProvider;
  if (resolvedKeys.sttApiKey) meta.sttApiKey = resolvedKeys.sttApiKey;
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
