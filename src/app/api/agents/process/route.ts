import { NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import { agents } from "@/lib/agents/registry";
import path from "path";

// In-memory store for agent processes
const agentProcesses: Record<string, ChildProcess> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentKey = searchParams.get("agentKey");

  if (!agentKey || !agents[agentKey]) {
    return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });
  }

  const isRunning =
    !!agentProcesses[agentKey] && !agentProcesses[agentKey].killed;
  return NextResponse.json({ isRunning });
}

export async function POST(request: Request) {
  try {
    const { agentKey, action } = await request.json();

    if (!agentKey || !agents[agentKey]) {
      return NextResponse.json({ error: "Invalid agentKey" }, { status: 400 });
    }

    if (action === "start") {
      if (agentProcesses[agentKey] && !agentProcesses[agentKey].killed) {
        return NextResponse.json({
          message: "Agent is already running",
          isRunning: true,
        });
      }

      const agent = agents[agentKey];
      const scriptPath = path.join(
        process.cwd(),
        "src",
        "lib",
        "agents",
        agent.direction,
        agent.key,
        "agent.ts",
      );

      // Clean up npm_config_ environment variables to prevent npm warn messages
      const cleanEnv: Record<string, string> = {};
      for (const key in process.env) {
        if (
          !key.startsWith("npm_config_") &&
          !key.startsWith("npm_package_") &&
          process.env[key] !== undefined
        ) {
          cleanEnv[key] = process.env[key] as string;
        }
      }
      if (process.env.PATH) cleanEnv.PATH = process.env.PATH;

      // Spawn the process
      const child = spawn("npx", ["tsx", scriptPath, "start"], {
        cwd: process.cwd(),
        env: cleanEnv as NodeJS.ProcessEnv,
        stdio: "inherit", // Allows viewing agent logs directly in the Next.js console
        detached: false,
      }) as ChildProcess;

      child.on("error", (err) => {
        console.error(`Failed to start agent ${agentKey}:`, err);
      });

      child.on("exit", (code) => {
        console.log(`Agent ${agentKey} exited with code ${code}`);
        delete agentProcesses[agentKey];
      });

      agentProcesses[agentKey] = child;

      return NextResponse.json({ message: "Agent started", isRunning: true });
    } else if (action === "stop") {
      const child = agentProcesses[agentKey];
      if (child && !child.killed) {
        child.kill("SIGINT");
        delete agentProcesses[agentKey];
      }
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
