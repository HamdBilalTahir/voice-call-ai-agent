/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createOutboundTrunk, createSipDispatchRule } from "@/lib/sip";

export async function POST() {
  try {
    // Note: We recommend adding an authentication check here
    // e.g. checking an INTERNAL_API_SECRET
    const trunk = await createOutboundTrunk();
    const dispatchRule = await createSipDispatchRule();

    return NextResponse.json({
      success: true,
      message: "SIP outbound trunk and dispatch rule created successfully",
      trunkId: trunk.sipTrunkId,
      dispatchRuleId: dispatchRule.sipDispatchRuleId,
      instructions: `Please save the returned trunk ID to your .env.local file as LIVEKIT_SIP_TRUNK_ID=${trunk.sipTrunkId}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
