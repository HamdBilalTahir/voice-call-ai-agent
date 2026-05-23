// Pricing as of 2025. Update rates here as providers change.

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
  // ── Google Gemini ──────────────────────────────────────────────────────────
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
}

export interface CostBreakdown {
  llm: { inputCost: number; outputCost: number; total: number };
  stt: { total: number };
  tts: { total: number };
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

  const total = inputCost + outputCost + sttCost + ttsCost;
  const durationMin = usage.callDurationMs / 60_000;
  const perMinute = durationMin > 0 ? total / durationMin : 0;

  return {
    llm: { inputCost, outputCost, total: inputCost + outputCost },
    stt: { total: sttCost },
    tts: { total: ttsCost },
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
