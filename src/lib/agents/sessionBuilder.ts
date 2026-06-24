/* eslint-disable @typescript-eslint/no-explicit-any */
import { voice, inference } from "@livekit/agents";
import { ThinkingLevel } from "@google/genai";
import * as silero from "@livekit/agents-plugin-silero";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as google from "@livekit/agents-plugin-google";
import * as openai from "@livekit/agents-plugin-openai";
import * as cartesia from "@livekit/agents-plugin-cartesia";

export interface AgentDefaults {
  systemPrompt: string;
  greeting: string;
  llmModel: string;
  ttsModel: string;
  ttsVoiceId: string;
  sttModel: string;
  sttLanguage: string;
  workerName: string;
}

/** Full dispatch metadata shape as the worker reads it from ctx.job.metadata */
export interface WorkerDispatchMeta {
  agentKey?: string;
  callHistoryId?: string;
  systemPrompt?: string;
  voiceGreeting?: string;
  // Cascading pipeline
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
  // Gemini Live API
  useLiveApi?: boolean;
  liveApiModel?: string;
  liveApiVoice?: string;
  liveApiKey?: string;
  liveApiLanguage?: string;
  liveApiThinkingLevel?: "minimal" | "low" | "medium" | "high";
  // SIP call participant identity — routes the session to the right participant
  sipParticipantIdentity?: string;
}

/**
 * Loads (and caches) a Silero VAD tuned for telephony turn detection.
 *
 * Why: Gemini's server-side VAD cannot honor a short silence window on a noisy
 * PSTN line — line/comfort noise reads as continuous speech, so end-of-turn is
 * delayed 4–7s (generation itself fires in ~3ms). We disable the server VAD and
 * let Silero detect turn boundaries locally; it rejects noise far better and its
 * `minSilenceDuration` directly controls how fast a turn ends after the caller
 * stops talking. Env-tunable via LIVE_VAD_SILENCE_MS (default 400ms → sub-second
 * turns); lower = snappier but risks clipping mid-sentence pauses.
 */
let _sileroVad: silero.VAD | undefined;
async function getTelephonyVad(): Promise<silero.VAD> {
  if (_sileroVad) return _sileroVad;
  const silenceMs = Number(process.env.LIVE_VAD_SILENCE_MS ?? 400);
  _sileroVad = await silero.VAD.load({
    minSilenceDuration: (Number.isFinite(silenceMs) ? silenceMs : 400) / 1000,
    minSpeechDuration: 0.05, // catch short replies like "no"/"yeah"
    activationThreshold: 0.5, // reject low-level line noise
  });
  return _sileroVad;
}

/**
 * Builds the Live API thinking configuration, model-aware.
 *
 * Gemini 3.1 live models use `thinkingLevel` (MINIMAL/LOW/MEDIUM/HIGH);
 * Gemini 2.5 live models use `thinkingBudget` (0 = disabled, -1 = automatic).
 * When the agent has not set a level, we default to the latency-optimal floor
 * (MINIMAL / disabled) so turns are not stalled by an unnecessary thinking pass.
 */
function buildThinkingConfig(
  model: string,
  level?: "minimal" | "low" | "medium" | "high",
): { thinkingLevel: ThinkingLevel } | { thinkingBudget: number } | undefined {
  if (model.includes("3.1")) {
    const map = {
      minimal: ThinkingLevel.MINIMAL,
      low: ThinkingLevel.LOW,
      medium: ThinkingLevel.MEDIUM,
      high: ThinkingLevel.HIGH,
    } as const;
    return { thinkingLevel: level ? map[level] : ThinkingLevel.MINIMAL };
  }
  if (model.includes("2.5")) {
    // 2.5 native-audio: disable thinking unless the agent explicitly wants more.
    return { thinkingBudget: level && level !== "minimal" ? -1 : 0 };
  }
  // Older models (e.g. gemini-2.0-flash-exp) predate thinking — leave unset to
  // preserve their default behavior and avoid sending an unsupported param.
  return undefined;
}

function buildSTT(model: string, language: string, apiKey?: string) {
  switch (process.env.STT_PROVIDER) {
    case "inference":
      return new inference.STT({ model: "deepgram/nova-3", language });
    default:
      return new deepgram.STT({
        model: model as any,
        language,
        apiKey: apiKey ?? process.env.DEEPGRAM_API_KEY,
      });
  }
}

/**
 * Appends Live API–specific instruction addenda to the base system prompt.
 *
 * Two things the base prompt cannot guarantee on its own:
 *  1. The model speaking first — the Live API waits for caller input unless
 *     explicitly told to initiate with the greeting.
 *  2. Not speaking function call syntax — if the prompt references tools like
 *     create_custom_task() and no functions are registered with the session,
 *     the model outputs the raw call as speech.
 *
 * Note: language response enforcement is handled upstream in buildSystemPrompt
 * so it appears in the compiled-prompt preview and applies to all pipelines.
 */
