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

function buildSTT() {
  switch (process.env.STT_PROVIDER) {
    case "inference":
      return new inference.STT({ model: "deepgram/nova-3", language: "multi" });
    default:
      return new deepgram.STT({
        model: STT_MODEL,
        language: STT_LANGUAGE, // Using "multi" so Deepgram can detect and transcribe multiple languages (like English) properly
        apiKey: process.env.DEEPGRAM_API_KEY,
      });
  }
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const logger = log();

    try {
      console.log(
        "[restaurant-es] Entry called, connecting to room:",
        ctx.room.name,
      );
      logger.info("entry started, connecting to room");
      await ctx.connect();
      console.log("[restaurant-es] Connected, starting session...");
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

      console.log("[restaurant-es] Session started, saying greeting...");
      try {
        await session.say(
          "Buenas tardes, gracias por llamar. ¿En qué le puedo ayudar?",
          { allowInterruptions: true },
        );
        console.log("[restaurant-es] Greeting sent successfully");
      } catch (err) {
        console.error("[restaurant-es] Error calling session.say():", err);
      }
    } catch (err) {
      console.error("[restaurant-es] Unhandled error in entry:", err);
      logger.error({ err }, "fatal error in entry");
    }
  },
});

if (require.main === module) {
  process.loadEnvFile();
  console.log(
    "[restaurant-es] Worker starting, dispatch rule:",
    process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES,
  );
  // Assign a random port so multiple agents can run simultaneously
  cli.runApp(
    new ServerOptions({
      agent: __filename,
      agentName: process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES!,
      port: Math.floor(Math.random() * (9000 - 8082 + 1)) + 8082, // Pick a random port above 8081
    }),
  );
}
