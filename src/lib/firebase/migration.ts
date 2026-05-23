import "server-only";
import fs from "fs";
import path from "path";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { type AgentFirestoreDoc } from "./agents";
import { type CallRecord } from "@/lib/history";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractBracketedSection(text: string, header: string): string {
  const regex = new RegExp(`\\[${header}\\]([\\s\\S]*?)(?=\\[|$)`);
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function hasBracketedHeaders(text: string): boolean {
  return /\[ROLE AND RESPONSIBILITIES\]/.test(text);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MigrationLog {
  agentKey: string;
  action: "parsed" | "copy-to-additional" | "skipped";
  before: {
    voiceInstructions?: string;
    roleAndResponsibilities?: string;
    personaLanguageAndTone?: string;
    mistakesToAvoid?: string;
    additionalInstructions?: string;
  };
  after: {
    roleAndResponsibilities?: string;
    personaLanguageAndTone?: string;
    mistakesToAvoid?: string;
    additionalInstructions?: string;
    migrationApplied?: boolean;
  };
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  logs: MigrationLog[];
}

// ─── Main migration function ─────────────────────────────────────────────────

/**
 * One-time backfill: parses voiceInstructions with [BRACKETED HEADERS] into the
 * four section fields. Agents that already have any section fields populated are
 * skipped to prevent data loss.
 *
 * Never modifies voiceInstructions itself — it stays as dormant historical data.
 */
export async function migrateAgents(): Promise<MigrationResult> {
  const db = getDb();
  const snap = await db.collection("agents").get();

  const logs: MigrationLog[] = [];
  let migrated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as AgentFirestoreDoc;

    // Skip agents that already have any populated section fields
    const hasPopulatedFields =
      data.roleAndResponsibilities?.trim() ||
      data.personaLanguageAndTone?.trim() ||
      data.mistakesToAvoid?.trim() ||
      data.additionalInstructions?.trim();

    if (hasPopulatedFields) {
      skipped++;
      logs.push({
        agentKey: doc.id,
        action: "skipped",
        before: {},
        after: {},
      });
      continue;
    }

    const voiceInstructions =
      (data.voiceInstructions as string | undefined) ?? "";
    if (!voiceInstructions.trim()) {
      skipped++;
      logs.push({
        agentKey: doc.id,
        action: "skipped",
        before: {},
        after: {},
      });
      continue;
    }

    const before = { voiceInstructions };
    let after: MigrationLog["after"];
    let action: "parsed" | "copy-to-additional";

    if (hasBracketedHeaders(voiceInstructions)) {
      after = {
        roleAndResponsibilities: extractBracketedSection(
          voiceInstructions,
          "ROLE AND RESPONSIBILITIES",
        ),
        personaLanguageAndTone: extractBracketedSection(
          voiceInstructions,
          "PERSONA LANGUAGE AND TONE",
        ),
        mistakesToAvoid: extractBracketedSection(
          voiceInstructions,
          "MISTAKES TO AVOID",
        ),
        additionalInstructions: extractBracketedSection(
          voiceInstructions,
          "ADDITIONAL INSTRUCTIONS",
        ),
        migrationApplied: true,
      };
      action = "parsed";
    } else {
      // Free-form voiceInstructions — copy to additionalInstructions verbatim
      after = {
        additionalInstructions: voiceInstructions,
        migrationApplied: true,
      };
      action = "copy-to-additional";
    }

    await doc.ref.set(
      { ...after, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    migrated++;
    logs.push({ agentKey: doc.id, action, before, after });
  }

  return { migrated, skipped, logs };
}

// ─── Call history JSON → Firestore migration ─────────────────────────────────

export interface CallHistoryMigrationResult {
  migrated: number;
  skipped: number;
  sourceFile: string;
}

export async function migrateCallHistoryJson(): Promise<CallHistoryMigrationResult> {
  const sourceFile = path.join(process.cwd(), "call-history.json");

  if (!fs.existsSync(sourceFile)) {
    return { migrated: 0, skipped: 0, sourceFile };
  }

  const records: CallRecord[] = JSON.parse(
    fs.readFileSync(sourceFile, "utf-8"),
  );
  const db = getDb();
  const col = db.collection("callHistory");

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    // Check if already migrated (by id field, not doc ID)
    const existing = await col.where("id", "==", record.id).limit(1).get();
    if (!existing.empty) {
      skipped++;
      continue;
    }
    await col.add({
      ...record,
      agentId: record.agentKey,
      createdAt: FieldValue.serverTimestamp(),
    });
    migrated++;
  }

  return { migrated, skipped, sourceFile };
}

// ─── Re-key callHistory docs to Firestore auto-IDs ───────────────────────────
// Old docs used the roomName as the Firestore doc ID. This migration creates a
// new auto-ID doc for each such record and deletes the old one.

// Simple targeted normalisation for the two existing real playground phone-call docs.
// Sets isPlayground: true, testType: "phoneCall", roomName from old id field, and
// removes the redundant id field.
export async function normalizeCallHistoryDocs(): Promise<{
  updated: number;
  skipped: number;
}> {
  const col = getDb().collection("callHistory");
  const snap = await col.get();
  let updated = 0;
  let skipped = 0;

  const batch = getDb().batch();
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const alreadyNormalized =
      !("id" in data) && "roomName" in data && "isPlayground" in data;

    if (alreadyNormalized) {
      skipped++;
      continue;
    }

    const roomName = String(data.roomName ?? data.id ?? doc.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = data;
    batch.set(doc.ref, {
      ...rest,
      roomName,
      isPlayground: true,
      testType: "widget",
    });
    updated++;
  }

  await batch.commit();
  return { updated, skipped };
}

// Normalises all callHistory docs to the current schema:
// - Removes the `id` field (doc ID is the identifier now)
// - Ensures `roomName` field exists (falls back to old `id` field value)
// - Ensures `isPlayground` field exists (backfills based on presence of phoneNumber)
// Safe to run multiple times — docs already conforming are skipped.
export async function reKeyCallHistoryDocs(): Promise<{
  updated: number;
  skipped: number;
}> {
  const col = getDb().collection("callHistory");
  const snap = await col.get();

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const needsUpdate =
      "id" in data || !("roomName" in data) || !("isPlayground" in data);

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    const roomName = (data.roomName ?? data.id) as string;
    const isPlayground = "isPlayground" in data ? data.isPlayground : false;

    // Build the cleaned document without the `id` field
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = data;
    await doc.ref.set({ ...rest, roomName, isPlayground }, { merge: true });
    // Remove the `id` field explicitly using statically imported FieldValue
    if ("id" in data) {
      await doc.ref.update({ id: FieldValue.delete() });
    }
    updated++;
  }

  return { updated, skipped };
}

// ─── Re-key dynamic agents to Firestore auto-IDs ─────────────────────────────
// Dynamic agents created before the random-ID migration used the slug as the
// Firestore doc ID. This migration creates a new auto-ID doc for each such
// agent, copies all fields, writes slug + key, then deletes the old doc.
// Safe to run multiple times — docs that already have a `key` field are skipped.

export async function migrateAgentDocIds(): Promise<{
  migrated: number;
  skipped: number;
  logs: { oldId: string; newId: string }[];
}> {
  const db = getDb();
  const col = db.collection("agents");
  const snap = await col.get();

  let migrated = 0;
  let skipped = 0;
  const logs: { oldId: string; newId: string }[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as AgentFirestoreDoc & {
      key?: string;
      slug?: string;
    };

    // Skip docs that already have a stored `key` field (already migrated or static)
    if (data.key) {
      skipped++;
      continue;
    }

    // Only migrate dynamic agents — leave static registry agents alone
    if (!data.isDynamic) {
      skipped++;
      continue;
    }

    const slug = data.slug ?? doc.id;

    // Create new doc with Firestore auto-ID
    const newRef = await col.add({
      ...data,
      slug,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Write the new doc ID back as the `key` field
    await newRef.update({ key: newRef.id });

    // Delete the old slug-keyed doc
    await doc.ref.delete();

    logs.push({ oldId: doc.id, newId: newRef.id });
    migrated++;
  }

  return { migrated, skipped, logs };
}

// ─── Backfill isPlayground / testType on existing callHistory docs ────────────
// Real calls get isPlayground: false. Playground widget calls already have the
// field set at creation time; this only touches docs where it is missing.

export async function backfillPlaygroundFields(): Promise<{
  updated: number;
  skipped: number;
}> {
  const col = getDb().collection("callHistory");
  const snap = await col.get();

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if ("isPlayground" in data) {
      skipped++;
      continue;
    }
    await doc.ref.update({ isPlayground: false });
    updated++;
  }

  return { updated, skipped };
}
