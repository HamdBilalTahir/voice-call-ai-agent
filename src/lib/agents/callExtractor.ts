import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "@/lib/firebase/admin";
import { getAgent } from "@/lib/firebase/agents";
import { buildSystemPrompt } from "@/lib/agents/promptBuilder";
import { resolveProviderKeys } from "@/lib/firebase/resolveProviderKeys";
import { updateCallRecord } from "@/lib/history";

interface ExtractedQualification {
  contact_name?: string;
  email?: string;
  phone?: string;
  geography_interest?: string;
  budget?: string;
  timeline?: string;
  decision_authority?: string;
  qualification_status?:
    | "qualified"
    | "soft_rejected"
    | "hard_rejected"
    | "pending";
  lead_score?: number;
  notes?: string;
}

interface ExtractedTask {
  title: string;
  description?: string;
  scheduled_at?: string;
}

interface ExtractedMeeting {
  participant_name?: string;
  participant_email?: string;
  datetime_gst?: string;
  geography?: string;
  notes?: string;
}

interface ExtractedMessage {
  content: string;
  channel: "sms" | "whatsapp";
}

interface ExtractionResult {
  qualification?: ExtractedQualification;
  tasks?: ExtractedTask[];
  meeting?: ExtractedMeeting | null;
  messages?: ExtractedMessage[];
}

const EXTRACTION_MODEL = "gemini-2.5-flash";

function buildExtractionPrompt(
  systemPrompt: string,
  transcript: string,
): string {
  return `You are a call data extraction assistant. A voice agent just completed a call. Extract structured data from the transcript based on what the agent was trying to accomplish.

AGENT INSTRUCTIONS:
${systemPrompt}

CALL TRANSCRIPT:
${transcript}

Extract all available data and return ONLY valid JSON with this exact shape:
{
  "qualification": {
    "contact_name": string | null,
    "email": string | null,
    "phone": string | null,
    "geography_interest": string | null,
    "budget": string | null,
    "timeline": string | null,
    "decision_authority": string | null,
    "qualification_status": "qualified" | "soft_rejected" | "hard_rejected" | "pending",
    "lead_score": number (0-10) | null,
    "notes": string | null
  },
  "tasks": [{ "title": string, "description": string, "scheduled_at": string | null }],
  "meeting": { "participant_name": string, "participant_email": string, "datetime_gst": string, "geography": string, "notes": string } | null,
  "messages": [{ "content": string, "channel": "sms" | "whatsapp" }]
}

Rules:
- Only include qualification fields where information was explicitly stated; use null for unknown fields
- qualification_status: "qualified" = ready to proceed, "soft_rejected" = interested but not ready now, "hard_rejected" = clearly not interested, "pending" = unclear
- lead_score: 0-10 based on engagement, budget fit, and intent signals
- tasks: always create at least one follow-up task summarising what the next step should be
- meeting: null if no specific meeting was discussed or requested
- messages: only if the caller asked to be sent something, or a follow-up message is clearly warranted
- Return pure JSON only — no markdown fences, no commentary`;
}

export async function extractCallData(
  callHistoryId: string,
  agentKey: string,
  roomName: string,
): Promise<void> {
  const db = getDb();

  // 1. Read transcript turns
  const snap = await db
    .collection("callHistory")
    .doc(callHistoryId)
    .collection("transcripts")
    .orderBy("ts", "asc")
    .get();

  if (snap.empty) {
    console.log(`[extractor] no transcript for ${callHistoryId} — skipping`);
    return;
  }

  const transcript = snap.docs
    .map((d) => {
      const { speaker, text } = d.data() as { speaker: string; text: string };
      return `${speaker === "agent" ? "Agent" : "Caller"}: ${text}`;
    })
    .join("\n");

  // 2. Fetch agent and build system prompt
  const agentData = await getAgent(agentKey);
  if (!agentData) {
    console.warn(`[extractor] agent ${agentKey} not found — skipping`);
    return;
  }
  const systemPrompt = buildSystemPrompt(agentData);

  // 3. Resolve Gemini API key (per-agent key, fall back to env)
  const resolvedKeys = await resolveProviderKeys(agentData);
  const apiKey = resolvedKeys.liveApiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[extractor] no Gemini API key available — skipping extraction",
    );
    return;
  }

  // 4. Run LLM extraction
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EXTRACTION_MODEL });
  const result = await model.generateContent(
    buildExtractionPrompt(systemPrompt, transcript),
  );
  const raw = result.response
    .text()
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const extracted: ExtractionResult = JSON.parse(raw);

  // Capture token usage for cost tracking
  const usage = result.response.usageMetadata;
  const extractionInputTokens = usage?.promptTokenCount ?? 0;
  const extractionOutputTokens = usage?.candidatesTokenCount ?? 0;

  // 5. Persist extracted data
  const now = Date.now();
  const writes: Promise<unknown>[] = [];

  // Qualification — strip null fields before writing
  if (extracted.qualification) {
    const qual = Object.fromEntries(
      Object.entries(extracted.qualification).filter(
        ([, v]) => v !== null && v !== undefined,
      ),
    );
    if (Object.keys(qual).length > 0) {
      writes.push(
        db
          .collection("call_qualifications")
          .doc(roomName)
          .set(
            { roomName, agentKey, ...qual, updatedAt: now },
            { merge: true },
          ),
      );
    }
  }

  // Follow-up tasks
  for (const task of extracted.tasks ?? []) {
    writes.push(
      db.collection("call_tasks").add({
        roomName,
        agentKey,
        title: task.title,
        description: task.description ?? "",
        scheduledAt: task.scheduled_at ?? null,
        status: "pending",
        createdAt: now,
        source: "post_call_extraction",
      }),
    );
  }

  // Meeting booking
  if (extracted.meeting) {
    writes.push(
      db.collection("call_meetings").add({
        roomName,
        agentKey,
        ...extracted.meeting,
        status: "pending_confirmation",
        createdAt: now,
        source: "post_call_extraction",
      }),
    );
  }

  // Queued messages
  for (const msg of extracted.messages ?? []) {
    writes.push(
      db.collection("call_messages").add({
        roomName,
        agentKey,
        content: msg.content,
        channel: msg.channel,
        status: "pending",
        createdAt: now,
        source: "post_call_extraction",
      }),
    );
  }

  await Promise.all(writes);

  // Persist extraction token counts on the call record for cost tracking
  if (extractionInputTokens || extractionOutputTokens) {
    await updateCallRecord(roomName, {
      extractionInputTokens,
      extractionOutputTokens,
    });
  }

  console.log(
    `[extractor] done for ${callHistoryId} — tasks:${extracted.tasks?.length ?? 0} meeting:${!!extracted.meeting} messages:${extracted.messages?.length ?? 0} tokens:${extractionInputTokens}+${extractionOutputTokens}`,
  );
}
