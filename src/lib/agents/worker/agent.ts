import { cli, ServerOptions } from "@livekit/agents";
import { makeAgentEntry } from "@/lib/agents/genericEntry";

const dispatchRule = process.env.AGENT_DISPATCH_RULE || "voice-agent";

export default makeAgentEntry({
  systemPrompt: "",
  greeting: "",
  llmModel: process.env.DEFAULT_LLM_MODEL || "gemini-2.0-flash",
  ttsModel: process.env.DEFAULT_TTS_MODEL || "eleven_turbo_v2_5",
  ttsVoiceId: process.env.DEFAULT_TTS_VOICE_ID || "",
  sttModel: process.env.DEFAULT_STT_MODEL || "nova-3",
  sttLanguage: process.env.DEFAULT_STT_LANGUAGE || "en",
  workerName: dispatchRule,
});

if (require.main === module) {
  process.loadEnvFile();
  // Random port per worker so multiple agents can run without port collisions.
  const port = Math.floor(Math.random() * (9000 - 8200 + 1)) + 8200;
  cli.runApp(
    new ServerOptions({
      agent: __filename,
      agentName: dispatchRule,
      port,
    }),
  );
}
