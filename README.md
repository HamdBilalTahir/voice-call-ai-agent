# Voice Call AI Agent

A production-ready platform for building and operating AI-powered voice call agents — both inbound (answers calls) and outbound (makes calls). Agents are configured through a web UI, backed by Firestore, and run as LiveKit agent workers that bridge telephony (Twilio SIP) with real-time AI voice processing.

---

## Features

- **Inbound & outbound voice agents** — field incoming calls or dial out to numbers automatically
- **Browser playground** — test agents live in the browser without a phone, using WebRTC
- **Per-agent configuration** — instructions, persona, voice model, LLM, TTS, STT all editable from the UI
- **Multi-provider AI** — choose between Google Gemini or OpenAI for LLM; ElevenLabs or Cartesia for TTS; Deepgram for STT
- **Per-user API key vault** — save API keys in Firestore, select them per agent, inherit across agents
- **Firebase Auth** — Google sign-in or email/password; keys are scoped to the authenticated user
- **Dynamic agents** — create new agents from the UI without touching code
- **Call history** — every call is logged with transcript, usage, and outcome

---

## Prerequisites

| Service                   | Purpose                             | Notes                                        |
| ------------------------- | ----------------------------------- | -------------------------------------------- |
| **LiveKit Cloud**         | Real-time audio rooms + SIP gateway | Free tier available at livekit.io            |
| **Twilio**                | PSTN phone numbers + SIP trunking   | Needs a phone number and SIP termination URI |
| **Firebase**              | Auth + Firestore database           | Free Spark plan works                        |
| **Google Gemini**         | Default LLM                         | `gemini-2.0-flash` used by default           |
| **ElevenLabs**            | Default TTS                         | `sonic-3` model used by default              |
| **Deepgram**              | Default STT                         | `nova-3` model used by default               |
| **OpenAI** _(optional)_   | Alternative LLM                     | GPT-4o, GPT-4o-mini                          |
| **Cartesia** _(optional)_ | Alternative TTS                     | Sonic models                                 |
| Node.js ≥ 20              | Runtime                             | Required for the agent worker process        |

---

## Installation

```bash
git clone <repo-url>
cd voice-call-ai-agent
npm install
cp .env.example .env.local
# Fill in .env.local (see Environment Variables section below)
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in every value.

### Firebase

```env
# Client SDK — safe to expose to the browser (NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Admin SDK — server-side only, never expose to the browser
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Get these from **Firebase Console → Project Settings → Service Accounts** (Admin) and **Project Settings → General → Your apps** (Client).

### LiveKit

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Webhook secret — set in LiveKit Cloud dashboard under Settings → Webhooks
# Webhook URL to register: https://your-domain/api/agent
# Falls back to LIVEKIT_API_SECRET if not set
LIVEKIT_WEBHOOK_SECRET=

# Outbound SIP trunk ID — populated after running POST /api/sip/outbound/setup
LIVEKIT_SIP_TRUNK_ID=
```

Get `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` from **LiveKit Cloud → Settings → Keys**.

### Twilio

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX        # E.164 format, your purchased number

# SIP Termination URI — from Twilio Elastic SIP Trunking
# Format: your-domain.pstn.twilio.com
TWILIO_SIP_TERMINATION_URI=
TWILIO_SIP_USERNAME=
TWILIO_SIP_PASSWORD=
```

