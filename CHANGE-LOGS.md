## 🗓️ **2026-03-14**

---

### ✨ Features

---

> ### Live Transcript with Real-Time Streaming Translation
>
> - **What changed:** Added a `TranscriptView` component to the browser test call modal showing a live chat-style transcript of both the agent and caller. Translation to English streams word-by-word for the `restaurant-es` agent using a new `POST /api/translate` endpoint (Gemini streaming). Caller and agent bubbles are deduplicated by `lk.segment_id`. An English skip prevents translation rows from appearing when the detected output is already English.
> - **Why:** To allow testers to follow Spanish/Hindi conversations in real time without needing to understand the spoken language.
> - **Files:**
>   - `src/components/TestCallModal.tsx`
>   - `src/app/api/translate/route.ts`
>   - `src/app/calls/[roomName]/page.tsx`
>   - `src/lib/translation.ts`

---

> ### Copy Transcript Button
>
> - **What changed:** Added a "Copy" button to the Live Transcript header that copies the full completed conversation to the clipboard in `Agent: ...` / `Caller: ...` format.
> - **Why:** To allow quick export of a call transcript for pasting into notes or tickets.
> - **Files:**
>   - `src/components/TestCallModal.tsx`

---

### 🐛 Fixes

---

> ### Fix Agent Translation Never Triggering
>
> - **What changed:** Changed the translation skip condition from `!isInterimStream` to `isInterimStream && !isAgent`. The LiveKit SDK publishes agent speech streams with `lk.transcription_final="false"` (the same interim flag used for partial caller STT), so agent bubbles were being silently skipped.
> - **Why:** Agent speech should always be translated once the stream completes, regardless of the `lk.transcription_final` flag.
> - **Files:**
>   - `src/components/TestCallModal.tsx`
>   - `src/app/calls/[roomName]/page.tsx`

---

> ### Fix Translation Hanging Due to Deprecated Gemini Model
>
> - **What changed:** Replaced `gemini-2.0-flash` (404 — no longer available) and `gemini-2.5-flash` (slow thinking model, caused indefinite hangs) with `gemini-3-flash-preview`, matching the model already used by the agent LLM. Switched from blocking `generateContent` to streaming `generateContentStream` so translations appear word-by-word (~1s to first word vs ~4s for full response). Added 15s `AbortController` client-side timeout and thought-part filtering on the server to prevent thinking tokens leaking into output.
> - **Why:** Translation was stuck on "Translating…" forever due to model deprecation and blocking API calls.
> - **Files:**
>   - `src/app/api/translate/route.ts`
>   - `src/components/TestCallModal.tsx`
>   - `src/app/calls/[roomName]/page.tsx`

---

### 🔧 Refactors

---

> ### Extract Shared `translateToEnglish` Utility
>
> - **What changed:** Extracted the duplicated `translateToEnglish` streaming function from `TestCallModal.tsx` and `calls/[roomName]/page.tsx` into `src/lib/translation.ts`. Fixed hooks ordering (`copied` state moved before `useEffect` calls). Cached Gemini model instance at module level. Added cleanup for the copy-button reset timer on unmount.
> - **Why:** The function was identical in both files. Centralising it ensures both pages stay in sync and fixes minor cleanup issues found during review.
> - **Files:**
>   - `src/lib/translation.ts` _(new)_
>   - `src/components/TestCallModal.tsx`
>   - `src/app/calls/[roomName]/page.tsx`
>   - `src/app/api/translate/route.ts`

---

## 🗓️ **2026-03-13**

---

### ✨ Features

---

> ### Sync Transcription Options & LLM Transcripts
>
> - **What changed:** Disabled transcription synchronization (`syncTranscription: false`) in output options for both `restaurant-es` and `sales-en` agent sessions. Added `agent_speech_generated` event listener to capture raw LLM text outputs.
> - **Why:** To send transcriptions to the client as soon as they become available, and to ensure the LLM text output is also shared in the transcription payload.
> - **Files:**
>   - `src/lib/agents/inbound/restaurant-es/agent.ts`
>   - `src/lib/agents/outbound/sales-en/agent.ts`

---

