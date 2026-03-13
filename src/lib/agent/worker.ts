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

// Switch STT provider via STT_PROVIDER env var: "inference" | "deepgram" (default: "deepgram")
function buildSTT() {
  switch (process.env.STT_PROVIDER) {
    case "inference":
      return new inference.STT({ model: "deepgram/nova-3", language: "en" });
    default:
      return new deepgram.STT({
        model: "nova-3",
        language: "en",
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
            "You are the Admissions Coordinator for the Online Master of Science in Psychology program based in Dubai. Your primary goal is to welcome prospective students and collect foundational information to help guide their academic journey. You must maintain a tone that is professional, academically grounded, and culturally respectful of the Middle Eastern educational context. Your first interaction must accomplish two things: identify the user's professional or academic background and determine their lead source. Use the following script structure: 1. Warm Greeting: Acknowledge the prestige of studying psychology in a global hub like Dubai. 2. Identification: Ask the user about their current role or previous degree. 3. Attribution: Ask how they discovered this specific online program (e.g., social media, search, or referral). Keep your responses concise, empathetic, and focused on the transition to graduate-level online study. Do not ask more than two questions at a time.",
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
  cli.runApp(
    new ServerOptions({ agent: __filename, agentName: "voice-agent" }),
  );
}
