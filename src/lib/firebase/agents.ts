import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getDb } from "./admin";
import {
  agents as registryAgents,
  type AgentConfig,
  type AgentDirection,
} from "@/lib/agents/registry";

// ─── Filesystem fallback (for agents not yet migrated to Firestore) ───────────

function extractSection(content: string, sectionName: string): string {
  const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\[|$)`);
  const match = content.match(regex);
  if (!match) return "";
  return match[1]
    .trim()
    .replace(/[`;\s]+$/, "")
    .trim();
}

async function readPromptFromFilesystem(
  agentKey: string,
  direction: string,
): Promise<Pick<
  AgentFullData,
  | "roleAndResponsibilities"
  | "personaLanguageAndTone"
  | "mistakesToAvoid"
  | "additionalInstructions"
> | null> {
  try {
    const promptPath = path.join(
      process.cwd(),
      "src",
      "lib",
      "agents",
      direction,
      agentKey,
      "prompt.ts",
    );
    const content = await fs.readFile(promptPath, "utf-8");
    return {
      roleAndResponsibilities: extractSection(
        content,
        "ROLE AND RESPONSIBILITIES",
      ),
      personaLanguageAndTone: extractSection(
        content,
        "PERSONA LANGUAGE AND TONE",
      ),
      mistakesToAvoid: extractSection(content, "MISTAKES TO AVOID"),
      additionalInstructions: extractSection(
        content,
        "ADDITIONAL INSTRUCTIONS",
      ),
    };
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LlmProvider = "google" | "openai";
export type TtsProvider = "elevenlabs" | "cartesia";
export type SttProvider = "deepgram";

export interface VoiceSettings {
  callType: "inbound" | "outbound";
  language: string;
  sttLanguage: string;
  sttModel: string;
  ttsModel: string;
  ttsVoiceId: string;
  voiceType: string;
  llmModel: string;
  // Provider selection + saved API key reference
  llmProvider?: LlmProvider;
  llmConfigId?: string;
  ttsProvider?: TtsProvider;
  ttsConfigId?: string;
  sttProvider?: SttProvider;
  sttConfigId?: string;
}

/** Raw Firestore document shape — unknown extra fields are preserved via index sig */
export interface AgentFirestoreDoc {
  name?: string;
  description?: string;
  voiceEnabled?: boolean;
  roleAndResponsibilities?: string;
  personaLanguageAndTone?: string;
  mistakesToAvoid?: string;
  additionalInstructions?: string;
  voiceGreeting?: string;
  voiceInstructions?: string;
  voiceSettings?: Partial<VoiceSettings>;
  tools?: string[];
  migrationApplied?: boolean;
  updatedAt?: FirebaseFirestore.Timestamp;
  updatedBy?: string;
  updatedByName?: string;
  userId?: string;
  // Dynamic-agent fields (set on creation, read-only after)
  isDynamic?: boolean;
  direction?: string;
  language?: string;
  dispatchRuleName?: string;
  phoneNumber?: string;
  industry?: string;
  // allow unknown fields — they are preserved on partial writes
  [key: string]: unknown;
}

/** Combined agent object returned by the data layer (safe for JSON serialization) */
export interface AgentFullData extends AgentConfig {
  voiceEnabled: boolean;
  roleAndResponsibilities: string;
  personaLanguageAndTone: string;
  mistakesToAvoid: string;
  additionalInstructions: string;
  voiceGreeting: string;
  voiceInstructions: string;
  voiceSettings: VoiceSettings;
  tools: string[];
  migrationApplied?: boolean;
  updatedAt?: number; // Unix ms — safe for JSON
  updatedBy?: string;
  updatedByName?: string;
  userId?: string;
}

// ─── Field allowlist (Tier 1 write) ──────────────────────────────────────────

/**
 * Only these top-level fields may be written by the UI save path.
 * Any field not in this set is silently dropped on write.
 */
const TIER1_FIELD_LIST = [
  "name",
  "description",
  "roleAndResponsibilities",
  "personaLanguageAndTone",
  "mistakesToAvoid",
  "additionalInstructions",
  "voiceGreeting",
  "voiceInstructions",
  "voiceEnabled",
  "voiceSettings",
  "migrationApplied",
  "userId",
] as const;

export type Tier1Field = (typeof TIER1_FIELD_LIST)[number];

export const TIER1_WRITE_FIELDS = new Set<string>(TIER1_FIELD_LIST);

/** Maps UI labels to Firestore field names — single source of truth */
export const DISPLAY_FIELD_MAP = {
  "What it does": "roleAndResponsibilities",
  "How it should talk": "personaLanguageAndTone",
  "What it should never do": "mistakesToAvoid",
  "Anything else": "additionalInstructions",
  "Opening line": "voiceGreeting",
  "Voice behavior rules": "voiceInstructions",
  "Live / Paused toggle": "voiceEnabled",
  Language: "voiceSettings.language",
  Voice: "voiceSettings.ttsVoiceId",
  "STT model": "voiceSettings.sttModel",
  "TTS model": "voiceSettings.ttsModel",
  "LLM model": "voiceSettings.llmModel",
  Direction: "voiceSettings.callType",
} as const;

// ─── Validation schemas ───────────────────────────────────────────────────────

const VoiceSettingsWriteSchema = z
  .object({
    // callType is read-only — excluded from writes
    language: z.string().max(20).optional(),
    sttLanguage: z.string().max(20).optional(),
    sttModel: z.string().max(50).optional(),
    ttsModel: z.string().max(50).optional(),
    ttsVoiceId: z.string().max(100).optional(),
    voiceType: z.string().max(50).optional(),
    llmModel: z.string().max(100).optional(),
    llmProvider: z.enum(["google", "openai"]).optional(),
    llmConfigId: z.string().max(128).optional(),
    ttsProvider: z.enum(["elevenlabs", "cartesia"]).optional(),
    ttsConfigId: z.string().max(128).optional(),
    sttProvider: z.enum(["deepgram"]).optional(),
    sttConfigId: z.string().max(128).optional(),
  })
  .strict();

export const AgentWriteSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    roleAndResponsibilities: z.string().optional(),
    personaLanguageAndTone: z.string().optional(),
    mistakesToAvoid: z.string().optional(),
    additionalInstructions: z.string().optional(),
    voiceGreeting: z.string().optional(),
    voiceInstructions: z.string().optional(),
    voiceEnabled: z.boolean().optional(),
    voiceSettings: VoiceSettingsWriteSchema.optional(),
    migrationApplied: z.boolean().optional(),
    userId: z.string().optional(),
  })
  .strict();

