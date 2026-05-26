import { NextResponse } from "next/server";
import { z } from "zod";
import { listAgents, createAgent } from "@/lib/firebase/agents";
import { verifyToken } from "@/lib/firebase/providerConfigs";

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const uid = token ? ((await verifyToken(token)) ?? undefined) : undefined;
  const agents = await listAgents(uid);
  return NextResponse.json(agents);
}

const DIRECTION_MAP: Record<string, "inbound" | "outbound"> = {
  inbound: "inbound",
  outbound: "outbound",
  both: "outbound",
};

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  other: "en-US",
};

const CreateAgentBodySchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  description: z.string().optional(),
  whatItDoes: z.string().optional(),
  howItTalks: z.string().optional(),
  whatToAvoid: z.string().optional(),
  anythingElse: z.string().optional(),
  openingLine: z.string().optional(),
  purpose: z.string().optional(),
  industry: z.string().optional(),
  language: z.string().optional(),
  voiceSettings: z
    .object({
      useLiveApi: z.boolean().optional(),
      liveApiModel: z.string().min(1).max(100).optional(),
      liveApiVoice: z.string().min(1).max(100).optional(),
      liveApiConfigId: z.string().min(1).max(128).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const userId = token ? await verifyToken(token) : null;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = CreateAgentBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    }

    const {
      name,
      description,
      whatItDoes,
      howItTalks,
      whatToAvoid,
      anythingElse,
      openingLine,
      purpose,
      industry,
      language,
      voiceSettings,
    } = parsed.data;

    const direction = DIRECTION_MAP[purpose ?? ""] ?? "outbound";

    const result = await createAgent({
      name: name.trim(),
      direction,
      language: LANG_MAP[language ?? ""] ?? "en-US",
      // dispatchRuleName omitted — createAgent auto-generates it from the name slug
      description:
        description?.trim() || whatItDoes?.trim() || `${direction} agent`,
      roleAndResponsibilities: whatItDoes?.trim() ?? "",
      personaLanguageAndTone: howItTalks?.trim() ?? "",
      mistakesToAvoid: whatToAvoid?.trim() ?? "",
      additionalInstructions: anythingElse?.trim() ?? "",
      voiceGreeting: openingLine?.trim() ?? "",
      industry: industry ?? "other",
      userId,
      ...voiceSettings,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ key: result.key, name: name.trim() });
  } catch (err) {
    console.error("[POST /api/agents] failed:", err);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 },
    );
  }
}
