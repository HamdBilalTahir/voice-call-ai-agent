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
  greeting: "Hey, is this Maha?",
  llmModel: LLM_MODEL,
  ttsModel: TTS_MODEL,
  ttsVoiceId: TTS_VOICE_ID,
  sttModel: STT_MODEL,
  sttLanguage: STT_LANGUAGE,
  workerName: "sales-en",
});

if (require.main === module) {
  process.loadEnvFile();
  const port = process.env.PORT ? parseInt(process.env.PORT) : 0;
  cli.runApp(
    new ServerOptions({
      agent: __filename,
      agentName: process.env.AGENT_DISPATCH_RULE_SALES_EN || "voice-agent",
      port,
    }),
  );
}