export type AgentWritePayload = z.infer<typeof AgentWriteSchema>;

// ─── Default voice settings ───────────────────────────────────────────────────

function defaultVoiceSettings(
  direction: "inbound" | "outbound",
): VoiceSettings {
  return {
    callType: direction,
    language: "en-US",
    sttLanguage: "multi",
    sttModel: "nova-3",
    ttsModel: "sonic-3",
    ttsVoiceId: "",
    voiceType: "female-1",
    llmModel: "gemini-2.0-flash",
  };
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

function mergeAgentData(
  config: AgentConfig,
  doc: AgentFirestoreDoc,
): AgentFullData {
  const defaults = defaultVoiceSettings(config.direction);
  return {
    ...config,
    name: doc.name ?? config.name,
    description: doc.description ?? config.description,
    voiceEnabled: doc.voiceEnabled ?? false,
    roleAndResponsibilities: doc.roleAndResponsibilities ?? "",
    personaLanguageAndTone: doc.personaLanguageAndTone ?? "",
    mistakesToAvoid: doc.mistakesToAvoid ?? "",
    additionalInstructions: doc.additionalInstructions ?? "",
    voiceGreeting: doc.voiceGreeting ?? "",
    voiceInstructions: doc.voiceInstructions ?? "",
    voiceSettings: {
      ...defaults,
      ...(doc.voiceSettings ?? {}),
    },
    tools: doc.tools ?? [],
    migrationApplied: doc.migrationApplied,
    updatedAt: doc.updatedAt?.toMillis(),
    updatedBy: doc.updatedBy,
    updatedByName: doc.updatedByName,
    userId: doc.userId,
  };
}

// ─── Data layer functions ─────────────────────────────────────────────────────

/**
 * Returns all agents from the registry, overlaying Firestore name/voiceEnabled.
 * Safe to use in server components — falls back to registry-only on Firestore error.
 */
export async function listAgents(uid?: string): Promise<AgentFullData[]> {
  const staticAgents = Object.values(registryAgents);
  try {
    const db = getDb();
    const snap = await db.collection("agents").get();
    const byKey = new Map<string, AgentFirestoreDoc>();
    snap.docs.forEach((d) => byKey.set(d.id, d.data() as AgentFirestoreDoc));

    const results: AgentFullData[] = staticAgents.map((config) =>
      mergeAgentData(config, byKey.get(config.key) ?? {}),
    );

    // Also include Firestore-only agents (dynamically created via UI)
    // When uid is provided, only return agents belonging to that user
    for (const doc of snap.docs) {
      const data = doc.data() as AgentFirestoreDoc;
      if (data.isDynamic && !registryAgents[doc.id]) {
        if (uid && data.userId && data.userId !== uid) continue;
        const dynamicConfig: AgentConfig = {
          key: doc.id,
          direction: (data.direction as AgentDirection) ?? "outbound",
          name: data.name ?? doc.id,
          language: data.language ?? "en",
          dispatchRuleName: data.dispatchRuleName ?? "",
          phoneNumber: data.phoneNumber ?? "",
          description: data.description ?? "",
        };
        results.push(mergeAgentData(dynamicConfig, data));
      }
    }

    return results;
  } catch (err) {
    console.error("[firebase/agents] listAgents failed:", err);
    return staticAgents.map((config) => mergeAgentData(config, {}));
  }
}

/**
 * Returns a fully-merged agent object for a given agentKey.
 * Returns null if the key is not in the registry.
 */
export async function getAgent(
  agentKey: string,
): Promise<AgentFullData | null> {
  const config = registryAgents[agentKey];

  try {
    const db = getDb();
    const docRef = db.collection("agents").doc(agentKey);
    const snap = await docRef.get();

    // For dynamic agents not in the static registry, build config from Firestore
    const firestoreData = snap.exists ? (snap.data() as AgentFirestoreDoc) : {};
    const effectiveConfig: AgentConfig =
      config ??
      (firestoreData.isDynamic
        ? {
            key: agentKey,
            direction:
              (firestoreData.direction as AgentDirection) ?? "outbound",
            name: firestoreData.name ?? agentKey,
            language: firestoreData.language ?? "en",
            dispatchRuleName: firestoreData.dispatchRuleName ?? "",
            phoneNumber: firestoreData.phoneNumber ?? "",
            description: firestoreData.description ?? "",
          }
        : null);

    if (!effectiveConfig) return null;

    const agentData = mergeAgentData(effectiveConfig, firestoreData);

    // If the section fields have never been saved individually, try two fallbacks
    // in priority order so the UI always shows the agent's actual content.
    // (Skip for dynamic agents — they start with Firestore content only)
    if (
      !agentData.roleAndResponsibilities &&
      !agentData.personaLanguageAndTone &&
      config // static agents only
    ) {
      // 1. voiceInstructions in Firestore contains the full prompt with [HEADERS]
      if (
        agentData.voiceInstructions &&
        /\[ROLE AND RESPONSIBILITIES\]/.test(agentData.voiceInstructions)
      ) {
        return {
          ...agentData,
          roleAndResponsibilities: extractSection(
            agentData.voiceInstructions,
            "ROLE AND RESPONSIBILITIES",
          ),
          personaLanguageAndTone: extractSection(
            agentData.voiceInstructions,
            "PERSONA LANGUAGE AND TONE",
          ),
          mistakesToAvoid: extractSection(
            agentData.voiceInstructions,
            "MISTAKES TO AVOID",
          ),
          additionalInstructions: extractSection(
            agentData.voiceInstructions,
            "ADDITIONAL INSTRUCTIONS",
          ),
        };
      }

      // 2. Static prompt.ts on disk (for agents never saved to Firestore at all)
      const fsData = await readPromptFromFilesystem(agentKey, config.direction);
      if (fsData) return { ...agentData, ...fsData };
    }

    return agentData;
  } catch (err) {
    console.error("[firebase/agents] getAgent failed:", err);
    if (!config) return null;
    return mergeAgentData(config, {});
  }
}

// ─── Create dynamic agent ─────────────────────────────────────────────────────

export interface CreateAgentParams {
  name: string;
  direction: "inbound" | "outbound";
  language: string;
  dispatchRuleName: string;
  description: string;
  roleAndResponsibilities: string;
  personaLanguageAndTone?: string;
  mistakesToAvoid?: string;
  additionalInstructions?: string;
  voiceGreeting?: string;
  industry?: string;
  userId: string;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "agent"
  );
}