See [Twilio SIP Setup](#twilio-sip-setup) below for step-by-step instructions.

### AI Provider Keys (global fallback)

These are used when no per-agent API key is configured in the UI.

```env
GEMINI_API_KEY=          # Google AI Studio — console.cloud.google.com
ELEVENLABS_API_KEY=      # ElevenLabs dashboard
DEEPGRAM_API_KEY=        # Deepgram Console
OPENAI_API_KEY=          # Optional — platform.openai.com
CARTESIA_API_KEY=        # Optional — cartesia.ai
```

### Internal / Agent Config

```env
INTERNAL_API_SECRET=         # Random secret for internal API-to-API calls
NEXT_PUBLIC_INTERNAL_API_SECRET=  # Same value, exposed to the browser for playground calls

# Dispatch rule names registered in LiveKit (set after SIP setup)
AGENT_DISPATCH_RULE_SALES_EN=outbound-dispatch
AGENT_DISPATCH_RULE_RESTAURANT_ES=inbound-dispatch

# Phone numbers associated with each static agent (E.164)
AGENT_NUMBER_SALES_EN=
AGENT_NUMBER_RESTAURANT_ES=
```

---

## Running the App

### 1. Development server (Next.js)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/login`.

### 2. Agent worker process

The LiveKit agent worker runs as a **separate long-running Node.js process** alongside the Next.js app. It connects to LiveKit Cloud and waits for call dispatch events.

```bash
# Run the generic agent worker (handles all dynamic + static agents)
npx ts-node src/lib/agents/genericWorker.ts

# Or run a specific static agent
npx ts-node src/lib/agents/outbound/sales-en/agent.ts
npx ts-node src/lib/agents/inbound/restaurant-es/agent.ts
```

> **Important:** The worker process must be running before any call is dispatched. In production, run it as a persistent service (systemd, PM2, Docker container, Fly.io machine, etc.).

---

## LiveKit SIP Setup

After filling in environment variables, provision the SIP infrastructure with one API call:

### Outbound trunk + dispatch rule

```bash
curl -X POST https://your-domain/api/sip/outbound/setup \
  -H "Content-Type: application/json"
```

This creates a Twilio SIP outbound trunk and a LiveKit dispatch rule. Save the returned `trunkId` as `LIVEKIT_SIP_TRUNK_ID` in your `.env.local`.

### Inbound trunk

Configure your Twilio phone number to forward SIP to LiveKit's SIP endpoint (shown in **LiveKit Cloud → SIP → Inbound Trunks**). LiveKit will route the call via its dispatch rules to your inbound agent worker.

---

## Twilio SIP Setup

1. **Buy a phone number** in the [Twilio Console](https://console.twilio.com).
2. **Create an Elastic SIP Trunk**:
   - Go to **Elastic SIP Trunking → Trunks → Create**.
   - Under **Termination**, set the SIP URI (e.g., `your-domain.pstn.twilio.com`).
   - Set credentials (username + password) — these become `TWILIO_SIP_USERNAME` and `TWILIO_SIP_PASSWORD`.
3. **Add your phone number** to the trunk's **Origination** settings.
4. Set `TWILIO_SIP_TERMINATION_URI` to the trunk's termination URI.
5. Set `TWILIO_PHONE_NUMBER` to the purchased number in E.164 format (e.g., `+14155550100`).

---

## Provider Configuration (UI)

Once signed in, open any agent → **Voice & Behavior** tab:

- **LLM** — select provider (Google Gemini / OpenAI), choose a model, then pick a saved API key or add a new one. New keys are saved to your Firestore `providerConfigs` and are available to all agents.
- **TTS** — select provider (ElevenLabs / Cartesia), model, and API key.
- **STT** — select model (Deepgram Nova 3 / Nova 2) and API key.

If no API key is selected for a provider, the agent falls back to the global environment variable (e.g., `ELEVENLABS_API_KEY`).

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agents/            # Agent CRUD + compiled-prompt preview
│   │   ├── calls/
│   │   │   ├── inbound/       # Inbound call dispatch
│   │   │   ├── outbound/      # Outbound call trigger
│   │   │   └── test/          # Browser playground dispatch
│   │   ├── livekit/token/     # LiveKit JWT generation
│   │   ├── provider-configs/  # API key vault (CRUD)
│   │   └── sip/               # SIP trunk + dispatch rule provisioning
│   ├── agents/[direction]/[agentKey]/   # Agent detail page
│   ├── login/                 # Firebase Auth sign-in page
│   └── settings/profile/      # User profile
├── components/
│   ├── AgentClient.tsx        # Agent detail container (tabs)
│   ├── VoiceBehaviorTab.tsx   # Provider / model / API key UI
│   └── AIJobDescriptionTab.tsx # Instructions editor
├── contexts/
│   └── AuthContext.tsx        # Firebase Auth context + useAuth hook
├── lib/
│   ├── agents/
│   │   ├── registry.ts        # Static agent registry
│   │   ├── genericEntry.ts    # Agent worker factory (STT/LLM/TTS wiring)
│   │   ├── promptBuilder.ts   # System prompt assembly + dispatch metadata
│   │   ├── inbound/restaurant-es/
│   │   └── outbound/sales-en/
│   └── firebase/
│       ├── admin.ts           # Firebase Admin SDK init
│       ├── client.ts          # Firebase client SDK init
│       ├── agents.ts          # Agent Firestore CRUD + types
│       ├── providerConfigs.ts # API key vault Firestore layer
│       └── resolveProviderKeys.ts  # Fetch API keys at dispatch time
```

---

## Deploying

The Next.js app can be deployed to **Vercel** (zero-config) or any Node.js host.

The agent worker **cannot** run on Vercel (serverless). Deploy it separately as a persistent process — recommended options:

- **Fly.io** — `fly launch`, runs as a persistent VM
- **Railway / Render** — background worker service
- **Docker + ECS / Cloud Run** — for production scale

The worker needs the same environment variables as the Next.js app (LiveKit credentials + AI provider keys).
