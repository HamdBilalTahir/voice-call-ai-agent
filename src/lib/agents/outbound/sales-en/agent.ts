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
import * as cartesia from "@livekit/agents-plugin-cartesia";
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

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const logger = log();

    try {
      logger.info("entry started, connecting to room");
      await ctx.connect();
      logger.info("connected to room");

      const session = new voice.AgentSession({
        stt: buildSTT(),
        llm: new google.LLM({
          model: LLM_MODEL,
          apiKey: process.env.GEMINI_API_KEY,
        }),
        tts: new cartesia.TTS({
          apiKey: process.env.CARTESIA_API_KEY,
          model: TTS_MODEL,
          voice: TTS_VOICE_ID,
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
          instructions: AGENT_SYSTEM_PROMPT,
        }),
        room: ctx.room,
      });

      logger.info("session started, sending greeting");
      session.say("Hey, is this Maha?");
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