export async function createAgent(
  params: CreateAgentParams,
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  try {
    const db = getDb();
    const slug = slugify(params.name);
    const docRef = await db.collection("agents").add({
      isDynamic: true,
      slug,
      name: params.name,
      description: params.description,
      direction: params.direction,
      language: params.language,
      dispatchRuleName: params.dispatchRuleName,
      phoneNumber: "",
      roleAndResponsibilities: params.roleAndResponsibilities,
      personaLanguageAndTone: params.personaLanguageAndTone ?? "",
      mistakesToAvoid: params.mistakesToAvoid ?? "",
      additionalInstructions: params.additionalInstructions ?? "",
      voiceGreeting: params.voiceGreeting ?? "",
      voiceEnabled: false,
      voiceSettings: defaultVoiceSettings(params.direction),
      tools: [],
      industry: params.industry ?? "other",
      userId: params.userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Write the Firestore-generated doc ID back as the `key` field
    await docRef.update({ key: docRef.id });
    return { ok: true, key: docRef.id };
  } catch (err) {
    console.error("[firebase/agents] createAgent failed:", err);
    return { ok: false, error: "Failed to create agent" };
  }
}

// ─── Update result types ──────────────────────────────────────────────────────

export type UpdateResult =
  | { ok: true; updatedAt: number }
  | {
      ok: false;
      conflict: true;
      currentUpdatedAt?: number;
      updatedBy?: string;
      updatedByName?: string;
    }
  | { ok: false; error: string };

/**
 * Partially updates an agent document with Tier-1 fields only.
 *
 * If clientUpdatedAt is provided and doesn't match the server's current
 * updatedAt (and force !== true), returns a conflict result so the UI
 * can warn the user.
 */
export async function updateAgentConfig(
  agentKey: string,
  payload: AgentWritePayload,
  meta: {
    updatedBy: string;
    updatedByName: string;
    clientUpdatedAt?: number;
    force?: boolean;
  },
): Promise<UpdateResult> {
  try {
    const db = getDb();
    const docRef = db.collection("agents").doc(agentKey);

    // Validate with Zod — throws ZodError on bad input
    const parsed = AgentWriteSchema.parse(payload);

    // Stale-version check
    if (meta.clientUpdatedAt !== undefined && !meta.force) {
      const current = await docRef.get();
      if (current.exists) {
        const currentTs = (current.data() as AgentFirestoreDoc).updatedAt;
        const serverMs = currentTs?.toMillis() ?? 0;
        if (serverMs !== 0 && serverMs !== meta.clientUpdatedAt) {
          const d = current.data() as AgentFirestoreDoc;
          return {
            ok: false,
            conflict: true,
            currentUpdatedAt: serverMs,
            updatedBy: d.updatedBy,
            updatedByName: d.updatedByName,
          };
        }
      }
    }

    // Build the safe write object — only TIER1 fields + audit meta
    const writeData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: meta.updatedBy,
      updatedByName: meta.updatedByName,
    };

    for (const [k, v] of Object.entries(parsed)) {
      if (TIER1_WRITE_FIELDS.has(k)) {
        if (k === "voiceSettings" && v && typeof v === "object") {
          // Merge sub-fields to avoid overwriting callType (read-only)
          for (const [sk, sv] of Object.entries(v)) {
            writeData[`voiceSettings.${sk}`] = sv;
          }
        } else {
          writeData[k] = v;
        }
      }
    }

    // update() is a partial write — unknown Firestore fields are preserved
    await docRef.set(writeData, { merge: true });

    // Read back the new updatedAt
    const updated = await docRef.get();
    const newTs = (updated.data() as AgentFirestoreDoc).updatedAt;
    return { ok: true, updatedAt: newTs?.toMillis() ?? Date.now() };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.errors.map((e) => e.message).join("; ") };
    }
    console.error("[firebase/agents] updateAgentConfig failed:", err);
    return { ok: false, error: "Failed to save — please try again." };
  }
}

/**
 * Toggles voiceEnabled for an agent (optimistic-update path — no stale check).
 */
export async function setAgentLiveStatus(
  agentKey: string,
  voiceEnabled: boolean,
  meta: { updatedBy: string; updatedByName: string },
): Promise<{ ok: true; updatedAt: number } | { ok: false; error: string }> {
  const config = registryAgents[agentKey];
  if (!config) return { ok: false, error: "Agent not found" };

  try {
    const db = getDb();
    await db.collection("agents").doc(agentKey).set(
      {
        voiceEnabled,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: meta.updatedBy,
        updatedByName: meta.updatedByName,
      },
      { merge: true },
    );
    return { ok: true, updatedAt: Date.now() };
  } catch (err) {
    console.error("[firebase/agents] setAgentLiveStatus failed:", err);
    return { ok: false, error: "Failed to update live status." };
  }
}
