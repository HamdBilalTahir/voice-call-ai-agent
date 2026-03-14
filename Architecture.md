# Voice Call AI Agent — Comprehensive System Architecture

> **Purpose**: Deep-dive architecture document based on full codebase analysis for the Voice Call AI Agent repository.

---

## Table of Contents

- [Voice Call AI Agent — Comprehensive System Architecture](#voice-call-ai-agent--comprehensive-system-architecture)
  - [Table of Contents](#table-of-contents)
  - [1. System Overview](#1-system-overview)
  - [2. Technology Stack (Current)](#2-technology-stack-current)
    - [Frontend](#frontend)
    - [AI / Voice](#ai--voice)
    - [Backend / Infrastructure](#backend--infrastructure)
  - [3. High-Level Architecture Diagram](#3-high-level-architecture-diagram)
  - [4. Backend API Topology](#4-backend-api-topology)
  - [5. Agent Routing \& Registry](#5-agent-routing--registry)
    - [Structure](#structure)
  - [6. LiveKit Voice Integration](#6-livekit-voice-integration)
    - [Flow:](#flow)
  - [7. SIP Telephony Integration](#7-sip-telephony-integration)
    - [Inbound Flow](#inbound-flow)
    - [Outbound Flow](#outbound-flow)
  - [8. Proposed Rebuild Architecture](#8-proposed-rebuild-architecture)

---

## 1. System Overview

Voice Call AI Agent is a platform designed to handle both **inbound** and **outbound** voice interactions using AI agents. It seamlessly bridges traditional telephony (via SIP) with modern web-based real-time communication (via LiveKit), powered by LLMs to drive intelligent, human-like conversations.

- **Inbound**: Handled by specific agents (e.g., `restaurant-es`) equipped to receive incoming SIP calls or web voice sessions, parse intent, and execute actions.
- **Outbound**: Handled by outbound agents (e.g., `sales-en`) designed to initiate calls, pitch products/services, and capture lead information.
- **Web Client**: Allows users to test and interact with the agents directly from their browsers using WebRTC.

---

## 2. Technology Stack (Current)

### Frontend

| Layer             | Technology                | Version |
| ----------------- | ------------------------- | ------- |
| Framework         | Next.js (App Router)      | 15.0.3  |
| Language          | TypeScript                | 5.x     |
| Styling           | Tailwind CSS              | 3.4.1   |
| Component Library | shadcn/ui (Radix UI)      | various |
| WebRTC Client     | @livekit/components-react | 2.6.8   |
| Icons             | Lucide React              | 0.460.0 |

### AI / Voice

| Layer              | Technology        | Version |
| ------------------ | ----------------- | ------- |
| AI Framework       | @livekit/agents   | 0.1.0   |
| Real-time Audio    | LiveKit Server    | 0.0.1   |
| OpenAI Integration | @livekit/rtc-node | 0.0.0   |

### Backend / Infrastructure

| Layer        | Technology              | Notes                                   |
| ------------ | ----------------------- | --------------------------------------- |
| SIP Trunking | LiveKit SIP integration | Inbound/Outbound setup via API          |
| Deployment   | Node.js / Vercel        | API routes for SIP and LiveKit dispatch |

---

## 3. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                                │
│  Next.js App Router ─ React 18 ─ LiveKit React Components ─ Tailwind     │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ WebRTC / WebSocket
┌────────────────────────────▼────────────────────────────────────────────┐
│                    NEXT.JS SERVERLESS API LAYER                          │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐  │
│  │  /api/livekit│  │/api/calls/   │  │/api/sip/setup │  │/api/agents│  │
│  │  (Token gen) │  │inbound &     │  │(SIP Trunk &   │  │(Registry &│  │
│  │              │  │outbound      │  │ Dispatch)     │  │ Config)   │  │
│  └──────────────┘  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘  │
└─────────────────────────  │  ─────────────── │ ────────────── │ ───────┘
                            │                  │                │
           ┌────────────────▼──────────────────▼────────────────▼──┐
           │                  LIVEKIT SERVER                       │
           │  - WebRTC Rooms                                       │
           │  - SIP Inbound/Outbound Trunks                        │
           │  - Audio Mixing & Routing                             │
           └────────────────────────┬──────────────────────────────┘
                                    │
           ┌────────────────────────▼──────────────────────────────┐
           │               AI AGENT WORKERS (Node.js)              │
           │  - listen to LiveKit Room                             │
           │  - Speech-To-Text (STT)                               │
           │  - LLM Processing (OpenAI)                            │
           │  - Text-To-Speech (TTS)                               │
           │  - Tool Calling                                       │
           └───────────────────────────────────────────────────────┘
```

---

## 4. Backend API Topology

The Next.js application serves as the control plane, exposing various REST endpoints to manage the agents, orchestrate calls, and provision infrastructure:

- **`/api/agents`**: Lists all available inbound and outbound agents from the registry.
- **`/api/agents/[agentKey]/prompt`**: Gets or updates the prompt configuration for a specific agent.
- **`/api/calls/inbound` & `/api/calls/outbound`**: Initiates or registers endpoints for inbound/outbound calls.
- **`/api/livekit/token`**: Generates access tokens for the frontend to connect to LiveKit rooms securely.
- **`/api/sip/inbound/setup` & `/api/sip/outbound/setup`**: Provisions SIP trunks, dispatch rules, and SIP participants on the LiveKit server.

---

## 5. Agent Routing & Registry

The system employs a centralized **Agent Registry** (`src/lib/agents/registry.ts`) that maps agent keys to their underlying configurations, prompts, and tool sets.

### Structure

Agents are categorized by direction (inbound vs. outbound) and domain/language:

- **Inbound**: `restaurant-es` (Spanish Restaurant ordering agent)
- **Outbound**: `sales-en` (English Sales agent)

Each agent directory contains:

- `agent.ts`: The main execution logic or configuration interface.
- `config.ts`: Metadata like name, default voice, LLM model, temperature.
- `prompt.ts`: The system prompt instructing the AI on its persona and guardrails.
- `tools.ts`: Definitions of functions the agent can call (e.g., checking availability, booking an appointment).

---

## 6. LiveKit Voice Integration

Real-time audio processing is offloaded to **LiveKit**.

### Flow:

1. **Room Creation**: A unique room is instantiated for each call.
2. **Token Generation**: Web clients or SIP participants get a LiveKit JWT to join the room.
3. **Agent Connection**: A Node.js worker running `@livekit/agents` connects to the room as a participant.
4. **VAD & Streaming**: The agent listens using Voice Activity Detection (VAD). Audio is streamed to STT, the text is fed into the LLM, and the response is streamed back via TTS.

---

## 7. SIP Telephony Integration

The platform bridges standard phone networks with the AI agents using LiveKit's SIP integration.

### Inbound Flow

- Users dial a standard phone number provided by a SIP trunk provider (e.g., Twilio).
- The SIP provider forwards the call to the LiveKit SIP server.
- LiveKit uses pre-configured **Dispatch Rules** (`/api/sip/inbound/setup`) to route the call to a specific room based on the called number.
- The corresponding inbound agent worker joins the room and greets the caller.

### Outbound Flow

- An API request triggers `/api/calls/outbound`.
- The Next.js backend instructs LiveKit to create a **SIP Participant** using outbound SIP trunk credentials.
- LiveKit places the SIP call to the target phone number.
- Once connected, both the SIP participant and the outbound AI agent join the designated room to converse.

---

## 8. Proposed Rebuild Architecture

If this system were to be expanded or rebuilt for enterprise scale, the following enhancements are recommended:

1. **Decoupled Agent Workers**: Move the AI execution logic (the `@livekit/agents` processes) out of the Next.js API/serverless environment into dedicated long-running containers (e.g., Docker on ECS/Kubernetes or Fly.io) to avoid serverless timeout limits and cold starts during calls.
2. **Persistent State Management**: Introduce a database (PostgreSQL + Prisma/Drizzle) to log call metadata, transcripts, and business outcomes reliably.
3. **Queue-Based Outbound Campaigns**: Integrate BullMQ + Redis to manage large-scale outbound dialing campaigns with retries, scheduling, and concurrency limits.
4. **Dynamic Tool Calling API**: Expose generic webhooks so agents can interface with external CRMs (HubSpot, Salesforce) dynamically without hardcoding tool logic.
