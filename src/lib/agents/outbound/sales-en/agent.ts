/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type JobContext,
  voice,
  cli,
  ServerOptions,
  defineAgent,
  log,
  inference,
} from "@livekit/agents";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as google from "@livekit/agents-plugin-google";

import { AGENT_SYSTEM_PROMPT } from "./prompt";
import {
  STT_MODEL,
  STT_LANGUAGE,
  LLM_MODEL,
  TTS_MODEL,
  TTS_VOICE_ID,
} from "./config";

// Switch STT provider via STT_PROVIDER env var: "inference" | "deepgram" (default: "deepgram")
function buildSTT() {
  switch (process.env.STT_PROVIDER) {
    case "inference":
      return new inference.STT({ model: "deepgram/nova-3", language: "en" });
    default:
      return new deepgram.STT({
        model: STT_MODEL,
        language: STT_LANGUAGE,
        apiKey: process.env.DEEPGRAM_API_KEY,
      });
  }
}

const DEFAULT_GREETING = "Hey, is this Maha?";

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const logger = log();

    try {
      logger.info("entry started, connecting to room");
      await ctx.connect();
      logger.info("connected to room");

      // Use dynamic instructions from dispatch metadata when available;
      // fall back to the static prompt for backward compatibility.
      let instructions = AGENT_SYSTEM_PROMPT;
      let greeting = DEFAULT_GREETING;
      try {
        const meta = JSON.parse(ctx.job.metadata || "{}") as {
          systemPrompt?: string;
          voiceGreeting?: string;
        };
        if (meta.systemPrompt) instructions = meta.systemPrompt;
        if (meta.voiceGreeting) greeting = meta.voiceGreeting;
      } catch {
        // malformed metadata — continue with static defaults
      }

      const session = new voice.AgentSession({
        stt: buildSTT(),
        llm: new google.LLM({
          model: LLM_MODEL,
          apiKey: process.env.GEMINI_API_KEY,
        }),
        tts: new elevenlabs.TTS({
          apiKey: process.env.ELEVENLABS_API_KEY,
          model: TTS_MODEL,
          voiceId: TTS_VOICE_ID,
        }),
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

      logger.info("starting session");
      await session.start({
        agent: new voice.Agent({
          instructions,
        }),
        room: ctx.room,
      });

      logger.info("session started, sending greeting");
      session.say(greeting);
    } catch (err) {
      logger.error({ err }, "fatal error in entry");
    }
  },
});

if (require.main === module) {
  process.loadEnvFile();
  // Assign a random port so multiple agents can run simultaneously
  const port = process.env.PORT ? parseInt(process.env.PORT) : 0;
  cli.runApp(
    new ServerOptions({
      agent: __filename,
      agentName: process.env.AGENT_DISPATCH_RULE_SALES_EN || "voice-agent",
      port,
    }),
  );
}
