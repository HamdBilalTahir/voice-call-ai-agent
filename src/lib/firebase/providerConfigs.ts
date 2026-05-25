import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getDb, getAdminApp } from "./admin";

export type ProviderType =
  | "google"
  | "openai"
  | "elevenlabs"
  | "cartesia"
  | "deepgram";

export interface ProviderConfigDoc {
  id: string;
  uid: string;
  provider: ProviderType;
  label: string;
  apiKey: string;
  maskedKey: string;
  createdAt: number;
  updatedAt: number;
}

/** Returns the last-4 masked representation of a key for display. */
function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function docPath(uid: string): string {
  return `userProfile/${uid}/providerConfigs`;
}

export async function listProviderConfigs(
  uid: string,
  provider?: ProviderType,
): Promise<ProviderConfigDoc[]> {
  const db = getDb();
  let q = db.collection(docPath(uid)) as FirebaseFirestore.Query;
  if (provider) q = q.where("provider", "==", provider);
  const snap = await q.orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid: data.uid as string,
      provider: data.provider as ProviderType,
      label: data.label as string,
      apiKey: data.apiKey as string,
      maskedKey: data.maskedKey as string,
      createdAt: (data.createdAt?.toMillis?.() as number) ?? Date.now(),
      updatedAt: (data.updatedAt?.toMillis?.() as number) ?? Date.now(),
    };
  });
}

export async function createProviderConfig(
  uid: string,
  input: { provider: ProviderType; label: string; apiKey: string },
): Promise<ProviderConfigDoc> {
  const db = getDb();
  const ref = db.collection(docPath(uid)).doc();
  const maskedKey = maskKey(input.apiKey);
  await ref.set({
    uid,
    provider: input.provider,
    label: input.label,
    apiKey: input.apiKey,
    maskedKey,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return {
    id: ref.id,
    uid,
    provider: input.provider,
    label: input.label,
    apiKey: input.apiKey,
    maskedKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function deleteProviderConfig(
  uid: string,
  configId: string,
): Promise<void> {
  const db = getDb();
  await db.collection(docPath(uid)).doc(configId).delete();
}

export async function getProviderConfig(
  uid: string,
  configId: string,
): Promise<ProviderConfigDoc | null> {
  const db = getDb();
  const snap = await db.collection(docPath(uid)).doc(configId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    uid: data.uid as string,
    provider: data.provider as ProviderType,
    label: data.label as string,
    apiKey: data.apiKey as string,
    maskedKey: data.maskedKey as string,
    createdAt: (data.createdAt?.toMillis?.() as number) ?? Date.now(),
    updatedAt: (data.updatedAt?.toMillis?.() as number) ?? Date.now(),
  };
}

/** Verifies a Firebase ID token and returns the UID. Returns null on failure. */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
