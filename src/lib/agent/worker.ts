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

import * as google from "@livekit/agents-plugin-google";

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const logger = log();

    try {
      logger.info("entry started, connecting to room");
      await ctx.connect();
      logger.info("connected to room");

      const session = new voice.AgentSession({
        stt: new inference.STT({ model: "deepgram/nova-3", language: "en" }),
        llm: new google.LLM({
          model: "gemini-3-flash-preview",
          apiKey: process.env.GEMINI_API_KEY,
        }),
        tts: new cartesia.TTS({
          apiKey: process.env.CARTESIA_API_KEY,
          model: "sonic-3",
          voice: "7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8",
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
          instructions:
            "You are a brief, friendly assistant that gives short responses.",
        }),
        room: ctx.room,
      });

      logger.info("session started, sending greeting");
      session.say("Hey, how can I help you today?");
    } catch (err) {
      logger.error({ err }, "fatal error in entry");
    }
  },
});

if (require.main === module) {
  process.loadEnvFile();
  cli.runApp(new ServerOptions({ agent: __filename }));
}
