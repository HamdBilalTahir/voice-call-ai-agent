# Voice Call AI Agent — Architecture

> Deep-dive architecture document covering the full system: telephony, LiveKit, AI voice pipeline, Firestore data model, authentication, and provider config.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Authentication & User Config](#4-authentication--user-config)
5. [Firestore Data Model](#5-firestore-data-model)
6. [Agent Registry & Dynamic Agents](#6-agent-registry--dynamic-agents)
7. [LiveKit Integration](#7-livekit-integration)
8. [Twilio / SIP Telephony](#8-twilio--sip-telephony)
9. [Call Flows](#9-call-flows)
10. [AI Voice Pipeline (Runtime)](#10-ai-voice-pipeline-runtime)
11. [Provider Config System](#11-provider-config-system)
12. [API Topology](#12-api-topology)
13. [Environment Variable Reference](#13-environment-variable-reference)

---

## 1. System Overview

Voice Call AI Agent is a platform for building and running AI voice agents at production scale. It handles:

- **Inbound calls** — callers dial a Twilio phone number → SIP → LiveKit → AI agent answers
- **Outbound calls** — the platform dials a target number via Twilio SIP → AI agent speaks
- **Browser playground** — WebRTC-based browser-to-agent calls, no phone required

The architecture has three main processes:

| Process              | Role                                 | Runtime                         |
| -------------------- | ------------------------------------ | ------------------------------- |
| Next.js app          | UI + control-plane API               | Node.js (serverless-compatible) |
| LiveKit agent worker | Real-time voice AI (STT → LLM → TTS) | Long-running Node.js process    |
| Firebase Firestore   | Config + call history persistence    | Managed cloud DB                |

---

## 2. Technology Stack

### Frontend

| Layer             | Technology                | Version |
| ----------------- | ------------------------- | ------- |
| Framework         | Next.js (App Router)      | 15.2.0  |
| Language          | TypeScript                | 5.x     |
| Styling           | Tailwind CSS              | 4.x     |
| Component Library | Radix UI / custom         | —       |
| WebRTC Client     | @livekit/components-react | 2.6.9   |
| Icons             | Lucide React              | —       |

### AI / Voice

| Layer               | Technology                        | Version |
| ------------------- | --------------------------------- | ------- |
| Agent framework     | @livekit/agents                   | 1.4.3   |
| LLM — Google Gemini | @livekit/agents-plugin-google     | 1.4.3   |
| LLM — OpenAI        | @livekit/agents-plugin-openai     | 1.4.4   |
| TTS — ElevenLabs    | @livekit/agents-plugin-elevenlabs | 1.4.3   |
| TTS — Cartesia      | @livekit/agents-plugin-cartesia   | 1.4.3   |
| STT — Deepgram      | @livekit/agents-plugin-deepgram   | 1.4.3   |
| VAD                 | @livekit/agents-plugin-silero     | 1.4.3   |
| WebRTC transport    | @livekit/rtc-node                 | 0.13.24 |

### Backend / Infrastructure

| Layer           | Technology                  | Notes                                             |
| --------------- | --------------------------- | ------------------------------------------------- |
| Database        | Firebase Firestore          | Agent config, call history, API key vault         |
| Auth            | Firebase Auth               | Google + email/password                           |
| SIP trunking    | Twilio Elastic SIP Trunking | PSTN ↔ LiveKit bridge                             |
| Real-time audio | LiveKit Cloud               | Rooms, SIP gateway, agent dispatch                |
| Server SDK      | livekit-server-sdk          | SipClient, AgentDispatchClient, RoomServiceClient |
| Validation      | Zod                         | All API route input validation                    |

---

## 3. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                           │
│                                                                    │
│  Next.js UI (App Router) · React 18 · Tailwind CSS                │
│  Firebase Auth client  ·  LiveKit React WebRTC components         │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS / WebSocket
┌──────────────────────────────▼─────────────────────────────────────┐
│                   NEXT.JS CONTROL PLANE (API routes)               │
│                                                                    │
│  /api/livekit/token    — issue LiveKit JWT for browser clients     │
│  /api/agents/*         — agent CRUD, compiled-prompt preview       │
│  /api/calls/test       — dispatch agent to browser room            │
│  /api/calls/inbound    — triggered by LiveKit webhook on SIP in    │
│  /api/calls/outbound   — trigger Twilio SIP outbound call          │
│  /api/sip/*/setup      — provision LiveKit SIP trunks + rules      │
│  /api/provider-configs — user API key vault (CRUD)                 │
└────────────────┬──────────────────────────────┬────────────────────┘
                 │ livekit-server-sdk             │ firebase-admin
     ┌───────────▼──────────┐         ┌──────────▼───────────────┐
     │    LIVEKIT CLOUD      │         │   FIREBASE (Firestore)   │
     │                      │         │                          │
     │  WebRTC Rooms        │         │  agents/                 │
     │  SIP Inbound Trunks  │         │  callHistory/            │
     │  SIP Outbound Trunks │         │  userProfile/            │
     │  Dispatch Rules      │         │    {uid}/providerConfigs │
     │  Agent Dispatch      │         └──────────────────────────┘
     └──────────┬───────────┘
                │ LiveKit agent protocol
     ┌──────────▼───────────────────────────────────────────────┐
     │              AI AGENT WORKER  (Node.js process)          │
     │                                                          │
     │  makeAgentEntry() / defineAgent()                        │
     │  ├─ STT: Deepgram nova-3 (or per-agent key/model)       │
     │  ├─ LLM: Gemini 2.0 Flash / GPT-4o (per-agent config)  │
     │  └─ TTS: ElevenLabs sonic-3 / Cartesia (per-agent)      │
     └──────────────────────────────────────────────────────────┘
                │                         │
    ┌───────────▼──────────┐   ┌──────────▼──────────────────┐
    │     TWILIO PSTN       │   │  DEEPGRAM / ELEVENLABS /    │
    │  Elastic SIP Trunking │   │  CARTESIA / GEMINI / OPENAI │
    │  Phone numbers        │   │  (external AI APIs)         │
    └──────────────────────┘   └─────────────────────────────┘
```

---

## 4. Authentication & User Config

### Firebase Auth

Sign-in happens at `/login` via the Firebase client SDK. Two methods supported:

- **Google OAuth** (via `signInWithPopup`)
- **Email + Password** (`signInWithEmailAndPassword` / `createUserWithEmailAndPassword`)

The `AuthContext` (`src/contexts/AuthContext.tsx`) exposes `useAuth()` throughout the client app, providing `{ user: User | null, loading: boolean }`.

```
Browser  →  /login  →  Firebase Auth  →  AuthContext  →  user.uid
```

### Authenticated API calls

Client components that call protected API routes attach a Firebase ID token:

```typescript
const token = await getIdToken(); // auth.currentUser.getIdToken()
fetch("/api/provider-configs", {
  headers: { Authorization: `Bearer ${token}` },
});
```

Server-side routes verify the token with Firebase Admin:

```typescript
const decoded = await getAuth(adminApp).verifyIdToken(token);
const uid = decoded.uid;
```

---

## 5. Firestore Data Model

### `agents/{agentKey}`

The primary config document for each agent. Fields:

| Field                     | Type                        | Notes                                           |
| ------------------------- | --------------------------- | ----------------------------------------------- |
| `name`                    | string                      | Display name                                    |
| `description`             | string                      |                                                 |
| `isDynamic`               | boolean                     | true = created via UI, no code file             |
| `direction`               | `"inbound"` \| `"outbound"` | Read-only after creation                        |
| `dispatchRuleName`        | string                      | LiveKit dispatch rule identifier                |
| `phoneNumber`             | string                      | E.164 number associated with this agent         |
| `voiceEnabled`            | boolean                     | Live / paused toggle                            |
| `roleAndResponsibilities` | string                      | LLM instruction field 1                         |
| `personaLanguageAndTone`  | string                      | LLM instruction field 2                         |
| `mistakesToAvoid`         | string                      | LLM instruction field 3                         |
| `additionalInstructions`  | string                      | LLM instruction field 4                         |
| `voiceGreeting`           | string                      | First thing the agent says                      |
| `voiceSettings`           | object                      | See below                                       |
| `ownerUid`                | string                      | Firebase UID of the user who last configured it |
| `updatedAt`               | Timestamp                   | Used for optimistic concurrency control         |
| `updatedBy`               | string                      | UID of last editor                              |
| `updatedByName`           | string                      | Display name of last editor                     |

**`voiceSettings` sub-object:**

| Field         | Type                           | Default              | Notes                          |
| ------------- | ------------------------------ | -------------------- | ------------------------------ |
| `callType`    | `"inbound"` \| `"outbound"`    | —                    | Read-only                      |
| `language`    | string                         | `"en-US"`            | Agent's spoken language        |
| `sttLanguage` | string                         | `"multi"`            | STT language hint              |
| `llmProvider` | `"google"` \| `"openai"`       | `"google"`           |                                |
| `llmModel`    | string                         | `"gemini-2.0-flash"` |                                |
| `llmConfigId` | string                         | —                    | Refs `providerConfigs` doc     |
| `ttsProvider` | `"elevenlabs"` \| `"cartesia"` | `"elevenlabs"`       |                                |
| `ttsModel`    | string                         | `"sonic-3"`          |                                |
| `ttsConfigId` | string                         | —                    | Refs `providerConfigs` doc     |
| `ttsVoiceId`  | string                         | —                    | Provider-specific voice UUID   |
| `voiceType`   | string                         | `"female-1"`         | Used to pick a default voiceId |
| `sttProvider` | `"deepgram"`                   | `"deepgram"`         |                                |
| `sttModel`    | string                         | `"nova-3"`           |                                |
| `sttConfigId` | string                         | —                    | Refs `providerConfigs` doc     |

### `callHistory/{roomName}`

One document per call session. Contains status, direction, transcript, token usage, agent key, and outcome/sentiment (populated post-call by the webhook).

### `userProfile/{uid}/providerConfigs/{configId}`

API key vault, scoped per authenticated user. Fields:

| Field       | Type      | Notes                                                                      |
| ----------- | --------- | -------------------------------------------------------------------------- |
| `uid`       | string    | Owner's Firebase UID                                                       |
| `provider`  | string    | `"google"` \| `"openai"` \| `"elevenlabs"` \| `"cartesia"` \| `"deepgram"` |
| `label`     | string    | User-defined display name (e.g., "Production")                             |
| `apiKey`    | string    | Raw API key — never sent to the browser                                    |
| `maskedKey` | string    | Display-safe mask, e.g. `"sk-p...bc12"`                                    |
| `createdAt` | Timestamp |                                                                            |
| `updatedAt` | Timestamp |                                                                            |

---

## 6. Agent Registry & Dynamic Agents

### Static agents

Defined in `src/lib/agents/registry.ts`. Each entry has a `key`, `direction`, `dispatchRuleName`, `phoneNumber`, and `language`. Their prompt content lives in per-agent `prompt.ts` files on disk.

Currently registered:

- `restaurant-es` — inbound, Spanish restaurant ordering
- `sales-en` — outbound, English sales

### Dynamic agents

Created at runtime via the UI (`POST /api/agents`). Stored entirely in Firestore with `isDynamic: true`. They inherit the same dispatch rule as the equivalent static agent of the same direction, but their instructions, voice settings, and provider configs are all managed from the UI.

Both types converge at `getAgent(agentKey)` which merges the static registry config (if present) with Firestore overrides into a single `AgentFullData` object used everywhere downstream.

---

## 7. LiveKit Integration

### SDK version

`@livekit/agents` **1.4.3** and `livekit-server-sdk` (latest). The server SDK provides `SipClient`, `AgentDispatchClient`, and `RoomServiceClient` used from the Next.js API routes.

### Rooms

Each call gets a unique room name: `{agentKey}-{toNumber}-{timestamp}` for outbound, `{agentKey}-{timestamp}` for inbound, `browser-{timestamp}` for playground sessions.

### Agent dispatch

The `AgentDispatchClient.createDispatch(roomName, dispatchRuleName, { metadata })` call tells LiveKit which agent worker should join the room. The `dispatchRuleName` must match a dispatch rule already registered in LiveKit Cloud.

**Dispatch metadata** is a JSON string passed to the worker at startup. It carries the full resolved configuration so the worker needs no Firestore access at runtime:

```json
{
  "systemPrompt": "...",
  "voiceGreeting": "Hi, how can I help?",
  "llmProvider": "openai",
  "llmModel": "gpt-4o",
  "llmApiKey": "<resolved from providerConfigs>",
  "ttsProvider": "elevenlabs",
  "ttsModel": "sonic-3",
  "ttsApiKey": "<resolved from providerConfigs>",
  "ttsVoiceId": "JBFqnCBsd6RMkjVDRZzb",
  "sttModel": "nova-3",
  "sttLanguage": "multi"
}
```

### Webhook

LiveKit posts call lifecycle events to `POST /api/agent`. The webhook secret is verified against `LIVEKIT_WEBHOOK_SECRET` (falls back to `LIVEKIT_API_SECRET`). Register the webhook URL in **LiveKit Cloud → Settings → Webhooks**.

### Token generation

`POST /api/livekit/token` issues short-lived JWTs for browser clients to join rooms. Accepts `roomName`, `participantName`, `participantIdentity`, and optional `metadata`. Signed with `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET`.

---

## 8. Twilio / SIP Telephony

### Architecture

```
PSTN caller
    │  standard phone call
    ▼
Twilio phone number
    │  SIP INVITE (Elastic SIP Trunking)
    ▼
LiveKit SIP server  (inbound trunk)
    │  creates LiveKit room + dispatches agent
    ▼
LiveKit room  ←→  AI agent worker
```

For outbound:

```
Next.js  →  POST /api/calls/outbound
    │
    ├─ sipClient.createSipParticipant(trunkId, toNumber, roomName)
    │      LiveKit SIP dials out via Twilio trunk
    │
    └─ agentDispatchClient.createDispatch(roomName, dispatchRule, metadata)
           Agent worker joins room and greets when SIP call connects
```

### Twilio Elastic SIP Trunking setup

1. Create a trunk in **Twilio Console → Elastic SIP Trunking → Trunks**.
2. Under **Termination**, set the SIP URI — this becomes `TWILIO_SIP_TERMINATION_URI`.
3. Set digest auth credentials — these become `TWILIO_SIP_USERNAME` + `TWILIO_SIP_PASSWORD`.
4. Under **Origination**, add a LiveKit SIP endpoint URI (shown in LiveKit Cloud → SIP).
5. Associate your Twilio phone number with the trunk.

### Provisioning via API

`POST /api/sip/outbound/setup` automates trunk + dispatch rule creation in LiveKit:

```
createOutboundTrunk()
  └─ sipClient.createSipOutboundTrunk(
       "twilio-outbound",
       TWILIO_SIP_TERMINATION_URI,
       [TWILIO_PHONE_NUMBER],
       { authUsername, authPassword, transport: TCP }
     )

createSipDispatchRule()
  └─ sipClient.createSipDispatchRule({
       name: "outbound-dispatch",
       rule: { dispatchRuleIndividual: { roomPrefix: "outbound-" } }
     })
```

Save the returned `sipTrunkId` as `LIVEKIT_SIP_TRUNK_ID` in your environment.

---

## 9. Call Flows

### Browser playground (test call)

```
1. User clicks "Test" in the UI
2. Browser calls POST /api/livekit/token → gets JWT + LiveKit URL
3. Browser connects to LiveKit room via WebRTC (@livekit/components-react)
4. Browser calls POST /api/calls/test { agentKey, roomName }
5. Server calls getAgent(agentKey) → resolveProviderKeys(agentData)
6. Server calls AgentDispatchClient.createDispatch(roomName, dispatchRule, { metadata })
7. Agent worker receives dispatch event, connects to room
8. Worker builds STT/LLM/TTS pipeline from dispatch metadata
9. Worker calls session.say(voiceGreeting) → conversation begins
```

### Inbound phone call

```
1. External caller dials Twilio number
2. Twilio forwards call as SIP INVITE to LiveKit SIP server
3. LiveKit SIP creates a room, adds SIP participant
4. LiveKit fires webhook → POST /api/agent (or /api/calls/inbound)
5. Server identifies agent from called number + dispatch rules
6. Server calls AgentDispatchClient.createDispatch(roomName, dispatchRule, { metadata })
7. Agent worker joins room, greets caller
```

### Outbound phone call

```
1. POST /api/calls/outbound { toNumber, agentKey } (requires INTERNAL_API_SECRET)
2. Server validates SIP trunk availability (falls back to auto-detect)
3. Server calls sipClient.createSipParticipant(trunkId, toNumber, roomName)
   → LiveKit instructs Twilio to dial toNumber
4. Server calls getAgent(agentKey) → resolveProviderKeys() → buildDispatchMetadata()
5. Server calls AgentDispatchClient.createDispatch(roomName, dispatchRule, { metadata })
6. When SIP call connects, agent worker joins room and says voiceGreeting
7. Call is logged to callHistory/{roomName}
```

---

## 10. AI Voice Pipeline (Runtime)

The agent worker is built with `makeAgentEntry()` from `src/lib/agents/genericEntry.ts`. On each dispatch:

```
ctx.job.metadata (JSON)
    │
    ▼
Parse DispatchMeta
    ├─ systemPrompt, voiceGreeting
    ├─ llmProvider, llmModel, llmApiKey
    ├─ ttsProvider, ttsModel, ttsApiKey, ttsVoiceId
    └─ sttModel, sttApiKey, sttLanguage
    │
    ▼
Build voice.AgentSession
    ├─ STT:  Deepgram.STT({ model, language, apiKey })
    ├─ LLM:  Google.LLM({ model, apiKey })     — if llmProvider == "google"
    │        OpenAI.LLM({ model, apiKey })     — if llmProvider == "openai"
    └─ TTS:  ElevenLabs.TTS({ model, voiceId, apiKey })  — if ttsProvider == "elevenlabs"
             Cartesia.TTS({ model, voice, apiKey })      — if ttsProvider == "cartesia"
    │
    ▼
session.start({ agent: new voice.Agent({ instructions }), room })
    │
    ▼
session.say(voiceGreeting)   ← caller hears the first line
    │
    ▼
Continuous VAD → STT → LLM → TTS loop
    │
    ▼
On close: write usage to .agent-usage/{roomName}.json
```

API keys fall back to environment variables if not present in dispatch metadata:

| Metadata key | Env fallback                              |
| ------------ | ----------------------------------------- |
| `llmApiKey`  | `GEMINI_API_KEY` / `OPENAI_API_KEY`       |
| `ttsApiKey`  | `ELEVENLABS_API_KEY` / `CARTESIA_API_KEY` |
| `sttApiKey`  | `DEEPGRAM_API_KEY`                        |

---

## 11. Provider Config System

### Storage

API keys are stored per-user in `userProfile/{uid}/providerConfigs/{configId}`. The raw key is written to Firestore by the server but **never returned to the browser** — only the `maskedKey` (e.g. `"sk-p...bc12"`) is exposed in API responses.

### Flow: saving a new key

```
User enters key in VoiceBehaviorTab
    │
    ▼
POST /api/provider-configs  { provider, label, apiKey }
    Bearer: <Firebase ID token>
    │
    ▼
Server verifies token → gets uid
    │
    ▼
createProviderConfig(uid, { provider, label, apiKey })
  └─ writes to userProfile/{uid}/providerConfigs/{auto-id}
    │
    ▼
Returns { id, provider, label, maskedKey }  (no raw key)
    │
    ▼
VoiceBehaviorTab updates form.llmConfigId = id
```

### Flow: key resolution at call dispatch

```
POST /api/calls/test  or  /api/calls/outbound
    │
    ▼
getAgent(agentKey)  →  AgentFullData { ownerUid, voiceSettings: { llmConfigId, ... } }
    │
    ▼
resolveProviderKeys(agentData)
  └─ getProviderConfig(uid, llmConfigId)  → { apiKey: "sk-..." }
  └─ getProviderConfig(uid, ttsConfigId)  → { apiKey: "..." }
  └─ getProviderConfig(uid, sttConfigId)  → { apiKey: "..." }
    │
    ▼
buildDispatchMetadata(agentData, {}, { llmApiKey, ttsApiKey, sttApiKey })
    │
    ▼
AgentDispatchClient.createDispatch(roomName, rule, { metadata: JSON })
    │
    ▼
Worker reads keys from metadata → no Firestore access needed at runtime
```

---

## 12. API Topology

| Route                               | Method | Auth            | Description                                      |
| ----------------------------------- | ------ | --------------- | ------------------------------------------------ |
| `/api/agents`                       | GET    | —               | List all agents (registry + Firestore)           |
| `/api/agents`                       | POST   | —               | Create a new dynamic agent                       |
| `/api/agents/[key]`                 | GET    | —               | Get a single agent (merged)                      |
| `/api/agents/[key]`                 | PATCH  | —               | Update agent config (Tier-1 fields only)         |
| `/api/agents/[key]/compiled-prompt` | GET    | —               | Preview assembled system prompt                  |
| `/api/provider-configs`             | GET    | Firebase token  | List user's saved API keys                       |
| `/api/provider-configs`             | POST   | Firebase token  | Save a new API key                               |
| `/api/provider-configs/[id]`        | DELETE | Firebase token  | Remove a saved key                               |
| `/api/livekit/token`                | POST   | —               | Generate LiveKit JWT for browser                 |
| `/api/calls/test`                   | POST   | —               | Dispatch agent to browser playground room        |
| `/api/calls/inbound`                | POST   | API secret      | Dispatch agent for inbound SIP call              |
| `/api/calls/outbound`               | POST   | Internal secret | Trigger outbound SIP call + agent                |
| `/api/sip/inbound/setup`            | POST   | —               | Provision LiveKit inbound SIP trunk              |
| `/api/sip/outbound/setup`           | POST   | —               | Provision LiveKit outbound trunk + dispatch rule |

---

## 13. Environment Variable Reference

| Variable                                   | Required       | Description                                                           |
| ------------------------------------------ | -------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Yes            | Firebase client SDK                                                   |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Yes            | Firebase client SDK                                                   |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Yes            | Firebase client SDK                                                   |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Yes            | Firebase client SDK                                                   |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes            | Firebase client SDK                                                   |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Yes            | Firebase client SDK                                                   |
| `FIREBASE_CLIENT_EMAIL`                    | Yes            | Firebase Admin SDK (service account)                                  |
| `FIREBASE_PRIVATE_KEY`                     | Yes            | Firebase Admin SDK (service account)                                  |
| `LIVEKIT_URL`                              | Yes            | `wss://your-project.livekit.cloud`                                    |
| `LIVEKIT_API_KEY`                          | Yes            | LiveKit Cloud key                                                     |
| `LIVEKIT_API_SECRET`                       | Yes            | LiveKit Cloud secret                                                  |
| `LIVEKIT_WEBHOOK_SECRET`                   | Recommended    | Verifies LiveKit webhook payloads                                     |
| `LIVEKIT_SIP_TRUNK_ID`                     | Yes (outbound) | Set after running `/api/sip/outbound/setup`                           |
| `TWILIO_ACCOUNT_SID`                       | Yes            | Twilio account                                                        |
| `TWILIO_AUTH_TOKEN`                        | Yes            | Twilio account                                                        |
| `TWILIO_PHONE_NUMBER`                      | Yes            | E.164 number (e.g. `+14155550100`)                                    |
| `TWILIO_SIP_TERMINATION_URI`               | Yes            | Elastic SIP trunk termination domain                                  |
| `TWILIO_SIP_USERNAME`                      | Yes            | SIP trunk digest auth username                                        |
| `TWILIO_SIP_PASSWORD`                      | Yes            | SIP trunk digest auth password                                        |
| `GEMINI_API_KEY`                           | Yes            | Google AI Studio — global LLM fallback                                |
| `ELEVENLABS_API_KEY`                       | Yes            | ElevenLabs — global TTS fallback                                      |
| `DEEPGRAM_API_KEY`                         | Yes            | Deepgram — global STT fallback                                        |
| `OPENAI_API_KEY`                           | Optional       | OpenAI — fallback if OpenAI provider selected                         |
| `CARTESIA_API_KEY`                         | Optional       | Cartesia — fallback if Cartesia provider selected                     |
| `INTERNAL_API_SECRET`                      | Yes            | Shared secret for internal server-to-server calls                     |
| `NEXT_PUBLIC_INTERNAL_API_SECRET`          | Yes            | Same value exposed to browser for playground                          |
| `AGENT_DISPATCH_RULE_SALES_EN`             | Yes            | LiveKit dispatch rule name for sales agent                            |
| `AGENT_DISPATCH_RULE_RESTAURANT_ES`        | Yes            | LiveKit dispatch rule name for restaurant agent                       |
| `AGENT_NUMBER_SALES_EN`                    | Optional       | Phone number for the sales agent                                      |
| `AGENT_NUMBER_RESTAURANT_ES`               | Optional       | Phone number for the restaurant agent                                 |
| `NODE_ENV`                                 | —              | `development` or `production`                                         |
| `STT_PROVIDER`                             | Optional       | Set to `"inference"` to use LiveKit inference STT instead of Deepgram |
