import "server-only";
import { type AgentFullData } from "./agents";
import { getProviderConfig } from "./providerConfigs";
import { type ResolvedProviderKeys } from "@/lib/agents/promptBuilder";

/**
 * Given a fully-merged agent document, fetches the API keys referenced by
 * its voiceSettings configIds from the userId's providerConfigs subcollection.
 * Returns empty strings for any configs that aren't found.
 */
export async function resolveProviderKeys(
  agentData: AgentFullData,
): Promise<ResolvedProviderKeys> {
  const uid = agentData.userId;
  if (!uid) return {};

  const vs = agentData.voiceSettings;
  const result: ResolvedProviderKeys = {};

  await Promise.all([
    vs?.llmConfigId
      ? getProviderConfig(uid, vs.llmConfigId).then((c) => {
          if (c) result.llmApiKey = c.apiKey;
        })
      : Promise.resolve(),
    vs?.ttsConfigId
      ? getProviderConfig(uid, vs.ttsConfigId).then((c) => {
          if (c) result.ttsApiKey = c.apiKey;
        })
      : Promise.resolve(),
    vs?.sttConfigId
      ? getProviderConfig(uid, vs.sttConfigId).then((c) => {
          if (c) result.sttApiKey = c.apiKey;
        })
      : Promise.resolve(),
  ]);

  return result;
}
