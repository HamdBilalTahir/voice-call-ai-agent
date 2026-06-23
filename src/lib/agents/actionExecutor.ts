import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "@/lib/firebase/admin";
import { getCompiledPrompt } from "@/lib/firebase/agentCompiled";
import { resolveProviderKeys } from "@/lib/firebase/resolveProviderKeys";
import { getAgent } from "@/lib/firebase/agents";
import type { PostCallAction } from "@/lib/agents/promptCompiler";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutedAction {
  trigger: string;
  action: string;
  triggered: boolean;
  reason: string;
  executedAt: number;
}

// ─── LLM evaluation ──────────────────────────────────────────────────────────

const EVAL_SYSTEM_PROMPT = `You are reviewing a completed voice call transcript to determine which post-call actions should be triggered.

For each action, evaluate whether its trigger condition was met based on what happened in the call. Return ONLY valid JSON — no markdown, no explanation.

JSON shape:
[{ "trigger": string, "action": string, "triggered": boolean, "reason": string }]

Rules:
- "triggered": true only if the trigger condition was clearly met in the transcript
- "reason": one short sentence explaining why triggered or not
- Include every action in the input — do not skip any`;

async function evaluateTriggers(
  transcript: string,
  actions: PostCallAction[],
  apiKey: string,
): Promise<ExecutedAction[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const userContent = `ACTIONS TO EVALUATE:\n${JSON.stringify(actions, null, 2)}\n\nCALL TRANSCRIPT:\n${transcript}`;

  const result = await model.generateContent({
    systemInstruction: EVAL_SYSTEM_PROMPT,
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const raw = result.response.text();
  const evaluated = JSON.parse(raw) as Array<{
    trigger: string;
    action: string;
    triggered: boolean;
    reason: string;
  }>;

  const now = Date.now();
  return evaluated.map((e) => ({ ...e, executedAt: now }));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Reads postCallActions from the compiled config, evaluates each trigger
 * against the call transcript using an LLM, and writes results to
 * callHistory/{callHistoryId}/executedActions.
 *
 * Called fire-and-forget from the room_finished webhook handler.
 */
export async function executePostCallActions(
  callHistoryId: string,
  agentKey: string,
  roomName: string,
): Promise<void> {
  const db = getDb();

  // 1. Load compiled config — get postCallActions
  const compiled = await getCompiledPrompt(agentKey);
  if (!compiled?.postCallActions?.length) {
    console.log(`[actions] no postCallActions configured for ${agentKey}`);
    return;
  }

  // 2. Load transcript
  const transcriptSnap = await db
    .collection("callHistory")
    .doc(callHistoryId)
    .collection("transcripts")
    .orderBy("ts", "asc")
    .get();

  if (transcriptSnap.empty) {
    console.log(`[actions] no transcript for ${callHistoryId} — skipping`);
    return;
  }

  const transcript = transcriptSnap.docs
    .map((d) => {
      const { speaker, text } = d.data() as { speaker: string; text: string };
      return `${speaker === "agent" ? "Agent" : "Caller"}: ${text}`;
    })
    .join("\n");

  // 3. Resolve API key (per-agent or env fallback)
  const agentData = await getAgent(agentKey);
  const resolvedKeys = agentData ? await resolveProviderKeys(agentData) : {};
  const apiKey = resolvedKeys.liveApiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[actions] no Gemini API key — skipping action evaluation");
    return;
  }

  // 4. Evaluate triggers
  const results = await evaluateTriggers(
    transcript,
    compiled.postCallActions,
    apiKey,
  );

  const triggered = results.filter((r) => r.triggered);
  const skipped = results.filter((r) => !r.triggered);

  // 5. Write results to Firestore
  const batch = db.batch();
  const actionsRef = db
    .collection("callHistory")
    .doc(callHistoryId)
    .collection("executedActions");

  for (const action of results) {
    batch.set(actionsRef.doc(), {
      ...action,
      callHistoryId,
      agentKey,
      roomName,
    });
  }
  await batch.commit();

  console.log(
    `[actions] ${roomName} — triggered:${triggered.length} skipped:${skipped.length}`,
    triggered.map((a) => a.action),
  );
}
