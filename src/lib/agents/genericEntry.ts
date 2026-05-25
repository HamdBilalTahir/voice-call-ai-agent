/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import {
  type JobContext,
  voice,
  defineAgent,
  log,
  inference,
} from "@livekit/agents";
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

interface DispatchMeta {
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

export function makeAgentEntry(defaults: AgentDefaults) {
  return defineAgent({
    entry: async (ctx: JobContext) => {
      const logger = log();
      try {
        logger.info(
          `[${defaults.workerName}] entry started, connecting to room`,
        );
        await ctx.connect();
        logger.info(`[${defaults.workerName}] connected to room`);

        // All config comes from dispatch metadata; fall back to compiled defaults.
        let instructions = defaults.systemPrompt;
        let greeting = defaults.greeting;
        let llmModel = defaults.llmModel;
        let llmProvider = "google";
        let llmApiKey: string | undefined;
        let ttsModel = defaults.ttsModel;
        let ttsProvider = "elevenlabs";
        let ttsApiKey: string | undefined;
        let ttsVoiceId = defaults.ttsVoiceId;
        let sttModel = defaults.sttModel;
        let sttApiKey: string | undefined;
        let sttLanguage = defaults.sttLanguage;

        try {
          const meta = JSON.parse(ctx.job.metadata || "{}") as DispatchMeta;
          if (meta.systemPrompt) instructions = meta.systemPrompt;
          if (meta.voiceGreeting) greeting = meta.voiceGreeting;
          if (meta.llmModel) llmModel = meta.llmModel;
          if (meta.llmProvider) llmProvider = meta.llmProvider;
          if (meta.llmApiKey) llmApiKey = meta.llmApiKey;
          if (meta.ttsModel) ttsModel = meta.ttsModel;
          if (meta.ttsProvider) ttsProvider = meta.ttsProvider;
          if (meta.ttsApiKey) ttsApiKey = meta.ttsApiKey;
          if (meta.ttsVoiceId) ttsVoiceId = meta.ttsVoiceId;
          if (meta.sttModel) sttModel = meta.sttModel;
          if (meta.sttApiKey) sttApiKey = meta.sttApiKey;
          if (meta.sttLanguage) sttLanguage = meta.sttLanguage;
        } catch {
          // malformed metadata — use static defaults
        }

        const llm =
          llmProvider === "openai"
            ? new openai.LLM({
                model: llmModel,
                apiKey: llmApiKey ?? process.env.OPENAI_API_KEY,
              })
            : new google.LLM({
                model: llmModel,
                apiKey: llmApiKey ?? process.env.GEMINI_API_KEY,
              });

        const tts =
          ttsProvider === "cartesia"
            ? new cartesia.TTS({
                model: ttsModel,
                voice: ttsVoiceId || undefined,
                apiKey: ttsApiKey ?? process.env.CARTESIA_API_KEY,
              })
            : new elevenlabs.TTS({
                apiKey: ttsApiKey ?? process.env.ELEVENLABS_API_KEY,
                model: ttsModel,
                voiceId: ttsVoiceId,
              });

        const session = new voice.AgentSession({
          stt: buildSTT(sttModel, sttLanguage, sttApiKey),
          llm,
          tts,
        });

        const s = session as any;
        s.on("user_input_transcribed", (ev: any) => {
          logger.info(
            { transcript: ev.transcript, isFinal: ev.isFinal },
            "[STT] transcript",
          );
        });
        s.on("agent_state_changed", (ev: any) => {
          logger.info(
            { from: ev.oldState, to: ev.newState },
            "[Agent] state changed",
          );
        });
        s.on("error", (ev: any) => {
          logger.error({ err: ev.error }, "[Error] session error");
        });

        logger.info(`[${defaults.workerName}] starting session`);
        const callStartMs = Date.now();

        await session.start({
          agent: new voice.Agent({ instructions }),
          room: ctx.room,
        });

        logger.info(
          `[${defaults.workerName}] session started, sending greeting`,
        );
        try {
          await session.say(greeting, { allowInterruptions: true });
        } catch (err) {
          logger.warn({ err }, `[${defaults.workerName}] greeting failed`);
        }

        const roomName = ctx.room.name;
        const s2 = session as any;
        s2.once("close", async () => {
          try {
            const callDurationMs = Date.now() - callStartMs;
            const rawUsage = (session as any).usage?.modelUsage ?? [];
            const llm = rawUsage.find((u: any) => u.type === "llm_usage") ?? {};
            const tts = rawUsage.find((u: any) => u.type === "tts_usage") ?? {};
            const stt = rawUsage.find((u: any) => u.type === "stt_usage") ?? {};

            const payload = JSON.stringify({
              type: "call_usage",
              llmModel,
              inputTokens: llm.inputTokens ?? 0,
              outputTokens: llm.outputTokens ?? 0,
              sttModel: `deepgram-${sttModel}`,
              sttAudioMs: stt.audioDurationMs ?? callDurationMs,
              ttsModel,
              ttsCharacters: tts.charactersCount ?? 0,
              ttsAudioMs: tts.audioDurationMs ?? 0,
              callDurationMs,
            });

            const usageDir = path.join(process.cwd(), ".agent-usage");
            fs.mkdirSync(usageDir, { recursive: true });
            fs.writeFileSync(path.join(usageDir, `${roomName}.json`), payload);
            logger.info({ roomName }, "usage written to file");
          } catch (err) {
            logger.warn({ err }, "failed to write usage data");
          }
        });
      } catch (err) {
        logger.error({ err }, `[${defaults.workerName}] fatal error in entry`);
      }
    },
  });
}
