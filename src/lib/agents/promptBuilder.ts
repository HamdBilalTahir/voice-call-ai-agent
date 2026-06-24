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
  liveApiLanguage?: string;
  liveApiKey?: string;
  liveApiThinkingLevel?: "minimal" | "low" | "medium" | "high";
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
    // Use pre-enriched systemPrompt (compiled callAgentPrompt + KB context) if
    // provided by the call route; fall back to building from raw sections.
    systemPrompt:
      (extra.systemPrompt as string | undefined) ??
      buildSystemPrompt({
        ...agentData,
        liveApiLanguage: vs?.liveApiLanguage,
      }),
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
    if (vs?.liveApiLanguage) meta.liveApiLanguage = vs.liveApiLanguage;
    if (vs?.liveApiThinkingLevel)
      meta.liveApiThinkingLevel = vs.liveApiThinkingLevel;
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

export const PLATFORM_VOICE_RULES = `You are speaking with someone over a live voice call. Keep responses short and conversational — one or two sentences at a time unless more detail is genuinely needed.

[VOICE AND SPEECH RULES]
- Always use contractions: don't, I'm, you're, can't, we'll, that's.
- Use natural fillers sparingly: "umm", "uh", "let me think", "right", "yeah", "I see", "got it", "sure".
- Open sentences naturally: "So,", "Actually,", "Look,", "Here's the thing —", "Right, so —".
- Self-correct occasionally when it sounds natural: "I mean —", "wait, actually —", "sorry, let me rephrase that".
- Mirror the caller's energy — match their enthusiasm when they're excited, slow down and stay calm when they're concerned or upset.
- Vary your pacing — pause briefly after a question, don't rush through information.
- NEVER use markdown, bullet points, numbered lists, headers, or special characters.
- If the caller interrupts, stop immediately and listen — do not finish your sentence.
- Focus on the conversation — all data collection happens automatically after the call ends.`;

/**
 * Per-locale system-prompt instruction injected at the top of the compiled prompt
 * when liveApiLanguage is set. Each entry is hand-crafted for the specific script,
 * orthography, and common model failure modes of that locale.
 * English variants (en-*) are absent — no override needed.
 */
export const LOCALE_LANGUAGE_INSTRUCTION: Record<string, string> = {
  "ar-XA":
    "You MUST respond ONLY in Arabic for this entire call. Write in Arabic script (right-to-left). Do not transliterate into Latin characters. Do not switch to English even if the caller speaks English to you.",
  "de-DE":
    "You MUST respond ONLY in German for this entire call. Use formal Sie unless the caller explicitly switches to du. Do not switch to English even if the caller speaks English to you.",
  "es-ES":
    "You MUST respond ONLY in Spanish for this entire call. Use Latin American Spanish conventions if the caller's accent suggests it. Do not switch to English even if the caller speaks English to you.",
  "fr-FR":
    "You MUST respond ONLY in French for this entire call. Use formal vous unless the caller explicitly switches to tu. Do not switch to English even if the caller speaks English to you.",
  "hi-IN":
    "You MUST respond ONLY in Hindi for this entire call. Write in Devanagari script. Do not transliterate into Latin characters. Do not switch to English even if the caller speaks English to you.",
  "it-IT":
    "You MUST respond ONLY in Italian for this entire call. Do not switch to English even if the caller speaks English to you.",
  "ja-JP":
    "You MUST respond ONLY in Japanese for this entire call. Write in standard Japanese script (Hiragana, Katakana, and Kanji as appropriate). Use polite keigo (敬語) register. Do not switch to English even if the caller speaks English to you.",
  "ko-KR":
    "You MUST respond ONLY in Korean for this entire call. Write in Hangul script. Use formal jondaemal (존댓말) register. Do not switch to English even if the caller speaks English to you.",
  "pt-BR":
    "You MUST respond ONLY in Brazilian Portuguese for this entire call. Do not switch to English even if the caller speaks English to you.",
  "ru-RU":
    "You MUST respond ONLY in Russian for this entire call. Write in Cyrillic script. Do not transliterate into Latin characters. Do not switch to English even if the caller speaks English to you.",
  "tr-TR":
    "You MUST respond ONLY in Turkish for this entire call. Do not switch to English even if the caller speaks English to you.",
  "ur-PK":
    "You MUST respond ONLY in Urdu for this entire call. Always write using Urdu/Arabic script (نستعلیق — right-to-left). Do NOT use Devanagari (Hindi) script under any circumstances. Do not transliterate into Latin characters. Do not switch to English even if the caller speaks English to you.",
  "zh-CN":
    "You MUST respond ONLY in Mandarin Chinese for this entire call. Write in Simplified Chinese characters (简体字). Do not use Traditional characters or Pinyin romanisation. Do not switch to English even if the caller speaks English to you.",
};

export interface PromptFields {
  roleAndResponsibilities?: string;
  personaLanguageAndTone?: string;
  mistakesToAvoid?: string;
  additionalInstructions?: string;
  liveApiLanguage?: string;
}

/**
 * Assembles the final LLM system prompt from the platform voice rules (constant)
 * and the four user-editable instruction sections. Sections are prepended with
 * bracketed headers and omitted entirely when empty.
 *
 * When liveApiLanguage maps to a non-English locale, a [LANGUAGE] block is
 * prepended so the model responds in the correct language without the user
 * needing to write that instruction themselves.
 */
export function buildSystemPrompt(fields: PromptFields): string {
  const languageInstruction = fields.liveApiLanguage
    ? LOCALE_LANGUAGE_INSTRUCTION[fields.liveApiLanguage]
    : undefined;

  const parts: string[] = [
    languageInstruction ? `[LANGUAGE]: ${languageInstruction}` : "",
    PLATFORM_VOICE_RULES,
  ].filter(Boolean);

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
