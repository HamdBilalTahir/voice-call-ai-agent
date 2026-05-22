import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  updateAgentConfig,
  setAgentLiveStatus,
  AgentWriteSchema,
} from "@/lib/firebase/agents";
import { z } from "zod";

type Params = Promise<{ agentKey: string }>;

// ─── GET /api/agents/[agentKey] ───────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { agentKey } = await params;
  const agent = await getAgent(agentKey);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

// ─── PATCH /api/agents/[agentKey] ────────────────────────────────────────────

const PatchBodySchema = z.object({
  payload: AgentWriteSchema,
  updatedBy: z.string().default("system"),
  updatedByName: z.string().default("App User"),
  updatedAt: z.number().optional(),
  force: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { agentKey } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join("; ") },
      { status: 400 },
    );
  }

  const { payload, updatedBy, updatedByName, updatedAt, force } = parsed.data;

  // If only voiceEnabled is being toggled, use the faster live-status path
  const keys = Object.keys(payload);
  if (
    keys.length === 1 &&
    keys[0] === "voiceEnabled" &&
    typeof payload.voiceEnabled === "boolean"
  ) {
    const result = await setAgentLiveStatus(agentKey, payload.voiceEnabled, {
      updatedBy,
      updatedByName,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  }

  const result = await updateAgentConfig(agentKey, payload, {
    updatedBy,
    updatedByName,
    clientUpdatedAt: updatedAt,
    force,
  });

  if (!result.ok) {
    if ("conflict" in result && result.conflict) {
      return NextResponse.json(result, { status: 409 });
    }
    const msg = "error" in result ? result.error : "Save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(result);
}
