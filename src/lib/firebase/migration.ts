import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { type AgentFirestoreDoc } from "./agents";

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
