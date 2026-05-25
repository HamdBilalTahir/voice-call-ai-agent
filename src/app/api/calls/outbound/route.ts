/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { SipClient, AgentDispatchClient } from "livekit-server-sdk";
import { getAgent } from "@/lib/firebase/agents";
import { buildDispatchMetadata } from "@/lib/agents/promptBuilder";
import { resolveProviderKeys } from "@/lib/firebase/resolveProviderKeys";

const sipClient = new SipClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
);

const agentDispatchClient = new AgentDispatchClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
);

import { addCallRecord } from "@/lib/history";

const outboundCallSchema = z.object({
  toNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Must be a valid E.164 phone number"),
  agentKey: z.string().optional(),
  isPlayground: z.boolean().optional(),
  testType: z.enum(["widget", "phoneCall"]).optional(),
});

export async function POST(req: Request) {
  try {
    // 1. Verify internal API secret
    const authHeader = req.headers.get("authorization");
    if (
      !authHeader ||
      authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await req.json();
    const parsed = outboundCallSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { toNumber, agentKey, isPlayground, testType } = parsed.data;

    // 3. Verify env vars are set
    let sipTrunkId = process.env.LIVEKIT_SIP_TRUNK_ID;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!sipTrunkId) {
      // If not provided in .env, fetch the first available outbound trunk dynamically
      try {
        const trunks = await sipClient.listSipOutboundTrunk();
        if (trunks && trunks.length > 0) {
          sipTrunkId = trunks[0].sipTrunkId;
        } else {
          return NextResponse.json(
            {
              error:
                "No SIP Outbound Trunk found in LiveKit. Did you run the /api/sip/setup route first?",
            },
            { status: 500 },
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        return NextResponse.json(
          { error: "Failed to fetch SIP Outbound Trunks from LiveKit." },
          { status: 500 },
        );
      }
    }

    if (!twilioPhoneNumber) {
      return NextResponse.json(
        {
          error: "Missing TWILIO_PHONE_NUMBER configuration",
        },
        { status: 500 },
      );
    }

    // 4. Generate unique room name and participant identity
    const timestamp = Date.now();
    const prefix = agentKey ? `${agentKey}-` : "outbound-";
    const roomName = `${prefix}${toNumber}-${timestamp}`;
    const participantIdentity = `phone-${toNumber}`;

    // 5. Create SIP participant (dispatch outbound call)
    await sipClient.createSipParticipant(sipTrunkId, toNumber, roomName, {
      participantIdentity,
      playRingtone: true,
      // @ts-expect-error sipCallFrom is valid in newer versions or specific cases
      sipCallFrom: twilioPhoneNumber,
    });

    // 6. Dispatch the agent to the room so it joins and speaks
    let dispatchMetadata: string | undefined;
    let dispatchRule = "voice-agent";
    if (agentKey) {
      try {
        const agentData = await getAgent(agentKey);
        if (agentData) {
          dispatchRule = agentData.dispatchRuleName || dispatchRule;
          const resolvedKeys = await resolveProviderKeys(agentData);
          dispatchMetadata = buildDispatchMetadata(agentData, {}, resolvedKeys);
        }
      } catch (err) {
        console.error(
          "[calls/outbound] failed to build dispatch metadata:",
          err,
        );
      }
    }
    await agentDispatchClient.createDispatch(
      roomName,
      dispatchRule,
      dispatchMetadata ? { metadata: dispatchMetadata } : undefined,
    );

    // Add to history
    if (agentKey) {
      await addCallRecord({
        id: roomName,
        roomName,
        agentKey,
        agentId: agentKey,
        phoneNumber: toNumber,
        startTime: timestamp,
        status: "in-progress",
        isPlayground: isPlayground ?? false,
        ...(testType ? { testType } : {}),
        ...(isPlayground && testType === "phoneCall"
          ? { testNumber: toNumber }
          : {}),
      });
    }

    return NextResponse.json({
      success: true,
      roomName,
      participantIdentity,
      message: "Call dispatched successfully",
    });
  } catch (error: any) {
    console.error("Failed to create outbound call:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
