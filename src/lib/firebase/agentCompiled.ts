import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./admin";
import type { CompiledPromptConfig } from "@/lib/agents/promptCompiler";

function compiledDocRef(agentKey: string) {
  return getDb()
    .collection("agents")
    .doc(agentKey)
    .collection("config")
    .doc("compiled");
}

export async function getCompiledPrompt(
  agentKey: string,
): Promise<CompiledPromptConfig | null> {
  try {
    const snap = await compiledDocRef(agentKey).get();
    if (!snap.exists) return null;
    const data = snap.data() as CompiledPromptConfig & {
      compiledAt: FirebaseFirestore.Timestamp | number;
    };
    return {
      callAgentPrompt: data.callAgentPrompt ?? "",
      kbSearchHint: data.kbSearchHint ?? "",
      postCallActions: data.postCallActions ?? [],
      sourceHash: data.sourceHash ?? "",
      compiledAt:
        typeof (data.compiledAt as FirebaseFirestore.Timestamp)?.toMillis ===
        "function"
          ? (data.compiledAt as FirebaseFirestore.Timestamp).toMillis()
          : (data.compiledAt as number),
    };
  } catch (err) {
    console.error("[agentCompiled] getCompiledPrompt failed:", err);
    return null;
  }
}

export async function saveCompiledPrompt(
  agentKey: string,
  compiled: Omit<CompiledPromptConfig, "compiledAt">,
): Promise<void> {
  await compiledDocRef(agentKey).set({
    ...compiled,
    compiledAt: FieldValue.serverTimestamp(),
  });
}
