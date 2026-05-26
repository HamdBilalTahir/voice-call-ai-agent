import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "callHistory";

export interface CallUsage {
  llmModel: string;
  inputTokens: number;
  outputTokens: number;
  sttModel: string;
  sttAudioMs: number;
  ttsModel: string;
  ttsCharacters: number;
  ttsAudioMs: number;
  callDurationMs: number;
}

// `id` = Firestore auto-generated doc ID. It is NOT stored as a field inside
// the document — it is always reconstructed from d.id on read.
// `roomName` = LiveKit room name, stored as a field for webhook lookups.
export interface CallRecord {
  id: string;
  roomName: string;
  agentKey: string;
  agentId?: string;
  userId?: string;
  phoneNumber?: string;
  isPlayground?: boolean;
  testType?: "widget" | "phoneCall";
  testNumber?: string;
  startTime: number;
  endTime?: number;
  callStartedAt?: number;
  callEndedAt?: number;
  duration?: number;
  status: "completed" | "missed" | "in-progress";
  direction?: "inbound" | "outbound";
  outcome?: "completed" | "dropped" | "transferred" | "failed";
  sentiment?: "positive" | "neutral" | "negative";
  sentimentScore?: number;
  transcript?: string;
  tags?: string[];
  archived?: boolean;
  usage?: CallUsage;
  pipelineMode?: "cascading" | "live_api";
}

function toFirestore(
  record: Partial<CallRecord>,
): Omit<Partial<CallRecord>, "id"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = record as CallRecord;
  return rest;
}

const col = () => getDb().collection(COLLECTION);

export async function getCallHistory(): Promise<CallRecord[]> {
  const snap = await col().orderBy("startTime", "desc").limit(1000).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CallRecord);
}

// Lookup by roomName field (used by webhook handlers).
export async function getCallRecord(
  roomName: string,
): Promise<CallRecord | null> {
  const snap = await col().where("roomName", "==", roomName).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CallRecord;
}

export async function getAgentCallHistory(
  agentKey: string,
): Promise<CallRecord[]> {
  const snap = await col()
    .where("agentKey", "==", agentKey)
    .orderBy("startTime", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CallRecord);
}

// Firestore generates the doc ID. `record.id` is NOT stored; `roomName` is.
// Returns the auto-generated Firestore doc ID so callers can use it as a foreign key.
export async function addCallRecord(record: CallRecord): Promise<string> {
  const ref = await col().add({
    ...toFirestore(record),
    agentId: record.agentKey,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// Update by roomName field (webhook path).
export async function updateCallRecord(
  roomName: string,
  updates: Partial<CallRecord>,
  opts?: { createIfMissing?: boolean },
): Promise<void> {
  const data = toFirestore(updates);
  if (Object.keys(data).length === 0) return;
  const snap = await col().where("roomName", "==", roomName).limit(1).get();
  if (snap.empty) {
    if (opts?.createIfMissing) {
      await col().add({
        roomName,
        startTime: Date.now(),
        status: "in-progress",
        agentKey: "",
        ...data,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      console.warn(
        `[history] updateCallRecord: no doc with roomName=${roomName}`,
      );
    }
    return;
  }
  await snap.docs[0].ref.update(data);
}

// Update by Firestore doc ID (UI bulk-archive path).
export async function updateCallRecordById(
  docId: string,
  updates: Partial<CallRecord>,
): Promise<void> {
  const ref = col().doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.warn(`[history] updateCallRecordById: doc ${docId} not found`);
    return;
  }
  await ref.update(toFirestore(updates));
}
