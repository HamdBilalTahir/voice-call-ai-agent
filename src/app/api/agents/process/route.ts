import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { agents } from "@/lib/agents/registry";
import { getDb } from "@/lib/firebase/admin";

const PID_DIR = path.join(process.cwd(), ".agent-pids");

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
    // already gone
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
        // already dead
      }
    }
  }
  removePid(agentKey);
}

// Returns the effective agent direction — falls back to Firestore for dynamic agents
async function resolveDirection(
  agentKey: string,
): Promise<"inbound" | "outbound" | null> {
  if (agents[agentKey]) return agents[agentKey].direction;
  try {
    const snap = await getDb().collection("agents").doc(agentKey).get();
    if (!snap.exists || !snap.data()?.isDynamic) return null;
    return (snap.data()?.direction as "inbound" | "outbound") ?? "outbound";
  } catch {
    return null;
  }
}

// For dynamic agents: use the closest static template worker
function templateWorkerKey(direction: "inbound" | "outbound"): string {
  return direction === "inbound" ? "restaurant-es" : "sales-en";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentKey = searchParams.get("agentKey");
  if (!agentKey)
    return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

  const direction = await resolveDirection(agentKey);
  if (!direction)
    return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

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

    const direction = await resolveDirection(agentKey);
    if (!direction)
      return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });

    if (action === "start") {
      killAgent(agentKey);

      // Dynamic agents reuse the nearest static template worker
      const workerKey = agents[agentKey]
        ? agentKey
        : templateWorkerKey(direction);
      const scriptPath = path.join(
        process.cwd(),
        "src",
        "lib",
        "agents",
        direction,
        workerKey,
        "agent.ts",
      );

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

      const child = spawn("npx", ["--yes", "tsx", scriptPath, "start"], {
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
