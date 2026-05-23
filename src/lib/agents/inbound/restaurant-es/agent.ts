import { cli, ServerOptions } from "@livekit/agents";
import { makeAgentEntry } from "@/lib/agents/genericEntry";
import { AGENT_SYSTEM_PROMPT } from "./prompt";
import {
  STT_MODEL,
  STT_LANGUAGE,
  LLM_MODEL,
  TTS_MODEL,
  TTS_VOICE_ID,
} from "./config";

export default makeAgentEntry({
  systemPrompt: AGENT_SYSTEM_PROMPT,
  greeting: "Buenas tardes, gracias por llamar. ¿En qué le puedo ayudar?",
  llmModel: LLM_MODEL,
  ttsModel: TTS_MODEL,
  ttsVoiceId: TTS_VOICE_ID,
  sttModel: STT_MODEL,
  sttLanguage: STT_LANGUAGE,
  workerName: "restaurant-es",
});

if (require.main === module) {
  process.loadEnvFile();
  console.log(
    "[restaurant-es] Worker starting, dispatch rule:",
    process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES,
  );
  cli.runApp(
    new ServerOptions({
      agent: __filename,
      agentName: process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES!,
      port: Math.floor(Math.random() * (9000 - 8082 + 1)) + 8082,
    }),
  );
}
