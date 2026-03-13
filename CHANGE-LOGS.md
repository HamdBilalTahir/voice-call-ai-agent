## 🗓️ **2026-03-13**

---

### 🐛 Fixes

---

> ### Fix Redundant API Polling
>
> - **What changed:** Replaced `setInterval` with unmount-aware recursive `setTimeout` logic using `isMounted` flags in both `AgentCard.tsx` and `AgentClient.tsx`.
> - **Why:** When users navigated between pages or React Strict Mode triggered, overlapping timers were created without waiting for previous requests, causing rapid duplicate calls to `/api/rooms/active` for all agents simultaneously and preventing background fetches from cancelling on component unmount.
> - **Files:**
>   - `src/components/AgentCard.tsx`
>   - `src/components/AgentClient.tsx`

---

> ### Fix Breadcrumb 404 Links
>
> - **What changed:** Disabled clickable Next.js `<Link>` elements in `Breadcrumbs.tsx` for `agents`, `outbound`, and `inbound` path segments.
> - **Why:** Prevent users from clicking intermediate folder paths that do not have active Next.js routes, avoiding unnecessary 404 errors.
> - **Files:**
>   - `src/components/Breadcrumbs.tsx`

---

> ### Fix Agent Data Hydration and Layout Issues
>
> - **What changed:** Resolved a React hydration mismatch by converting the agent page layout and grid to server components that fetch the `process.env` backed agent details securely and passing them as props to the interactive client components. Cleaned up unused variables.
> - **Why:** The mismatch occurred because `process.env` returns empty strings for custom variables on the client side during hydration, breaking UI consistency on initial load.
> - **Files:**
>   - `src/app/page.tsx`
>   - `src/components/AgentCard.tsx`
>   - `src/app/agents/[direction]/[agentKey]/page.tsx`
>   - `src/components/AgentClient.tsx`
>   - `src/app/calls/[roomName]/page.tsx`

### ✨ Features

---

> ### Start Agent Process via UI
>
> - **What changed:** Added an API route to spawn background node processes running `npx tsx src/lib/agents/<direction>/<agentKey>/agent.ts start` and added Start/Stop Agent toggle buttons directly to `AgentClient.tsx` that also stream live process status.
> - **Why:** Allow the user to start or stop specific agents locally right from the agent's web interface rather than running separate terminal windows for each agent process.
> - **Files:**
>   - `src/app/api/agents/process/route.ts`
>   - `src/components/AgentClient.tsx`

---

> ### In-Browser Test Call Feature
>
> - **What changed:** Re-introduced testing agent capabilities directly via a browser microphone and speaker by adding a `TestCallModal` triggered via a "Test via Browser" button on each agent's detail page, and created a dedicated `POST /api/calls/test` route.
> - **Why:** To enable testing agent configurations rapidly without relying on Twilio or incurring SIP outbound call charges.
> - **Files:**
>   - `src/components/TestCallModal.tsx`
>   - `src/app/api/calls/test/route.ts`
>   - `src/components/AgentClient.tsx`

---

> ### Multi-Agent Dashboard Redesign
>
> - **What changed:** Redesigned the root page into an agent card grid, created an agent detail page with action, active calls, and history panels, added a live transcript page, updated the root layout with a breadcrumb component, implemented a call history JSON store, and extended active rooms filtering by agent.
> - **Why:** To support monitoring and managing multiple agents (inbound and outbound) individually from a unified control panel, tracking live calls and agent histories separately.
> - **Files:**
>   - `src/app/page.tsx`
>   - `src/app/layout.tsx`
>   - `src/app/agents/[direction]/[agentKey]/page.tsx`
>   - `src/app/calls/[roomName]/page.tsx`
>   - `src/components/Breadcrumbs.tsx`
>   - `src/lib/history.ts`
>   - `src/app/api/history/route.ts`
>   - `src/app/api/rooms/active/route.ts`
>   - `src/app/api/calls/outbound/route.ts`

---

### 🧹 Refactors

---

> ### Refactor Directory Structure for Multi-Agent Architecture
>
> - **What changed:** Moved existing single agent (`sales-en`) into `src/lib/agents/outbound/sales-en/`, created placeholders for `restaurant-es`, added agent configuration files (`prompt.ts`, `config.ts`, `tools.ts`), split SIP files into inbound/outbound setup routes, added environment variables for dispatch rule names and numbers per agent, and created a centralized agent registry.
> - **Why:** To support adding multiple agents clearly, preventing hardcoded values in `worker.ts`, mapping specific numbers directly to specific agents, and isolating each agent's config to avoid monolithic agent logic as the codebase grows.
> - **Files:**
>   - ~12 files in `src/lib/agents/*`
>   - `src/lib/sip/*`
>   - `src/app/api/sip/outbound/setup/route.ts`
>   - `src/app/api/sip/inbound/setup/route.ts`
>   - `src/app/api/calls/inbound/route.ts`
>   - `.env` & `.env.example`

## 🗓️ **2026-03-09**

---

