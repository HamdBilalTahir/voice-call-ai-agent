/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { SipClient, AgentDispatchClient } from "livekit-server-sdk";
import { getAgent } from "@/lib/firebase/agents";
import { buildDispatchMetadata } from "@/lib/agents/promptBuilder";
import { enrichSystemPrompt } from "@/lib/agents/dispatchEnricher";
import { resolveProviderKeys } from "@/lib/firebase/resolveProviderKeys";
import { ensureWorker } from "@/lib/agents/workerManager";

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
    console.log("[outbound] POST handler entered");

    // 1. Verify internal API secret
    const authHeader = req.headers.get("authorization");
    if (
      !authHeader ||
      authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`
    ) {
      console.log("[outbound] auth failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[outbound] auth ok");

    // 2. Parse and validate request body
    const body = await req.json();
    const parsed = outboundCallSchema.safeParse(body);

    if (!parsed.success) {
      console.log("[outbound] validation failed", parsed.error.format());
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { toNumber, agentKey, isPlayground, testType } = parsed.data;
    console.log("[outbound] parsed body", {
      toNumber,
      agentKey,
      isPlayground,
      testType,
    });

    // 3. Verify env vars are set
    let sipTrunkId = process.env.LIVEKIT_SIP_TRUNK_ID;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    console.log("[outbound] env check", {
      hasSipTrunkId: !!sipTrunkId,
      hasTwilioNumber: !!twilioPhoneNumber,
    });

    if (!sipTrunkId) {
      // If not provided in .env, fetch the first available outbound trunk dynamically
      try {
        console.log("[outbound] fetching SIP trunks from LiveKit");
        const trunks = await sipClient.listSipOutboundTrunk();
        console.log("[outbound] SIP trunks fetched", { count: trunks?.length });
        if (trunks && trunks.length > 0) {
          sipTrunkId = trunks[0].sipTrunkId;
          console.log("[outbound] using trunk", sipTrunkId);
        } else {
          console.log("[outbound] no SIP trunks found");
          return NextResponse.json(
            {
              error:
                "No SIP Outbound Trunk found in LiveKit. Did you run the /api/sip/setup route first?",
            },
            { status: 500 },
          );
        }
      } catch (e) {
        console.error("[outbound] listSipOutboundTrunk threw", e);
        return NextResponse.json(
          { error: "Failed to fetch SIP Outbound Trunks from LiveKit." },
          { status: 500 },
        );
      }
    }

    if (!twilioPhoneNumber) {
      console.log("[outbound] missing TWILIO_PHONE_NUMBER");
      return NextResponse.json(
        {
          error: "Missing TWILIO_PHONE_NUMBER configuration",
        },
        { status: 500 },
      );
    }

    // 4. Resolve agent config — build dispatch metadata after call record is created
    //    so we can include the callHistoryId foreign key.
    let dispatchMetadata: string | undefined;
    let dispatchRule = "voice-agent";
    let pipelineMode: "cascading" | "live_api" = "cascading";
    let agentName: string | undefined;
    let agentData: Awaited<ReturnType<typeof getAgent>> | undefined;
    if (agentKey) {
      console.log("[outbound] calling getAgent", agentKey);
      try {
        agentData = (await getAgent(agentKey)) ?? undefined;
        console.log("[outbound] getAgent result", {
          found: !!agentData,
          name: agentData?.name,
          dispatchRuleName: agentData?.dispatchRuleName,
          isDynamic: (agentData as any)?.isDynamic,
          useLiveApi: agentData?.voiceSettings?.useLiveApi,
          liveApiModel: agentData?.voiceSettings?.liveApiModel,
          liveApiVoice: agentData?.voiceSettings?.liveApiVoice,
          liveApiConfigId: agentData?.voiceSettings?.liveApiConfigId,
          liveApiThinkingLevel: agentData?.voiceSettings?.liveApiThinkingLevel,
          userId: agentData?.userId,
        });
        if (agentData) {
          dispatchRule = agentData.dispatchRuleName || dispatchRule;
          agentName = agentData.name;
          pipelineMode = agentData.voiceSettings?.useLiveApi
            ? "live_api"
            : "cascading";
        }
      } catch (err) {
        console.error("[outbound] getAgent threw", err);
      }
    }
    console.log("[outbound] resolved", {
      dispatchRule,
      pipelineMode,
      agentName,
    });

    // 5. Generate unique room name using agent slug for readability
    const timestamp = Date.now();
    const agentSlug = agentName
      ? agentName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : (agentKey ?? "outbound");
    const roomName = `${agentSlug}-${toNumber}-${timestamp}`;
    const participantIdentity = `phone-${toNumber}`;
    console.log("[outbound] room", { roomName, participantIdentity });

    // 6. Write call record BEFORE creating the SIP participant so the webhook
    //    (room_started fires immediately) always finds an existing record.
    //    Capture the auto-generated Firestore doc ID to use as foreign key in callTranscripts.
    let callHistoryId: string | undefined;
    if (agentKey) {
      console.log("[outbound] writing call record");
      callHistoryId = await addCallRecord({
        id: roomName,
        roomName,
        agentKey,
        agentId: agentKey,
        phoneNumber: toNumber,
        startTime: timestamp,
        status: "in-progress",
        isPlayground: isPlayground ?? false,
        pipelineMode,
        ...(testType ? { testType } : {}),
        ...(isPlayground && testType === "phoneCall"
          ? { testNumber: toNumber }
          : {}),
      });
      console.log("[outbound] call record written", { callHistoryId });
    }

    // Build dispatch metadata now that we have callHistoryId
    if (agentKey && agentData) {
      console.log("[outbound] resolving provider keys");
      try {
        const [resolvedKeys, systemPrompt] = await Promise.all([
          resolveProviderKeys(agentData),
          enrichSystemPrompt(agentKey, agentData),
        ]);
        console.log("[outbound] provider keys resolved", {
          hasLiveApiKey: !!resolvedKeys.liveApiKey,
          hasLlmApiKey: !!resolvedKeys.llmApiKey,
          hasTtsApiKey: !!resolvedKeys.ttsApiKey,
          hasSttApiKey: !!resolvedKeys.sttApiKey,
        });
        dispatchMetadata = buildDispatchMetadata(
          agentData,
          {
            agentKey,
            callHistoryId,
            systemPrompt,
            sipParticipantIdentity: `phone-${toNumber}`,
          },
          resolvedKeys,
        );
        const parsedMeta = JSON.parse(dispatchMetadata);
        console.log("[outbound] dispatch metadata built", {
          useLiveApi: parsedMeta.useLiveApi,
          liveApiModel: parsedMeta.liveApiModel,
          liveApiVoice: parsedMeta.liveApiVoice,
          liveApiThinkingLevel: parsedMeta.liveApiThinkingLevel,
          hasLiveApiKey: !!parsedMeta.liveApiKey,
          hasSystemPrompt: !!parsedMeta.systemPrompt,
          systemPromptLen: parsedMeta.systemPrompt?.length,
          voiceGreeting: parsedMeta.voiceGreeting,
          sipParticipantIdentity: parsedMeta.sipParticipantIdentity,
          callHistoryId: parsedMeta.callHistoryId,
          agentKey: parsedMeta.agentKey,
        });
      } catch (err) {
        console.error("[outbound] build dispatch metadata threw", err);
      }
    } else {
      console.log("[outbound] skipping dispatch metadata", {
        agentKey: !!agentKey,
        agentData: !!agentData,
      });
    }

    // 7. Ensure a healthy persistent worker registered under the agent's dispatch
    //    rule is running BEFORE we ring the phone. Reuses an existing worker;
    //    spawns and waits for LiveKit registration only when none is ready. This
    //    guarantees the dispatch (step 9) lands on a worker that can accept it.
    if (agentKey) {
      console.log("[outbound] ensuring worker ready", { dispatchRule });
      try {
        const ensured = await ensureWorker(agentKey);
        console.log("[outbound] worker ready", ensured);
      } catch (err) {
        console.error("[outbound] worker failed to start", err);
        return NextResponse.json(
          { error: "Worker failed to start" },
          { status: 500 },
        );
      }
    }

    // 8. Create SIP participant (dispatch outbound call)
    console.log("[outbound] creating SIP participant", {
      sipTrunkId,
      toNumber,
      roomName,
      participantIdentity,
    });
    await sipClient.createSipParticipant(sipTrunkId, toNumber, roomName, {
      participantIdentity,
      playRingtone: true,
      // @ts-expect-error sipCallFrom is valid in newer versions or specific cases
      sipCallFrom: twilioPhoneNumber,
    });
    console.log("[outbound] SIP participant created");

    // 9. Dispatch the agent to the room so it joins and speaks
    console.log("[outbound] dispatching agent", {
      dispatchRule,
      hasMetadata: !!dispatchMetadata,
    });
    await agentDispatchClient.createDispatch(
      roomName,
      dispatchRule,
      dispatchMetadata ? { metadata: dispatchMetadata } : undefined,
    );
    console.log("[outbound] agent dispatched — done");

    return NextResponse.json({
      success: true,
      roomName,
      participantIdentity,
      message: "Call dispatched successfully",
    });
  } catch (error: any) {
    console.error("[outbound] unhandled error", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
