// Pricing as of 2026-05. Update rates here as providers change.

export interface ProviderRates {
  llm: {
    inputPerMToken: number; // $ per 1M input tokens
    outputPerMToken: number; // $ per 1M output tokens
  };
  stt: {
    perMinute: number; // $ per minute of audio
  };
  tts: {
    perKChar: number; // $ per 1,000 characters
  };
}

export const PROVIDER_RATES: Record<string, ProviderRates> = {
  // ── Gemini Live API ────────────────────────────────────────────────────────
  // Token-only billing — no per-minute or connection fees from Gemini.
  // Audio is billed at 25 tokens/second. The SDK reports combined audio+text
  // token counts; audio dominates in a voice call and is priced ~6x higher
  // than text. STT and TTS are absorbed — no separate cost for those.
  // Source: https://ai.google.dev/gemini-api/docs/pricing (verified 2026-05)
  //
  // IMPORTANT: these keys must stay above "gemini-2.0-flash" — lookupRates()
  // uses substring matching and "gemini-2.0-flash-exp" contains "gemini-2.0-flash".
  //
  // gemini-live-2.5-flash-native-audio — audio in $3.00/1M, audio out $12.00/1M
  "gemini-live-2.5-flash-native-audio": {
    llm: { inputPerMToken: 3.0, outputPerMToken: 12.0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },
  // gemini-3.1-flash-live-preview — same audio pricing tier as 2.5 Flash Live
  "gemini-3.1-flash-live-preview": {
    llm: { inputPerMToken: 3.0, outputPerMToken: 12.0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },
  // gemini-2.0-flash-exp — deprecated Feb 2026, shutting down Jun 2026
  // Audio input $0.70/1M, audio output $0.40/1M (same as text output)
  "gemini-2.0-flash-exp": {
    llm: { inputPerMToken: 0.7, outputPerMToken: 0.4 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },

  // ── Google Gemini (cascading LLM — text tokens only) ──────────────────────
  "gemini-2.5-flash": {
    llm: { inputPerMToken: 0.15, outputPerMToken: 0.6 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },
  "gemini-2.0-flash": {
    llm: { inputPerMToken: 0.1, outputPerMToken: 0.4 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },
  "gemini-3-flash-preview": {
    llm: { inputPerMToken: 0.1, outputPerMToken: 0.4 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },

  // ── Anthropic Claude ───────────────────────────────────────────────────────
  // claude-haiku-4-5
  "claude-haiku-4-5": {
    llm: { inputPerMToken: 0.8, outputPerMToken: 4.0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },
  // claude-sonnet-4-6
  "claude-sonnet-4-6": {
    llm: { inputPerMToken: 3.0, outputPerMToken: 15.0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },

  // ── xAI Grok ──────────────────────────────────────────────────────────────
  // grok-3-mini — cheapest Grok model ($0.30/$0.50 per 1M tokens)
  "grok-3-mini": {
    llm: { inputPerMToken: 0.3, outputPerMToken: 0.5 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0 },
  },

  // ── Deepgram ───────────────────────────────────────────────────────────────
  // Nova-3 streaming STT
  "deepgram-nova-3": {
    llm: { inputPerMToken: 0, outputPerMToken: 0 },
    stt: { perMinute: 0.0059 },
    tts: { perKChar: 0 },
  },

  // ── ElevenLabs ─────────────────────────────────────────────────────────────
  // ElevenLabs — Starter plan: $5/mo / 30k chars = $0.167/1k chars
  // SDK sends model name as-is (e.g. "eleven_turbo_v2_5"), so match both forms
  eleven_turbo_v2_5: {
    llm: { inputPerMToken: 0, outputPerMToken: 0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0.167 },
  },
  eleven_multilingual_v2: {
    llm: { inputPerMToken: 0, outputPerMToken: 0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0.167 },
  },
  "elevenlabs-turbo-v2.5": {
    llm: { inputPerMToken: 0, outputPerMToken: 0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0.167 },
  },

  // ── Cartesia Sonic ─────────────────────────────────────────────────────────
  "sonic-3": {
    llm: { inputPerMToken: 0, outputPerMToken: 0 },
    stt: { perMinute: 0 },
    tts: { perKChar: 0.065 },
  },
};

// Rates for the post-call extraction model (text generateContent, not Live API).
// gemini-2.5-flash: $0.15/1M input, $0.60/1M output (standard tier, verified 2026-06)
const EXTRACTION_TEXT_RATES: Record<
  string,
  { inputPerMToken: number; outputPerMToken: number }
> = {
  "gemini-2.5-flash": { inputPerMToken: 0.15, outputPerMToken: 0.6 },
};

function lookupExtractionRates(model: string) {
  const key = Object.keys(EXTRACTION_TEXT_RATES).find((k) =>
    model.toLowerCase().includes(k.toLowerCase()),
  );
  return key
    ? EXTRACTION_TEXT_RATES[key]
    : { inputPerMToken: 0, outputPerMToken: 0 };
}

export interface UsageData {
  // LLM
  llmProvider: string;
  llmModel: string;
  inputTokens: number;
  outputTokens: number;
  // STT
  sttProvider: string;
  sttModel: string;
  sttAudioMs: number;
  // TTS
  ttsProvider: string;
  ttsModel: string;
  ttsCharacters: number;
  ttsAudioMs: number;
  // Call
  callDurationMs: number;
  // Post-call extraction (optional)
  extractionModel?: string;
  extractionInputTokens?: number;
  extractionOutputTokens?: number;
}

export interface CostBreakdown {
  llm: { inputCost: number; outputCost: number; total: number };
  stt: { total: number };
  tts: { total: number };
  extraction: { inputCost: number; outputCost: number; total: number };
  total: number;
  perMinute: number;
}

function lookupRates(model: string): ProviderRates {
  const key = Object.keys(PROVIDER_RATES).find((k) =>
    model.toLowerCase().includes(k.toLowerCase()),
  );
  return key
    ? PROVIDER_RATES[key]
    : {
        llm: { inputPerMToken: 0, outputPerMToken: 0 },
        stt: { perMinute: 0 },
        tts: { perKChar: 0 },
      };
}

export function calculateCost(usage: UsageData): CostBreakdown {
  const llmRates = lookupRates(usage.llmModel);
  const sttRates = lookupRates(usage.sttModel);
  const ttsRates = lookupRates(usage.ttsModel);

  const inputCost =
    (usage.inputTokens / 1_000_000) * llmRates.llm.inputPerMToken;
  const outputCost =
    (usage.outputTokens / 1_000_000) * llmRates.llm.outputPerMToken;
  const sttCost = (usage.sttAudioMs / 60_000) * sttRates.stt.perMinute;
  const ttsCost = (usage.ttsCharacters / 1_000) * ttsRates.tts.perKChar;

  const extractionRates = usage.extractionModel
    ? lookupExtractionRates(usage.extractionModel)
    : { inputPerMToken: 0, outputPerMToken: 0 };
  const extractionInputCost =
    ((usage.extractionInputTokens ?? 0) / 1_000_000) *
    extractionRates.inputPerMToken;
  const extractionOutputCost =
    ((usage.extractionOutputTokens ?? 0) / 1_000_000) *
    extractionRates.outputPerMToken;

  const total =
    inputCost +
    outputCost +
    sttCost +
    ttsCost +
    extractionInputCost +
    extractionOutputCost;
  const durationMin = usage.callDurationMs / 60_000;
  const perMinute = durationMin > 0 ? total / durationMin : 0;

  return {
    llm: { inputCost, outputCost, total: inputCost + outputCost },
    stt: { total: sttCost },
    tts: { total: ttsCost },
    extraction: {
      inputCost: extractionInputCost,
      outputCost: extractionOutputCost,
      total: extractionInputCost + extractionOutputCost,
    },
    total,
    perMinute,
  };
}

export function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(4)}`;
}
