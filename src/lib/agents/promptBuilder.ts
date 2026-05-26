import type { AgentFullData } from "@/lib/firebase/agents";

export interface DispatchMetadata {
  agentKey?: string;
  callHistoryId?: string;
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
  // Gemini Live API — replaces the cascading pipeline when useLiveApi is true
  useLiveApi: boolean;
  liveApiModel?: string;
  liveApiVoice?: string;
  liveApiKey?: string;
  // SIP participant identity — tells the session which participant to track
  // (ignores the observer/control participants the SIP bridge adds first)
  sipParticipantIdentity?: string;
  [key: string]: unknown;
}

export interface ResolvedProviderKeys {
  llmApiKey?: string;
  ttsApiKey?: string;
  sttApiKey?: string;
  liveApiKey?: string;
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
  const vs = agentData.voiceSettings;
  const useLiveApi = vs?.useLiveApi === true;

  const meta: DispatchMetadata = {
    ...extra,
    systemPrompt: buildSystemPrompt(agentData),
    useLiveApi,
  };

  // Carry through worker-side keys provided in extra
  if (extra.agentKey) meta.agentKey = extra.agentKey as string;
  if (extra.callHistoryId) meta.callHistoryId = extra.callHistoryId as string;

  if (agentData.voiceGreeting?.trim()) {
    meta.voiceGreeting = agentData.voiceGreeting.trim();
  }

  if (useLiveApi) {
    // Live API handles STT + TTS natively — only pass model/voice/key
    if (vs?.liveApiModel) meta.liveApiModel = vs.liveApiModel;
    if (vs?.liveApiVoice) meta.liveApiVoice = vs.liveApiVoice;
    if (resolvedKeys.liveApiKey) meta.liveApiKey = resolvedKeys.liveApiKey;
  } else {
    // Cascading pipeline: STT → LLM → TTS
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
  }

  return JSON.stringify(meta);
}

export const PLATFORM_VOICE_RULES =
  'You are speaking to the user over a voice call. Keep your responses short and conversational. DO NOT use markdown, bullet points, or special characters. Use natural filler phrases like "umm" or "let me think" sparingly. If the user interrupts you, stop talking and listen gracefully. When you call tools (create_custom_task, update_qualification, schedule_meeting, etc.), do it silently in the background — never narrate, announce, or describe the tool call to the caller. Simply continue the conversation naturally.';

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
