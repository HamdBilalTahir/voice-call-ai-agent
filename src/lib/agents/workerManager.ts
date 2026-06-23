import "server-only";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/firebase/admin";

// ── Paths ───────────────────────────────────────────────────────────────────

const PID_DIR = path.join(process.cwd(), ".agent-pids");
const WORKER_SCRIPT = path.join(
  process.cwd(),
  "src",
  "lib",
  "agents",
  "worker",
  "agent.ts",
);

// Persistent per-agent worker metadata. The worker registers with LiveKit under
// `dispatchRule` (the agent's name slug); we persist it so a later start can tell
// whether the running worker is still registered under the correct name.
interface WorkerMeta {
  pid: number;
  dispatchRule: string;
}

function metaFile(agentKey: string) {
  return path.join(PID_DIR, `${agentKey}.json`);
}

// Legacy plain-PID file written by older builds; read as a fallback so an
// in-flight worker started before this change is still recognised.
function legacyPidFile(agentKey: string) {
  return path.join(PID_DIR, `${agentKey}.pid`);
}

function readMeta(agentKey: string): WorkerMeta | null {
  try {
    const raw = fs.readFileSync(metaFile(agentKey), "utf-8").trim();
    const parsed = JSON.parse(raw) as WorkerMeta;
    if (parsed?.pid) return parsed;
  } catch {
    /* fall through to legacy */
  }
  try {
    const pid = parseInt(
      fs.readFileSync(legacyPidFile(agentKey), "utf-8").trim(),
    );
    if (pid) return { pid, dispatchRule: "" };
  } catch {
    /* no worker recorded */
  }
  return null;
}

function writeMeta(agentKey: string, meta: WorkerMeta) {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.writeFileSync(metaFile(agentKey), JSON.stringify(meta));
}

export function removeWorkerMeta(agentKey: string) {
  for (const f of [metaFile(agentKey), legacyPidFile(agentKey)]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* already gone */
    }
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readWorkerPid(agentKey: string): number | null {
  return readMeta(agentKey)?.pid ?? null;
}

// ── Slug / dispatch-rule resolution ──────────────────────────────────────────

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "agent"
  );
}

export interface AgentMeta {
  direction: "inbound" | "outbound";
  dispatchRuleName: string;
}

export async function resolveAgent(
  agentKey: string,
): Promise<AgentMeta | null> {
  try {
    const snap = await getDb().collection("agents").doc(agentKey).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      direction: (data.direction as "inbound" | "outbound") ?? "outbound",
      dispatchRuleName: (data.dispatchRuleName as string) || agentKey,
    };
  } catch {
    return null;
  }
}

// Migrate legacy dispatch rule names (e.g. "outbound-sales-en-dispatch") to the
// agent's name slug, persisting the change so future dispatches use it too.
async function ensureSlugDispatchRule(
  agentKey: string,
  agent: AgentMeta,
): Promise<string> {
  const snap = await getDb().collection("agents").doc(agentKey).get();
  const name = snap.data()?.name as string | undefined;
  const slug = name ? slugify(name) : slugify(agentKey);

  if (agent.dispatchRuleName !== slug) {
    console.log(
      `[worker] migrating dispatchRuleName: ${agent.dispatchRuleName} → ${slug}`,
    );
    await getDb()
      .collection("agents")
      .doc(agentKey)
      .update({ dispatchRuleName: slug });
  }
  return slug;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

export function killWorker(agentKey: string) {
  const pid = readMeta(agentKey)?.pid;
  if (pid && isProcessRunning(pid)) {
    try {
      process.kill(pid, "SIGINT");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already dead */
      }
    }
  }
  removeWorkerMeta(agentKey);
}

// Spawn a worker registered under `dispatchRule` and resolve only once it has
// registered with LiveKit (it prints "registered worker"). Rejects on timeout so
// callers never dispatch to a worker that isn't accepting jobs yet.
function spawnAndWaitForRegistration(
  dispatchRule: string,
  agentKey: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const cleanEnv: Record<string, string> = {};
    for (const key in process.env) {
      if (
        !key.startsWith("npm_config_") &&
        !key.startsWith("npm_package_") &&
        key !== "PORT" &&
        process.env[key] !== undefined
      ) {
        cleanEnv[key] = process.env[key] as string;
      }
    }
    if (process.env.PATH) cleanEnv.PATH = process.env.PATH;
    // The worker registers with LiveKit under this name; the dispatch target
    // (the agent's name slug) must match it exactly.
    cleanEnv.AGENT_DISPATCH_RULE = dispatchRule;

    const child = spawn("npx", ["--yes", "tsx", WORKER_SCRIPT, "start"], {
      cwd: process.cwd(),
      env: cleanEnv as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      removeWorkerMeta(agentKey);
      reject(new Error("Worker registration timed out after 20s"));
    }, 20_000);

    child.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      if (!settled && chunk.toString().includes("registered worker")) {
        settled = true;
        clearTimeout(timer);
        if (child.pid) {
          writeMeta(agentKey, { pid: child.pid, dispatchRule });
        }
        resolve(child.pid!);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeWorkerMeta(agentKey);
      reject(err);
    });
    child.on("exit", (code) => {
      removeWorkerMeta(agentKey);
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Worker exited before registering (code ${code})`));
      }
    });
  });
}

export interface EnsureWorkerResult {
  dispatchRule: string;
  pid: number;
  started: boolean; // true if a new worker was spawned, false if reused
}

// Guarantee a healthy worker registered under the agent's name slug exists and is
// ready to accept jobs. Reuses a live worker whose registration name still matches
// the current slug; only (re)spawns when none is running or the slug changed
// (e.g. the agent was renamed). Worker config (prompt, keys, greeting) is passed
// per-dispatch in job metadata, so config edits never require a restart.
export async function ensureWorker(
  agentKey: string,
): Promise<EnsureWorkerResult> {
  const agent = await resolveAgent(agentKey);
  if (!agent) throw new Error("Agent not found");

  const dispatchRule = await ensureSlugDispatchRule(agentKey, agent);

  const existing = readMeta(agentKey);
  if (
    existing &&
    isProcessRunning(existing.pid) &&
    existing.dispatchRule === dispatchRule
  ) {
    return { dispatchRule, pid: existing.pid, started: false };
  }

  // Stale PID, missing worker, or slug changed — start fresh.
  killWorker(agentKey);
  const pid = await spawnAndWaitForRegistration(dispatchRule, agentKey);
  return { dispatchRule, pid, started: true };
}