### ✨ Features

---

> ### Add SIP Trunk Setup and Outbound Call APIs
>
> - **What changed:** Created `src/lib/sip.ts` with utilities for SIP trunk and dispatch rule creation. Mapped `TWILIO_PHONE_NUMBER` to trunk numbers during setup to comply with LiveKit requirements. Added `POST /api/sip/setup` to execute SIP setup in LiveKit. Added `POST /api/calls/outbound` route to trigger outbound calls using the configured Twilio SIP trunk (dynamically fetching the trunk ID to avoid manual `.env` updates), validated by Zod and secured with an internal API secret.
> - **Why:** To enable placing outbound phone calls using Twilio SIP trunking and automatically dispatching the LiveKit agent to the call, with a streamlined setup process.
> - **Files:**
>   - `src/lib/sip.ts`
>   - `src/app/api/sip/setup/route.ts`
>   - `src/app/api/calls/outbound/route.ts`
>   - `.env`

---

> ### Fix Agent Worker for LiveKit Agents SDK v1.x (End-to-End Verified)
>
> - **What changed:** Fully rewrote `src/lib/agent/worker.ts` to work with LiveKit Agents SDK v1.x. Migrated from `pipeline.VoicePipelineAgent` to `voice.AgentSession` + `voice.Agent`, switched to `defineAgent({ entry })` pattern required by SDK's `isAgent()` check, added `cli.runApp(new ServerOptions({ agent: __filename }))` entrypoint guarded by `require.main === module`, loaded env vars via `process.loadEnvFile()`, replaced Silero VAD (caused native crashes in subprocesses), used SDK `log()` for logging (subprocess stdout not piped to parent), passed API keys explicitly for Gemini and Cartesia, and switched STT to LiveKit Inference (`inference.STT` with `deepgram/nova-3` model) to avoid needing a separate Deepgram account. Also fixed dead code in `src/app/api/agent/route.ts` and improved error handling in the token endpoint.
> - **Why:** The original worker used pre-v1.x API patterns that no longer exist, causing startup crashes, silent failures, and no agent response despite mic input. All issues resolved and voice call confirmed working end-to-end.
> - **Files:**
>   - `src/lib/agent/worker.ts`
>   - `src/app/api/agent/route.ts`
>   - `src/app/api/livekit/token/route.ts`
>   - `package.json`

---

> ### Build LiveKit React Frontend
>
> - **What changed:** Replaced default Next.js page with `@livekit/components-react` UI and connected it to `/api/livekit/token`. Removed disconnect button and relied on LiveKit's control bar instead.
> - **Why:** To test the LiveKit Agent worker locally in isolation using a Dev Sandbox interface.
> - **Files:**
>   - `src/app/page.tsx`
>   - `package.json`

---

> ### Add Next.js Route Handler as LiveKit Agent Backend
>
> - **What changed:** Installed LiveKit agents and plugins (Deepgram, Cartesia, Silero, Gemini), created agent worker entry point, and LiveKit webhook dispatch endpoint. Added webhook verification.
> - **Why:** Allow running the agent worker entirely within Next.js using LiveKit Node SDK.
> - **Files:**
>   - `package.json`
>   - `next.config.ts`
>   - `src/lib/agent/worker.ts`
>   - `src/app/api/agent/route.ts`
>   - `src/lib/livekit.ts`

---

> ### Add LiveKit Token Endpoint
>
> - **What changed:** Created `/api/livekit/token` endpoint and `generateLiveKitToken` logic in `src/lib/livekit.ts`.
> - **Why:** To generate secure, short-lived JWT tokens for joining LiveKit rooms.
> - **Files:**
>   - `package.json`
>   - `src/lib/livekit.ts`
>   - `src/app/api/livekit/token/route.ts`

---

> ### Add Core Dependencies and Project Structure
>
> - **What changed:** Setup env variables, project structure and added livekit-server-sdk and zod.
> - **Why:** Prepare for agent backend logic, webhook processing, and LiveKit communication.
> - **Files:**
>   - `.env.example`
>   - `.env`
>   - `package.json`
>   - `src/app/api/livekit/`
>   - `src/app/api/webhooks/`
>   - `src/app/api/agent/`
>   - `src/components/`
>   - `src/lib/`

---

> ### Add Jest tests and Husky pre-commit hook
>
> - **What changed:** Installed and configured Jest, React Testing Library, and Husky pre-commit hooks using lint-staged.
> - **Why:** Ensure code quality and setup testing framework.
> - **Files:**
>   - `package.json`
>   - `.husky/pre-commit`
>   - `jest.config.ts`

---

> ### Setup Next.js App
>
> - **What changed:** Initialized Next.js app with App Router, TypeScript, and Tailwind CSS.
> - **Why:** Scaffolding and initial boilerplate for server-side usage on AI agent for voice calls.
> - **Files:**
>   - `package.json`
>   - `tsconfig.json`
>   - `next.config.mjs`
>   - `tailwind.config.ts`
>   - `src/app/*`
