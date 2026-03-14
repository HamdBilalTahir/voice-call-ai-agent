import "server-only";
import { AccessToken, WebhookReceiver } from "livekit-server-sdk";

export async function generateLiveKitToken(
  roomName: string,
  participantName: string,
  participantIdentity: string,
  metadata?: string,
) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET environment variables",
    );
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    metadata: metadata,
    ttl: "1h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return await at.toJwt();
}

export function verifyLiveKitWebhook(
  body: string,
  authorizationHeader: string,
) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret =
    process.env.LIVEKIT_WEBHOOK_SECRET || process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing LIVEKIT_API_KEY, LIVEKIT_WEBHOOK_SECRET, or LIVEKIT_API_SECRET environment variables",
    );
  }

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  return receiver.receive(body, authorizationHeader);
}