> ### Real-Time Streaming Transcripts and Deepgram Multi-language
>
> - **What changed:** Configured agents to publish `publishData` for non-final partial STT transcripts over LiveKit, updated `TestCallModal` and `/calls/[roomName]` UI to stream real-time typewriter-effect transcripts (including translations), set Deepgram STT language to `"multi"`, and assigned Google LLM explicitly for the inbound agent.
> - **Why:** To fix the issue where transcripts didn't render correctly for the user until long delays or disconnects, and to allow the Spanish inbound agent to seamlessly understand an English caller and reply in Spanish dynamically.
> - **Files:**
>   - `src/lib/agents/inbound/restaurant-es/agent.ts`
>   - `src/lib/agents/outbound/sales-en/agent.ts`
>   - `src/lib/agents/inbound/restaurant-es/config.ts`
>   - `src/components/TestCallModal.tsx`
>   - `src/app/calls/[roomName]/page.tsx`
>   - `src/lib/livekit.ts`

---

> ### Real-Time English Translation in Browser Call UI
>
> - **What changed:** Implemented a new `POST /api/translate` endpoint using Gemini 2.5 Flash and updated the `restaurant-es` live transcript page to fetch and render inline English translations for incoming Spanish text.
> - **Why:** To allow dashboard observers to understand the Spanish restaurant agent's real-time conversational transcripts directly in English without leaving the UI.
> - **Files:**
>   - `src/app/api/translate/route.ts`
>   - `src/app/calls/[roomName]/page.tsx`

---

> ### Register Inbound Spanish Agent and API Route
>
> - **What changed:** Added `restaurant-es` to the centralized agent registry and implemented the `POST /api/calls/inbound` route to create LiveKit rooms and dispatch agents dynamically.
> - **Why:** To expose the new Spanish restaurant agent in the multi-agent UI dashboard and provide an endpoint that Twilio/LiveKit SIP trunks can trigger when an incoming call arrives.
> - **Files:**
>   - `src/lib/agents/registry.ts`
>   - `src/app/api/calls/inbound/route.ts`

---

> ### Build inbound/restaurant-es Agent
>
> - **What changed:** Created configuration, prompt, tools, and agent file for the inbound Spanish restaurant agent.
> - **Why:** To support inbound calls and take orders in Spanish for a virtual restaurant receptionist.
> - **Files:**
>   - `src/lib/agents/inbound/restaurant-es/config.ts`
>   - `src/lib/agents/inbound/restaurant-es/prompt.ts`
>   - `src/lib/agents/inbound/restaurant-es/tools.ts`
>   - `src/lib/agents/inbound/restaurant-es/agent.ts`
>   - `.env`
>   - `.env.example`

---

### 🐛 Fixes

---

> ### Fix Real-Time Transcript Streaming Not Appearing
>
> - **What changed:** Replaced `RoomEvent.DataReceived` (custom `publishData` topic approach) with `RoomEvent.TranscriptionReceived` (native LiveKit transcription protocol) in both `TestCallModal` and the live transcript page. Agent vs Caller is now determined by `participant.isLocal` and `participant.identity` prefix rather than a custom JSON field.
> - **Why:** LiveKit Agents SDK v1.x removed the `agent_speech_committed` event (the listener was a no-op) and instead automatically publishes all transcriptions — partial and final, for both agent and user — via the native `publishTranscription` mechanism. The browser must subscribe to `RoomEvent.TranscriptionReceived` to receive them. The old `DataReceived` handler never fired because the data was never sent.
> - **Files:**
>   - `src/components/TestCallModal.tsx`
>   - `src/app/calls/[roomName]/page.tsx`

---

> ### Fix Browser Test Call Agent Dispatching
>
> - **What changed:** Updated the `POST /api/calls/test` route to dynamically look up the tested agent's `dispatchRuleName` from the agent registry instead of hardcoding it to `"voice-agent"`. Added diagnostic logs to `restaurant-es` worker to track its connection lifecycle.
> - **Why:** The hardcoded dispatch name caused the Spanish agent worker to ignore test call dispatch requests because it was listening for `"inbound-dispatch"`, preventing the agent from speaking or transcribing during browser tests.
> - **Files:**
>   - `src/app/api/calls/test/route.ts`
>   - `src/lib/agents/inbound/restaurant-es/agent.ts`

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