export function buildLiveApiInstructions(
  baseInstructions: string,
  greeting: string,
): string {
  return [
    baseInstructions,
    `[VOICE SESSION START]: The call has just connected. You MUST speak immediately — do NOT wait for the caller to speak first. Your very first spoken words must be exactly: "${greeting}". Say it right now.`,
    `[SILENCE HANDLING]: If the caller has not spoken for 45 or more seconds, say "Are you still there?" exactly once in a natural tone. If they do not respond within 30 more seconds, say a brief farewell and call end_call("completed").`,
    `[CALL END RULES]: When the caller explicitly says goodbye, bye, or a clear farewell — speak a brief farewell (one sentence), then call end_call("completed"). For spam, repeated abuse, or job applications, call end_call("spam") immediately.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Constructs a voice.AgentSession from dispatch metadata and compiled defaults.
 * When meta.useLiveApi is true, builds a Google Realtime session (no STT/TTS).
 * When false, builds the existing cascading STT → LLM → TTS session.
 */
export async function buildSession(
  meta: WorkerDispatchMeta,
  defaults: AgentDefaults,
): Promise<voice.AgentSession> {
  if (meta.useLiveApi === true) {
    const baseInstructions = meta.systemPrompt ?? defaults.systemPrompt;
    const greeting = meta.voiceGreeting ?? defaults.greeting;
    const liveApiModel =
      meta.liveApiModel ?? "gemini-live-2.5-flash-native-audio";
    const thinkingConfig = buildThinkingConfig(
      liveApiModel,
      meta.liveApiThinkingLevel,
    );
    const vad = await getTelephonyVad();
    // Diagnostic: confirms this (new) code path runs in the worker. Remove once
    // latency is locked in.
    console.log(
      "[SessionBuilder] live config",
      JSON.stringify({
        model: liveApiModel,
        thinkingConfig,
        turnDetection: "vad (silero, server VAD disabled)",
      }),
    );
    const realtimeModel = new google.beta.realtime.RealtimeModel({
      model: liveApiModel,
      voice: meta.liveApiVoice ?? "Puck",
      apiKey: meta.liveApiKey ?? process.env.GEMINI_API_KEY,
      instructions: buildLiveApiInstructions(baseInstructions, greeting),
      ...(meta.liveApiLanguage ? { language: meta.liveApiLanguage } : {}),
      // Enables user-audio transcription locked to the session language so the
      // caller transcript uses the correct script (e.g. Urdu not Devanagari).
      inputAudioTranscription: {},
      // Cap reasoning depth per turn. Without this, gemini-3.1-* live runs its
      // default (non-minimal) thinking pass before every turn. Minimal is the
      // latency-optimal floor.
      thinkingConfig,
      // Disable Gemini's server VAD — it can't honor a short silence window on a
      // noisy PSTN line. Silero VAD (below) drives turn detection instead.
      realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
    });
    // With server turn detection off + a VAD provided, the framework auto-selects
    // VAD turn detection and drives Gemini's manual activity signals from Silero.
    return new voice.AgentSession({
      llm: realtimeModel,
      vad,
      turnDetection: "vad",
    });
  }

  // Cascading pipeline
  const llmModel = meta.llmModel ?? defaults.llmModel;
  const llmProvider = meta.llmProvider ?? "google";
  const ttsModel = meta.ttsModel ?? defaults.ttsModel;
  const ttsProvider = meta.ttsProvider ?? "elevenlabs";
  const ttsVoiceId = meta.ttsVoiceId ?? defaults.ttsVoiceId;
  const sttModel = meta.sttModel ?? defaults.sttModel;
  const sttLanguage = meta.sttLanguage ?? defaults.sttLanguage;

  const llm =
    llmProvider === "openai"
      ? new openai.LLM({
          model: llmModel,
          apiKey: meta.llmApiKey ?? process.env.OPENAI_API_KEY,
        })
      : new google.LLM({
          model: llmModel,
          apiKey: meta.llmApiKey ?? process.env.GEMINI_API_KEY,
        });

  const tts =
    ttsProvider === "cartesia"
      ? new cartesia.TTS({
          model: ttsModel,
          voice: ttsVoiceId || undefined,
          apiKey: meta.ttsApiKey ?? process.env.CARTESIA_API_KEY,
        })
      : new elevenlabs.TTS({
          apiKey: meta.ttsApiKey ?? process.env.ELEVENLABS_API_KEY,
          model: ttsModel,
          voiceId: ttsVoiceId,
        });

  return new voice.AgentSession({
    stt: buildSTT(sttModel, sttLanguage, meta.sttApiKey),
    llm,
    tts,
  });
}
