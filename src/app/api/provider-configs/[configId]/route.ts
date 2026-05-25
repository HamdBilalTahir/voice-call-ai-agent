import { NextRequest, NextResponse } from "next/server";
import {
  deleteProviderConfig,
  verifyToken,
} from "@/lib/firebase/providerConfigs";

type Params = Promise<{ configId: string }>;

async function getUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

// DELETE /api/provider-configs/[configId]
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const uid = await getUid(req);
  if (!uid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { configId } = await params;
  await deleteProviderConfig(uid, configId);
  return NextResponse.json({ ok: true });
}
