import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listProviderConfigs,
  createProviderConfig,
  verifyToken,
  type ProviderType,
} from "@/lib/firebase/providerConfigs";

async function getUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

// GET /api/provider-configs?provider=google
export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider") as
    | ProviderType
    | undefined;

  const configs = await listProviderConfigs(uid, provider ?? undefined);
  // Never expose the raw apiKey to the client
  return NextResponse.json(
    configs.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ apiKey: _apiKey, ...rest }) => rest,
    ),
  );
}

const CreateSchema = z.object({
  provider: z.enum(["google", "openai", "elevenlabs", "cartesia", "deepgram"]),
  label: z.string().min(1).max(80),
  apiKey: z.string().min(1).max(500),
});

// POST /api/provider-configs
export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join("; ") },
      { status: 400 },
    );
  }

  const config = await createProviderConfig(uid, parsed.data);
  const { apiKey: _apiKey, ...safe } = config; // eslint-disable-line @typescript-eslint/no-unused-vars
  return NextResponse.json(safe, { status: 201 });
}
