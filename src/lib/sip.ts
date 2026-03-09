import {
  SipClient,
  SIPOutboundTrunkInfo,
  SIPDispatchRuleInfo,
} from "livekit-server-sdk";

const sipClient = new SipClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
);

/**
 * Creates an outbound SIP trunk for Twilio in LiveKit
 */
export async function createOutboundTrunk(): Promise<SIPOutboundTrunkInfo> {
  const twilioTerminationUri = process.env.TWILIO_SIP_URI;
  const username = process.env.TWILIO_SIP_USERNAME;
  const password = process.env.TWILIO_SIP_PASSWORD;

  if (!twilioTerminationUri || !username || !password) {
    throw new Error("Missing Twilio SIP credentials in environment variables.");
  }

  // Create or update the SIP trunk
  const trunk = await sipClient.createSipOutboundTrunk(
    "twilio-outbound",
    twilioTerminationUri, // Twilio SIP URI
    [process.env.TWILIO_PHONE_NUMBER!], // LiveKit requires at least one number mapped
    {
      authUsername: username,
      authPassword: password,
      transport: 1, // SIPTransport.SIP_TRANSPORT_TCP
    },
  );

  return trunk;
}

/**
 * Creates a dispatch rule for outbound calls in LiveKit
 */
export async function createSipDispatchRule(): Promise<SIPDispatchRuleInfo> {
  const rule = await sipClient.createSipDispatchRule({
    name: "outbound-dispatch",
    hidePhoneNumber: false,
    metadata: JSON.stringify({
      agentName: "outbound-caller", // Adjust to match agent worker configuration
    }),
    rule: {
      dispatchRuleIndividual: {
        roomPrefix: "outbound-",
      },
    },
  } as any);

  return rule;
}
