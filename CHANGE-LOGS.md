## 🗓️ **2026-03-09**

---

### ✨ Features

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
