import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/firebase/admin";

const PID_DIR = path.join(process.cwd(), ".agent-pids");
const WORKER_SCRIPT = path.join(
  process.cwd(),
  "src",
  "lib",
  "agents",
  "worker",
  "agent.ts",
);

function pidFile(agentKey: string) {
  return path.join(PID_DIR, `${agentKey}.pid`);
}

function readPid(agentKey: string): number | null {
  try {
    const raw = fs.readFileSync(pidFile(agentKey), "utf-8").trim();
    return parseInt(raw) || null;
  } catch {
    return null;
  }
}

function writePid(agentKey: string, pid: number) {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.writeFileSync(pidFile(agentKey), String(pid));
}

function removePid(agentKey: string) {
  try {
    fs.unlinkSync(pidFile(agentKey));
  } catch {
    /* already gone */
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killAgent(agentKey: string) {
  const pid = readPid(agentKey);
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
  removePid(agentKey);
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

interface AgentMeta {
  direction: "inbound" | "outbound";
  dispatchRuleName: string;
}

async function resolveAgent(agentKey: string): Promise<AgentMeta | null> {
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

async function ensureSlugDispatchRule(
  agentKey: string,
  agent: AgentMeta,
): Promise<string> {
  const snap = await getDb().collection("agents").doc(agentKey).get();
  const name = snap.data()?.name as string | undefined;
  const slug = name ? slugify(name) : slugify(agentKey);

  if (agent.dispatchRuleName !== slug) {
    console.log(
      `[process] migrating dispatchRuleName: ${agent.dispatchRuleName} → ${slug}`,
    );
    await getDb()
      .collection("agents")
      .doc(agentKey)
      .update({ dispatchRuleName: slug });
  }
  return slug;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentKey = searchParams.get("agentKey");
  if (!agentKey)
    return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

  const agent = await resolveAgent(agentKey);
  if (!agent)
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const pid = readPid(agentKey);
  const isRunning = pid !== null && isProcessRunning(pid);
  if (!isRunning) removePid(agentKey);
  return NextResponse.json({ isRunning });
}

export async function POST(request: Request) {
  try {
    const { agentKey, action } = await request.json();
    if (!agentKey)
      return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

    const agent = await resolveAgent(agentKey);
    if (!agent)
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    if (action === "start") {
      killAgent(agentKey);

      // Migrate legacy dispatch rule names (e.g. "outbound-sales-en-dispatch")
      // to the agent's name slug. Updates Firestore so future calls also use it.
      const dispatchRule = await ensureSlugDispatchRule(agentKey, agent);

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
      // Pass the migrated slug so the worker registers with the right name
      cleanEnv.AGENT_DISPATCH_RULE = dispatchRule;

      const child = spawn("npx", ["--yes", "tsx", WORKER_SCRIPT, "start"], {
        cwd: process.cwd(),
        env: cleanEnv as NodeJS.ProcessEnv,
        stdio: ["ignore", "inherit", "inherit"],
        detached: false,
      });

      child.on("error", (err) => {
        console.error(`Failed to start agent ${agentKey}:`, err);
        removePid(agentKey);
      });
      child.on("exit", (code) => {
        console.log(`Agent ${agentKey} exited with code ${code}`);
        removePid(agentKey);
      });

      if (child.pid) writePid(agentKey, child.pid);
      return NextResponse.json({ message: "Agent started", isRunning: true });
    }

    if (action === "stop") {
      killAgent(agentKey);
      return NextResponse.json({ message: "Agent stopped", isRunning: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error managing agent process:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
