## 🗓️ **2026-05-25**

---

### 🗄️ Data & Infrastructure

---

> ### Agents — `userId` Foreign Key + User-Scoped Fetching
>
> - **What changed:** Dynamic agents now always store a `userId` field (the Firebase Auth UID of the creating user) as a top-level Firestore field alongside all other agent data. `userId` is a required param in `CreateAgentParams` — `createAgent()` writes it unconditionally. `POST /api/agents` now requires a valid Bearer token; it returns 401 if the token is absent or invalid, and extracts `userId` from the verified token to pass to `createAgent`. `WelcomeModal` fetches the ID token via `getIdToken()` and sends it in the `Authorization: Bearer` header when calling `POST /api/agents`. `listAgents(uid?)` was updated to accept an optional `uid` — when provided, dynamic agents whose `userId` field doesn't match are excluded from the result. The server-side `layout.tsx` reads a `__uid` cookie (set by `AuthContext` on sign-in) and passes it to `listAgents(uid)` so the sidebar only shows the signed-in user's agents. `GET /api/agents` similarly verifies the Bearer token and scopes results. `AuthContext` now sets a `__uid` cookie alongside `__session` on sign-in and clears it on sign-out. The field was also renamed from `ownerUid` → `userId` throughout (`AgentFirestoreDoc`, `AgentFullData`, `TIER1_FIELD_LIST`, `AgentWriteSchema`, `resolveProviderKeys.ts`, `VoiceBehaviorTab.tsx`).
> - **Why:** Without `userId` on agent documents, all dynamically created agents were visible to every authenticated user regardless of who created them. The foreign key makes the data model multi-tenant-ready and is the prerequisite for per-user billing, quotas, and team-based access control.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(userId required in CreateAgentParams; always written in createAgent; listAgents(uid?) filter; rename ownerUid→userId throughout)_
>   - `src/app/api/agents/route.ts` _(POST requires auth, 401 on missing token, passes userId; GET scopes by verified token)_
>   - `src/components/WelcomeModal.tsx` _(sends Authorization: Bearer header on agent creation)_
>   - `src/contexts/AuthContext.tsx` _(\_\_uid cookie set/clear on sign-in/sign-out)_
>   - `src/app/layout.tsx` _(reads \_\_uid cookie, passes to listAgents)_
>   - `src/lib/firebase/resolveProviderKeys.ts` _(reads agentData.userId)_
>   - `src/components/VoiceBehaviorTab.tsx` _(saves userId in patch payload)_

---

### 🐛 Fixes

---

> ### Sidebar & Profile — displayName Read from Firestore Instead of Firebase Auth
>
> - **What changed:** `AuthContext` now exports a `profile` object (`{ displayName, email, photoURL }`) fetched from the `userProfile/{uid}` Firestore document immediately after sign-in. The previous `createUserProfileIfMissing()` helper was replaced by `ensureUserProfile()` which returns the Firestore data if the doc already exists, or creates it and returns the new data if not. `AuthContextValue` is extended with `profile: UserProfile | null`. `Sidebar` was updated to use `profile?.displayName` (initials calculation and display name row) instead of `user?.displayName`. The collapsed avatar initials (previously hardcoded `"AJ"`) now also derive from `profile?.displayName`. `settings/profile/page.tsx` pre-fills the name field from `profile?.displayName`.
> - **Why:** `user.displayName` on the Firebase Auth object is `null` for email/password and magic-link sign-ins — Firebase Auth only auto-populates it for Google OAuth. The `userProfile` Firestore document had the correct `displayName` value, but the Sidebar was reading the wrong source, causing it to always display "—".
> - **Files:**
>   - `src/contexts/AuthContext.tsx` _(ensureUserProfile, UserProfile interface, profile in context value)_
>   - `src/components/Sidebar.tsx` _(profile?.displayName in display name row and initials)_
>   - `src/app/settings/profile/page.tsx` _(profile?.displayName pre-fill)_

---

### ✨ Features

---

> ### Provider / Model / API Key Configuration System
>
> - **What changed:** Added per-agent LLM, TTS, and STT provider + model selection. Users choose a provider (LLM: Google Gemini or OpenAI; TTS: ElevenLabs or Cartesia; STT: Deepgram) and a model within that provider, each backed by an API key stored in a `userProfile/{uid}/providerConfigs` Firestore subcollection. **`ApiKeyPicker`** inside `VoiceBehaviorTab` shows a dropdown of all saved keys for the selected provider — users can pick an existing key or type a new one inline; new keys are auto-saved on use. Raw API keys are never returned to the browser: only a `maskedKey` (e.g. `sk-p...bc12`) is exposed in GET responses. At call-dispatch time, `resolveProviderKeys()` (server-side) reads the `llmConfigId`, `ttsConfigId`, and `sttConfigId` stored on the agent, fetches the raw keys from Firestore, and injects them into the LiveKit dispatch metadata via `buildDispatchMetadata()`. The worker (`genericEntry.ts`) branches on `llmProvider` (`google.LLM` vs `openai.LLM`) and `ttsProvider` (`elevenlabs.TTS` vs `cartesia.TTS`), falling back to env vars when keys are absent from metadata. `VoiceBehaviorTab` saves `ownerUid: user?.uid` on agent writes so `resolveProviderKeys` can scope lookups to the correct user's subcollection. Voice & Language section collapsed by default.
> - **Why:** Previously all API keys were global env vars and agents had no way to use per-user or per-agent provider credentials. This makes the product multi-tenant-ready and lets users bring their own provider keys without touching environment configuration.
> - **Files:**
>   - `src/lib/firebase/providerConfigs.ts` _(new — CRUD for providerConfigs subcollection, maskedKey, verifyToken)_
>   - `src/lib/firebase/resolveProviderKeys.ts` _(new — resolves configIds to raw keys at dispatch time)_
>   - `src/app/api/provider-configs/route.ts` _(new — GET/POST, Bearer auth)_
>   - `src/app/api/provider-configs/[configId]/route.ts` _(new — DELETE, Bearer auth)_
>   - `src/lib/firebase/agents.ts` _(LlmProvider, TtsProvider, SttProvider types; llmConfigId/ttsConfigId/sttConfigId on VoiceSettings; ownerUid on AgentFirestoreDoc/AgentFullData)_
>   - `src/lib/firebase/admin.ts` _(getAdminApp exported)_
>   - `src/lib/agents/promptBuilder.ts` _(ResolvedProviderKeys interface; buildDispatchMetadata accepts resolved keys)_
>   - `src/lib/agents/genericEntry.ts` _(OpenAI + Cartesia provider branches; buildSTT accepts optional apiKey)_
>   - `src/components/VoiceBehaviorTab.tsx` _(complete overhaul — ProviderSection, ApiKeyPicker, ownerUid on save)_
>   - `src/app/api/calls/test/route.ts` _(resolveProviderKeys before buildDispatchMetadata)_
>   - `src/app/api/calls/outbound/route.ts` _(resolveProviderKeys before buildDispatchMetadata)_

---

> ### Firebase Auth — Google OAuth, Email/Password, Magic Link + Route Protection
>
> - **What changed:** Wired Firebase Authentication end-to-end. Login page (`/login`) supports three methods: **Google OAuth** (one-click), **Magic link** (passwordless, default tab — sends a `sendSignInLinkToEmail` link; handles cross-device flow by prompting for email confirmation when localStorage is absent on the return device), and **Email/Password** (sign-up and sign-in on the same form). On sign-in the `AuthContext` sets a `__session` cookie; on sign-out it clears it. A Next.js Edge middleware (`middleware.ts`) reads the cookie on every request and redirects unauthenticated users to `/login` for any non-public path. `AppLayout` skips the sidebar/topbar when the pathname is `/login`. `userProfile/{uid}` is created in Firestore only on first ever sign-in for any auth method; subsequent sign-ins skip the write. Sidebar and profile page display the real authenticated user's name and email from the Auth context.
> - **Why:** The product had no authentication — any visitor could access any route and all data was shared globally. Firebase Auth provides a battle-tested identity layer; the cookie + Edge middleware pattern ensures unauthenticated users are redirected server-side before any page content renders.
> - **Files:**
>   - `src/contexts/AuthContext.tsx` _(new — onAuthStateChanged, session cookie, createUserProfileIfMissing, signOut)_
>   - `src/lib/firebase/client.ts` _(new — Firebase app init, auth and db exports)_
>   - `middleware.ts` _(new — Edge middleware, \_\_session cookie check, public path allowlist)_
>   - `src/app/login/page.tsx` _(new — Google, magic link, email/password; cross-device confirmation flow)_
>   - `src/components/AppLayout.tsx` _(skip sidebar on /login)_
>   - `src/components/Sidebar.tsx` _(real user data, working sign-out)_
>   - `src/app/settings/profile/page.tsx` _(name/email from useAuth)_

---

## 🗓️ **2026-05-24**

---

### 🏗️ Architecture

---

> ### Generic Agent Entry — All Config Driven from Firestore via Dispatch Metadata
>
> - **What changed:** Extracted all shared agent logic into `src/lib/agents/genericEntry.ts`, which exports a `makeAgentEntry(defaults)` factory. The factory accepts compiled static defaults (`systemPrompt`, `greeting`, `llmModel`, `ttsModel`, `ttsVoiceId`, `sttModel`, `sttLanguage`, `workerName`) and returns a `defineAgent` entry. At runtime the entry reads every field from the LiveKit dispatch metadata first and only falls back to the compiled defaults when a field is absent. The metadata is now the single source of truth for all runtime config — not `config.ts`. Added `buildDispatchMetadata(agentData, extra?)` to `promptBuilder.ts`: it takes a Firestore `AgentFullData` doc and serialises the full voice settings (`llmModel`, `ttsModel`, `ttsVoiceId`, `sttModel`, `sttLanguage`) alongside `systemPrompt` and `voiceGreeting` into a single JSON string. All three dispatch routes now call this helper: `POST /api/calls/test`, `POST /api/calls/inbound`, and `POST /api/calls/outbound`. The outbound route was previously dispatching with no metadata and a hardcoded `"voice-agent"` dispatch rule — it now reads the agent doc from Firestore to get both the correct `dispatchRuleName` and the full voice settings. Both `restaurant-es/agent.ts` and `sales-en/agent.ts` were reduced to ~10 lines each: they pass their compiled `config.ts` values as defaults to `makeAgentEntry` and keep only the CLI entrypoint. All agent logic (STT/LLM/TTS construction, session wiring, greeting, usage file write) now lives exclusively in `genericEntry.ts`. Usage recording writes the `llmModel` that was actually used (from metadata or fallback), not the hardcoded constant.
> - **Why:** Both agent workers were identical except for their default config values. Any new per-agent setting (new model, STT language override, different voice) previously required editing code; now it's a Firestore field change. Dynamic agents already lived entirely as Firestore docs — the static template agents now follow the same pattern at runtime.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(new — shared factory for all agent workers)_
>   - `src/lib/agents/promptBuilder.ts` _(buildDispatchMetadata added; AgentFullData import)_
>   - `src/lib/agents/inbound/restaurant-es/agent.ts` _(reduced to makeAgentEntry call + CLI)_
>   - `src/lib/agents/outbound/sales-en/agent.ts` _(reduced to makeAgentEntry call + CLI)_
>   - `src/app/api/calls/test/route.ts` _(buildDispatchMetadata replacing inline metadata build)_
>   - `src/app/api/calls/inbound/route.ts` _(buildDispatchMetadata replacing inline metadata build)_
>   - `src/app/api/calls/outbound/route.ts` _(Firestore lookup + buildDispatchMetadata; correct dispatchRuleName per agent)_

---

> ### Call History — Consolidate Token Columns + Wider Table Container
>
> - **What changed:** Reduced the Call History table from 15 columns to 12. The three separate "Tokens In", "Tokens Out", "Total Tokens" columns were replaced by a single **Tokens** column displaying a stacked `in / out` two-line cell. The "Est. Cost" and "TTS Chars" column headers were shortened to **Cost** and **TTS** respectively. The LLM column now has `max-w-[130px]` with `truncate` and a `title` tooltip so long model names (e.g. `gemini-3-flash-preview`) don't push other columns off screen. The global content container was widened from `max-w-7xl` (1280 px) to `max-w-[1600px]` so the table uses more of the available viewport on larger monitors.
> - **Why:** With the new LLM column the table overflowed its container — model name strings are 20+ characters in monospace. Consolidating the three redundant token columns recovers the needed space without losing any meaningful information.
> - **Files:**
>   - `src/components/CallHistoryClient.tsx` _(columns consolidated, LLM truncation)_
>   - `src/components/AppLayout.tsx` _(max-w-[1600px])_

---

### ✨ Features

---

> ### WelcomeModal — Description Field + Full 5-Prompt-Section Creation Flow
>
> - **What changed:** Step 1 of the agent-creation modal now includes an optional **Description** text input between the agent name and the purpose picker. The description is sent to `POST /api/agents` and stored in Firestore as the `description` field on the new agent document. Step 3 was updated to surface all five prompt fields: **What it does**, **How it talks**, **What to avoid**, **Anything else**, and **Opening line** — matching the structure of the Instructions tab. All five fields are stored on creation via `roleAndResponsibilities`, `personaLanguageAndTone`, `mistakesToAvoid`, `additionalInstructions`, and `voiceGreeting` respectively. All state is reset when the modal is reopened.
> - **Why:** The creation flow previously only accepted a role/responsibilities field and left the other four sections blank, requiring the user to navigate to the Instructions tab after creation to complete setup. Surfacing all five fields up front collapses two steps into one.
> - **Files:**
>   - `src/components/WelcomeModal.tsx`
>   - `src/app/api/agents/route.ts`

---

> ### Agent Description — Inline Editing with Pencil Icon
>
> - **What changed:** The agent description subtitle in the agent page header now has an inline edit affordance. A pencil icon (Pencil2 from lucide) appears on hover next to the description text; clicking it (or the text itself) switches the subtitle to a single-row auto-focused textarea. **Enter** or **blur** saves via `PATCH /api/agents/[agentKey]`; **Escape** cancels. Save is optimistic — the UI updates immediately before the async write completes. `router.refresh()` is called after a successful save to sync server-side props. On failure the value reverts and a toast is shown. The `useEffect` that syncs `editedDescription` from server props only depends on `agentData.description` (not on `isEditingDescription`), so in-progress edits are never overwritten by a concurrent refresh.
> - **Why:** Agent descriptions help operators distinguish deployments at a glance; requiring a developer-side Firestore edit to change a one-line subtitle is unnecessary friction.
> - **Files:**
>   - `src/components/AgentClient.tsx`

---

> ### Call History — testNumber Field + Playground Caller/Recipient Display
>
> - **What changed:** Added `testNumber?: string` to `CallRecord` in `history.ts`. The outbound-call route (`POST /api/calls/outbound`) now stores `testNumber: toNumber` on the call record when `isPlayground && testType === "phoneCall"`. In the Call History table the **Caller / Recipient** cell now shows **"Playground"** (primary text in brand blue) with a secondary sub-line: the `testNumber` if it was a phone test, or **"Widget"** for browser-mic tests. This replaces the old phone-number display for playground calls. The slide-over header and Overview panel follow the same pattern.
> - **Why:** Playground calls show up in Call History alongside live calls; operators need to distinguish them at a glance and, for phone tests, know which number was called.
> - **Files:**
>   - `src/lib/history.ts` _(testNumber added to CallRecord)_
>   - `src/app/api/calls/outbound/route.ts` _(stores testNumber)_
>   - `src/components/CallHistoryClient.tsx` _(Caller/Recipient cell + slide-over header)_

---

> ### Call History — LLM Model Column + Agent Name from Firestore
>
> - **What changed:** Added a new **LLM** column to the Call History table (between Sentiment and Tokens In) showing `record.usage.llmModel` in monospace, or `—` when usage data is absent. The `calls/page.tsx` route was changed from `Object.values(staticRegistry)` to `await listAgents()` so that all agents — static and dynamically created — are available for name and direction lookups. This fixes the agent column falling back to showing the raw Firestore doc ID for dynamic agents, and fixes the direction showing as "Outbound" for inbound dynamic agents.
> - **Why:** Knowing which LLM model was used per call is the primary lever for understanding cost and latency variance. The agent-name fix was a regression from the Firestore doc-ID migration — dynamic agents were simply absent from the static registry.
> - **Files:**
>   - `src/app/calls/page.tsx` _(listAgents() replacing static registry)_
>   - `src/components/CallHistoryClient.tsx` _(LLM column header + cell)_

---

### 🗄️ Data & Infrastructure

---

> ### Agents — Firestore Auto-Generated Doc IDs + slug Field + Migration
>
> - **What changed:** Agent documents are now created with Firestore auto-generated document IDs (`col.add()`) rather than a pre-computed human-readable slug. The `key` field (= the auto-generated doc ID) and a `slug` field (= `slugify(name)`, human-readable) are both stored on the document. `createAgent()` in `agents.ts` was updated to use `col.add()`, then write `key: docRef.id` back in a second `update()` call, and returns `{ ok: true, key: string }`. `CreateAgentParams` was extended to include `personaLanguageAndTone`, `mistakesToAvoid`, and `voiceGreeting`. The `POST /api/agents` route no longer pre-generates a key — it reads `result.key` from `createAgent()`. A migration target `agentDocIds` was added to `migrateAgentDocIds()` in `migration.ts` and wired into `POST /api/agents/migrate`: it finds docs whose `isDynamic: true` and have no `key` field (old slug-keyed docs), creates a new doc via `col.add()`, copies all data with `slug` and `key` set, then deletes the old doc. The existing `sarah-layref-12ye` agent was migrated to `gZpvYpAgmk9WShjXqF8G`.
> - **Why:** Using the agent name as the Firestore doc ID meant renaming an agent could break routing, and two agents with similar names could collide. Auto-generated IDs are stable, collision-free, and the Firestore convention.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(createAgent, CreateAgentParams)_
>   - `src/lib/firebase/migration.ts` _(migrateAgentDocIds)_
>   - `src/app/api/agents/migrate/route.ts` _(agentDocIds target)_
>   - `src/app/api/agents/route.ts` _(key from result, not pre-generated)_

---

### 🐛 Fixes

---

> ### Dynamic Agents — Prompt Read/Write Pure Firestore (No Filesystem Fallback)
>
> - **What changed:** `GET /api/agents/[agentKey]/prompt` and `POST /api/agents/[agentKey]/prompt` were simplified to use `getAgent(agentKey)` exclusively. The GET handler previously had a static registry guard (`if (!agents[agentKey]) return 404`) followed by a filesystem read from the agent's `prompt.ts` file — both of which blocked dynamic agents with Firestore-only data. The POST had the same guard. Both are now removed; both handlers call `getAgent()` which handles static and dynamic agents uniformly. A 404 is returned only when `getAgent()` itself returns null.
> - **Why:** Dynamic agents (created via the UI) have no `prompt.ts` on disk and are not in the static registry. The old handlers returned 404 for any dynamic agent, making the Instructions tab completely non-functional for them.
> - **Files:**
>   - `src/app/api/agents/[agentKey]/prompt/route.ts`

---

> ### updateAgentConfig — Dynamic Agent Support
>
> - **What changed:** Removed the static registry guard from `updateAgentConfig()` in `agents.ts`. The function previously returned `{ ok: false, error: "Agent not found" }` when `registryAgents[agentKey]` was undefined, which silently blocked all writes for dynamic agents. Firestore writes now proceed for any agent key; the document existence check relies on the Firestore write itself.
> - **Why:** Dynamic agents are not in the static registry by design — the registry is only for agents deployed as code. Blocking writes on a missing registry entry meant the entire Instructions tab save path was broken for UI-created agents.
> - **Files:**
>   - `src/lib/firebase/agents.ts`

---

> ### Instructions Tab — Remove All Character Limits
>
> - **What changed:** Removed all `maxLength` values from the `SectionMeta` interface and all five entries in `SECTION_META` in `AIJobDescriptionTab.tsx`. Removed the `getCounterColor()` function. Removed the character counter display (`{sections[key].length} / {meta.maxLength}`) from the textarea footer. Removed the `for…of` validation loop that blocked saves when a field exceeded its limit. Correspondingly removed all `.max()` constraints from the five prompt-field schemas in `AgentWriteSchema` in `agents.ts`.
> - **Why:** Real-world agent prompts for complex workflows easily exceed the previous 4,000-character limits. Artificial limits that block saves without a workaround destroy user trust.
> - **Files:**
>   - `src/components/AIJobDescriptionTab.tsx`
>   - `src/lib/firebase/agents.ts`

---

> ### Agent Description Save — Optimistic Frontend Update
>
> - **What changed:** `saveDescription` in `AgentClient` now (1) sets `isEditingDescription(false)` and `setEditedDescription(trimmed)` optimistically before the async fetch, (2) calls `router.refresh()` after a successful `PATCH`, and (3) calls `res.ok` to detect server-side failures and reverts the optimistic value on error. The `useEffect` that syncs `editedDescription` from `agentData.description` was changed to only depend on `agentData.description` (previously it also depended on `isEditingDescription`), which prevented the stale dependency from resetting the field back to the old server value immediately after the optimistic update was applied.
> - **Why:** Without the optimistic update and correct effect deps, a successful DB write would still show the old description until the user manually refreshed the page.
> - **Files:**
>   - `src/components/AgentClient.tsx`

---

### 🗄️ Data & Infrastructure

---

> ### callHistory — Schema Overhaul: Auto-IDs, roomName FK, Playground Flags, LiveKit Timestamps
>
> - **What changed:** The `callHistory` Firestore collection was fully restructured. **Document IDs** are now Firestore auto-generated (no longer the roomName string). The `id` field is no longer stored inside the document — it is reconstructed from `d.id` on every read. **`roomName`** is stored as an explicit field and is the key used by webhook handlers to locate and update documents (queried via `where("roomName", "==", roomName)`). **`agentId`** mirrors `agentKey` as an explicit foreign key. **`isPlayground: boolean`** marks whether the call was initiated from the Playground or from a real channel. **`testType: "widget" | "phoneCall"`** is set when `isPlayground` is true — `"widget"` for browser mic tests via LiveKit, `"phoneCall"` for playground phone-call tests using SIP. **`callStartedAt`** and **`callEndedAt`** store the LiveKit-sourced timestamps: `callStartedAt` is derived from `json.room.creation_time * 1000` on the `room_started` webhook event; `callEndedAt` is set when `room_finished` fires. **`phoneNumber`** and **`userId`** are optional. `history.ts` was rewritten to match: `addCallRecord` uses `col.add()`, `getCallRecord` and `updateCallRecord` query by `roomName` field, and a new `updateCallRecordById(docId, ...)` handles direct doc-ID updates for the bulk-archive UI path. The `toFirestore()` helper always strips `id` before any write. **Outbound call route** (`POST /api/calls/outbound`) now accepts `isPlayground` and `testType` from the request body and stores them on the record. **`/api/calls/test`** (browser widget) creates a call record with `isPlayground: true, testType: "widget"`. **Playground** (`PlaygroundClient`) passes `isPlayground: true, testType: "phoneCall"` when initiating a phone test from the Playground phone panel. **Webhook** (`POST /api/agent`) now handles `room_started` to write `callStartedAt`, and writes both `callStartedAt` and `callEndedAt` on `room_finished`. **Migrations:** new `normalizeCallHistoryDocs()` uses a Firestore batch to set `roomName`, `isPlayground`, `testType`, and delete the redundant `id` field on all existing docs; `backfillPlaygroundFields()` adds `isPlayground: false` to docs that are missing it; `migrateCallHistoryJson()` updated to use `col.add()` and check by `id` field to avoid duplicates. `POST /api/agents/migrate` extended to support `target: "normalizeCallHistory" | "backfillPlayground"`. Both existing call records were normalised: `isPlayground: true, testType: "widget"`.
> - **Why:** The old schema used the roomName as the Firestore doc ID and stored it redundantly as a field. Auto-generated IDs are the Firestore convention and decouple the storage key from the business identifier. `roomName` as a queryable field keeps webhook lookups clean. `isPlayground` and `testType` are the foundation for separating real-call metrics from test noise in dashboards and reporting. LiveKit timestamps (`callStartedAt`/`callEndedAt`) are more accurate than the wall-clock times recorded by our API layer.
> - **Files:**
>   - `src/lib/history.ts` _(complete rewrite — auto-IDs, roomName field, isPlayground/testType, callStartedAt/callEndedAt, toFirestore helper, updateCallRecordById)_
>   - `src/lib/firebase/migration.ts` _(normalizeCallHistoryDocs, backfillPlaygroundFields, migrateCallHistoryJson updated)_
>   - `src/app/api/agents/migrate/route.ts` _(normalizeCallHistory + backfillPlayground targets)_
>   - `src/app/api/agent/route.ts` _(room_started handler, callStartedAt/callEndedAt on room_finished)_
>   - `src/app/api/calls/outbound/route.ts` _(isPlayground + testType from request body)_
>   - `src/app/api/calls/test/route.ts` _(creates call record with isPlayground: true, testType: "widget")_
>   - `src/app/api/history/route.ts` _(PATCH uses updateCallRecordById for bulk archive)_
>   - `src/components/PlaygroundClient.tsx` _(passes isPlayground: true, testType: "phoneCall" on phone test)_

---

### 🐛 Fixes

---

> ### Agent Page Title Not Refreshing After Sidebar Rename
>
> - **What changed:** `AgentClient` now syncs `editedName` state with `agentData.name` via a `useEffect` whenever new props arrive from the server. The effect is guarded by `!isEditingName` so an in-progress inline edit is never overwritten. Previously, `editedName` was only initialised once from `agentData.name` via `useState`, so `router.refresh()` (called by the sidebar after saving a rename) delivered new props but the displayed title stayed stale.
> - **Why:** Renaming from the sidebar updated the sidebar immediately (optimistic local state) but the agent page heading kept showing the old name until a full page reload.
> - **Files:**
>   - `src/components/AgentClient.tsx`

---

> ### RecentActivityPanel — Missing React Key on Call History Items
>
> - **What changed:** The `callHistory.slice(0, 8).map()` in `RecentActivityPanel` now uses `record.id || record.roomName || i` as the `key` prop. The schema change that moved from roomName-as-docID to Firestore auto-IDs meant `record.id` could momentarily be undefined for docs that hadn't been normalised yet, triggering the React "each child in a list should have a unique key" warning.
> - **Why:** Missing keys cause React to produce console errors and can lead to incorrect reconciliation behaviour during re-renders.
> - **Files:**
>   - `src/components/AgentClient.tsx`

---

> ### Dynamic Agent Creation — Onboarding Modal End-to-End
>
> - **What changed:** Rewrote `WelcomeModal` from a fake 3-step stub into a fully functional agent creation flow. **Step 1:** Agent name text input + purpose picker (Answer calls / Make calls / Both) — Continue is blocked until both are filled. **Step 2:** Industry grid (Restaurant / Clinic / Agency / Other). **Step 3:** Language picker + Role & responsibilities textarea for all industries; if industry is "Other", an additional Initial instructions textarea appears. Submitting calls `POST /api/agents` which was added as a new handler: it slugifies the name + appends a short timestamp suffix to generate a unique `agentKey`, maps `purpose → direction`, maps language code to locale string (en-US, es-ES, fr-FR), resolves the correct LiveKit dispatch rule from env vars, and calls `createAgent()`. New `createAgent()` function in `src/lib/firebase/agents.ts` writes a complete Firestore document (`isDynamic: true`, `name`, `direction`, `language`, `industry`, `dispatchRuleName`, plus the role as `roleAndResponsibilities`). The "done" step navigates to `/playground?agent={newAgentKey}`. The modal fully resets when re-triggered via `open-welcome-modal` event. The "New agent" button in the sidebar was wired to dispatch that event (it was previously a dead button). **Dynamic agent routing:** `GET/POST /api/agents/process` now calls `resolveDirection(agentKey)` which checks the static registry first and falls back to Firestore for `isDynamic` agents. On start, dynamic agents reuse the nearest static template worker (`sales-en` for outbound, `restaurant-es` for inbound). `POST /api/calls/test` resolves `dispatchRuleName` from Firestore for dynamic agents and passes it to LiveKit dispatch. `src/app/playground/page.tsx` switched from the static registry to `await listAgents()` so dynamically created agents appear in the Playground picker.
> - **Why:** The create-agent flow was a visual stub — clicking "Create" produced no actual agent. This change makes the onboarding moment real: a user can go from zero to a working, testable agent in under two minutes without touching Firebase or config files.
> - **Files:**
>   - `src/components/WelcomeModal.tsx` _(complete rewrite)_
>   - `src/app/api/agents/route.ts` _(new POST handler)_
>   - `src/lib/firebase/agents.ts` _(createAgent, listAgents extended to include isDynamic docs, getAgent extended for dynamic agents)_
>   - `src/app/api/agents/process/route.ts` _(resolveDirection + templateWorkerKey for dynamic agents)_
>   - `src/app/api/calls/test/route.ts` _(Firestore dispatchRuleName lookup for dynamic agents)_
>   - `src/app/playground/page.tsx` _(switched to listAgents)_
>   - `src/components/Sidebar.tsx` _(New agent button wired to open-welcome-modal event)_

---

> ### Call Usage Tracking & Cost Estimation
>
> - **What changed:** Added end-to-end usage capture and cost display for browser test calls. **Agent side:** both `sales-en` and `restaurant-es` workers write a `.agent-usage/{roomName}.json` file on `session.close` containing `{ type: "call_usage", llmModel, inputTokens, outputTokens, sttModel, sttAudioMs, ttsModel, ttsCharacters, ttsAudioMs, callDurationMs }`. The file approach replaces the previous `publishData` channel which was unreliable (LiveKit room closes before the agent publishes). **New API route** `GET /api/calls/[roomName]/usage` reads that file and returns the JSON, or 404 if not yet written. **Playground polling:** `WebTestPanel` stores the room name on connect; on disconnect it waits 2 s then polls the usage endpoint up to 5 times (1.5 s apart). `CostPanel` shows a skeleton while loading and renders the LLM/STT/TTS breakdown once usage arrives. `isCalculatingUsage` state in the parent prevents the panel from disappearing between calls. **Webhook:** `POST /api/agent` (LiveKit `room_finished` webhook) also reads the usage file on room close and persists it into the call record. **Pricing:** new `src/lib/pricing.ts` with `calculateCost()` and `formatCost()`. Model rate table covers Claude Haiku 4.5 ($0.80/$4.00 per 1M tokens), Claude Sonnet 4.6 ($3.00/$15.00), Grok grok-3-mini ($0.30/$0.50), Deepgram nova-3 ($0.0043/min), ElevenLabs Starter plan ($0.167/1k chars) with actual SDK model name keys (`eleven_turbo_v2_5`, `eleven_multilingual_v2`) for correct substring lookup.
> - **Why:** LLM, STT, and TTS costs are the primary variable cost driver. Without per-call cost visibility operators have no way to understand their margins or spot runaway usage.
> - **Files:**
>   - `src/lib/pricing.ts` _(new)_
>   - `src/app/api/calls/[roomName]/usage/route.ts` _(new)_
>   - `src/lib/agents/outbound/sales-en/agent.ts` _(usage file write on session close)_
>   - `src/lib/agents/inbound/restaurant-es/agent.ts` _(usage file write on session close)_
>   - `src/components/PlaygroundClient.tsx` _(polling, CostPanel skeleton, isCalculatingUsage state)_
>   - `src/app/api/agent/route.ts` _(usage file read + persist in call record on room_finished)_

---

> ### Call History — Token & Cost Columns
>
> - **What changed:** Added five new columns to the Call History table: **Tokens In**, **Tokens Out**, **Total Tokens**, **TTS Chars**, and **Est. Cost**. All are populated from the `usage` object stored on each call record (accurate usage data, estimated cost). The slide-over Overview tab gained a usage breakdown section with rows for LLM (input/output tokens, cost), STT (audio duration, cost), TTS (character count, cost), total estimated cost, and cost-per-minute. `usageCost()` adapter in `CallHistoryClient` bridges `CallUsage` fields to `calculateCost()` from the pricing module. Extended `CallRecord` interface with optional `usage?: CallUsage`.
> - **Why:** Usage is accurate (it comes directly from the provider SDKs); cost is estimated but close enough for operators to track spend per call and catch anomalies without leaving the call history view.
> - **Files:**
>   - `src/components/CallHistoryClient.tsx`
>   - `src/lib/history.ts` _(CallUsage interface + usage field on CallRecord)_

---

> ### Agent Name Editing — Agent Page & Sidebar
>
> - **What changed:** **Agent page:** clicking the agent name (or the pencil icon that appears on hover) switches the `<h1>` to an inline `<input>`. Enter or blur saves the new name via `PATCH /api/agents/[agentKey]`; Escape resets to the original. On save failure a toast is shown and the name reverts. **Sidebar:** each agent item gains a pencil button that appears on row hover. Clicking it opens an inline `<input>` directly in the sidebar (replacing the name span) — no navigation required. Enter or blur saves via the same PATCH endpoint; Escape cancels. On a successful save the sidebar reflects the new name optimistically via `nameOverrides` local state, and if the user is currently on that agent's detail page, `router.refresh()` is called to sync the page heading. The `"name"` field was added to `TIER1_WRITE_FIELDS` in `agents.ts` to allow it through the Firestore write allowlist.
> - **Why:** Agent names are how operators distinguish between deployments. Forcing a developer roundtrip to rename an agent is friction that kills trust in the product.
> - **Files:**
>   - `src/components/AgentClient.tsx` _(saveName callback, pencil button, Enter/Escape/blur handlers)_
>   - `src/components/Sidebar.tsx` _(inline rename input, nameOverrides state, router.refresh on page sync)_
>   - `src/lib/firebase/agents.ts` _("name" added to TIER1_WRITE_FIELDS)_

---

### 🗄️ Data & Infrastructure

---

> ### Call History Migrated to Firestore `callHistory` Collection
>
> - **What changed:** Replaced the local `call-history.json` flat file with a Firestore `callHistory` collection. `src/lib/history.ts` was completely rewritten — all five functions (`getCallHistory`, `getCallRecord`, `getAgentCallHistory`, `addCallRecord`, `updateCallRecord`) are now async and operate against Firestore. Every new document gets three additional fields: `agentId` (mirrors `agentKey` — explicit foreign key for querying), `userId` (optional, ready for when auth is added), and `createdAt` (Firestore server timestamp). All callers updated: `agent/route.ts` uses the new `getCallRecord(id)` direct-fetch instead of loading all history then finding by ID; `calls/outbound/route.ts`, `history/route.ts`, and `dashboard/route.ts` all `await` their respective calls. `updateCallRecord` is a no-op with a warning log if the document doesn't exist (guards against race conditions on the webhook path). **Migration:** new `migrateCallHistoryJson()` function in `src/lib/firebase/migration.ts` reads `call-history.json` and batch-writes records to Firestore, skipping any that already exist. The migrate endpoint (`POST /api/agents/migrate`) was extended to accept `{ target: "callHistory" | "agents" | "all" }` in the body. The two existing records were migrated and `call-history.json` has been deleted from the repository.
> - **Why:** A local JSON file breaks in any multi-instance or serverless deployment, is lost on a redeploy, and can't be queried. Firestore gives durable, queryable, per-tenant storage — a necessary foundation before adding user auth and multi-tenant data isolation.
> - **Files:**
>   - `src/lib/history.ts` _(complete rewrite — Firestore, async, agentId/userId/createdAt)_
>   - `src/lib/firebase/migration.ts` _(migrateCallHistoryJson added)_
>   - `src/app/api/agents/migrate/route.ts` _(extended to support target: "callHistory" | "all")_
>   - `src/app/api/agent/route.ts` _(getCallRecord + await updateCallRecord)_
>   - `src/app/api/calls/outbound/route.ts` _(await addCallRecord)_
>   - `src/app/api/history/route.ts` _(all functions awaited)_
>   - `src/app/api/dashboard/route.ts` _(await getCallHistory)_
>   - `call-history.json` _(deleted — data migrated to Firestore)_

---

## 🗓️ **2026-05-22**

---

### 🧠 Prompt Architecture

---

> ### Consolidate Instructions to Five Fields — Remove Duplicate Voice Scaffolding
>
> - **What changed:** Eliminated the "Voice behavior rules" field from the Instructions tab and moved all platform-level voice scaffolding into a hardcoded constant that is assembled server-side on every call. The tab now shows exactly five fields in a fixed order: **What it does** (required, 8 000 chars), **How it talks** (4 000), **What to avoid** (4 000), **Anything else** (4 000), **Opening line** (500, required only for outbound agents). **Character counters** appear right-aligned below each textarea, turning amber at 90 % capacity and red when the limit is exceeded. Saving is blocked when a required field is empty or a field exceeds its limit; all fields are whitespace-trimmed before saving. **Backend prompt assembly:** new `src/lib/agents/promptBuilder.ts` exports `PLATFORM_VOICE_RULES` (the constant previously stored per-agent as `voiceInstructions`) and `buildSystemPrompt()`, which prepends the platform rules then appends the four section fields with `[BRACKETED HEADERS]`. `voiceGreeting` is a separate utterance, not part of the system prompt. **Dynamic dispatch:** `POST /api/calls/inbound` and `POST /api/calls/test` now fetch the agent's Firestore data, call `buildSystemPrompt()`, and pass `{ systemPrompt, voiceGreeting }` in the LiveKit dispatch metadata so each call uses the latest saved instructions without an agent restart. Both agent worker processes (`restaurant-es`, `sales-en`) read `ctx.job.metadata` at call entry and fall back to their static prompts if metadata is absent. **Compiled-prompt preview:** new `GET /api/agents/[agentKey]/compiled-prompt` endpoint returns the fully assembled prompt as plain text; the Instructions tab surfaces this via a "Preview what your agent sees" link that opens a read-only modal with `[HEADER]` syntax highlighting and a Copy button. **Migration backfill:** new `src/lib/firebase/migration.ts` parses legacy agents whose `voiceInstructions` field contains `[BRACKETED HEADERS]` into the four section fields; agents with free-form `voiceInstructions` have it copied verbatim into `additionalInstructions`; already-populated agents are skipped; `migrationApplied: true` is set on affected documents. New `POST /api/agents/migrate` endpoint (requires `INTERNAL_API_SECRET`) runs the migration safely. A dismissible blue banner is shown on migrated agents until the user saves or clicks × (clearing the server flag via a follow-up PATCH). `voiceInstructions` is never modified — it remains as dormant historical data.
> - **Why:** Two editable surfaces pointing at overlapping content is the fastest way to lose user trust. An SMB owner will edit one field, see behavior not change, and conclude the product is broken. Five fields with a clear mental model — what the agent does, how it talks, what to avoid, anything extra, opening line — can be understood in 30 seconds without reading docs.
> - **Files:**
>   - `src/lib/agents/promptBuilder.ts` _(new)_
>   - `src/lib/firebase/migration.ts` _(new)_
>   - `src/app/api/agents/[agentKey]/compiled-prompt/route.ts` _(new)_
>   - `src/app/api/agents/migrate/route.ts` _(new)_
>   - `src/components/AIJobDescriptionTab.tsx`
>   - `src/lib/firebase/agents.ts` _(migrationApplied field, voiceGreeting max → 500)_
>   - `src/app/api/calls/inbound/route.ts`
>   - `src/app/api/calls/test/route.ts`
>   - `src/lib/agents/inbound/restaurant-es/agent.ts`
>   - `src/lib/agents/outbound/sales-en/agent.ts`
>   - `.env.example`

---

### 🐛 Fixes

---

> ### Playground — Instructions Preview Shows Full Compiled Prompt
>
> - **What changed:** The collapsed instructions preview in the Playground left pane now renders each of the four prompt sections as a distinct labeled row (section name in small-caps muted text, content in a 2-line clamp below it, rows separated by dividers) instead of a flat text blob with raw `[BRACKETED HEADERS]`. Only non-empty sections are rendered. The "Edit in sandbox" toggle label was renamed to "Edit" and the page subtitle was updated from "Edits here are sandboxed" to "Changes you make here are saved immediately" — all sandbox terminology removed from user-facing copy.
> - **Why:** The previous preview showed the raw `[ROLE AND RESPONSIBILITIES]\n…` concatenation directly, which was hard to scan and exposed implementation-level header syntax to users. The labeled-section layout makes it immediately clear which part of the prompt each block of text belongs to.
> - **Files:**
>   - `src/components/PlaygroundClient.tsx`

---

> ### Compiled-Prompt Preview — Fix "Failed to Load" Error
>
> - **What changed:** The "Preview what your agent sees" modal was always displaying "Failed to load compiled prompt." instead of the assembled prompt text. Root cause: `GET /api/agents/[agentKey]/compiled-prompt` had no error handling — any exception during `getAgent()` or `buildSystemPrompt()` caused an unhandled 500 that the modal's `!res.ok` guard caught and converted to the error message. Additionally, the response was built with `new NextResponse(string, headers)` which is unreliable for `text/plain` bodies in the Next.js App Router. Fix: wrapped the entire handler in try-catch with a `console.error` fallback, and switched the success response to `new Response(string, { status: 200, headers })` (standard Web API constructor) for predictable text/plain handling.
> - **Why:** The preview modal is the primary way users verify what their agent actually hears before going live; a perpetual error state made it completely unusable.
> - **Files:**
>   - `src/app/api/agents/[agentKey]/compiled-prompt/route.ts`

---

> ### Instructions Tab — Pull Existing Prompt Data from Firestore Legacy Field
>
> - **What changed:** `getAgent()` now applies a two-tier fallback when the four individual section fields (`roleAndResponsibilities`, `personaLanguageAndTone`, `mistakesToAvoid`, `additionalInstructions`) are all empty in Firestore. **Tier 1 — `voiceInstructions` parse:** if the agent document has a `voiceInstructions` value containing `[ROLE AND RESPONSIBILITIES]` headers (the old monolithic prompt format), the content is split on the fly into the four section fields using the same `extractSection` regex already used by the migration backfill. No Firestore write occurs — the parsed data is returned in memory so the UI renders the agent's real instructions immediately. When the user saves, the values are written to the proper individual fields; subsequent loads read them directly without the fallback. **Tier 2 — filesystem parse:** if `voiceInstructions` is also absent, `getAgent()` reads and parses the agent's static `prompt.ts` file from disk as a last resort. Both fallbacks were added to `src/lib/firebase/agents.ts` alongside the new `extractSection` and `readPromptFromFilesystem` helpers (previously duplicated across `prompt/route.ts` and `migration.ts`).
> - **Why:** Agents whose prompts were saved through the old UI path had their full content in the `voiceInstructions` field with bracketed section markers, not in the individual fields the new Instructions tab reads. Without this fallback, the tab showed blank placeholders instead of the agent's actual instructions.
> - **Files:**
>   - `src/lib/firebase/agents.ts`

---

### 🔌 Integrations

---

> ### Firebase Integration — Agent Voice Configuration
>
> - **What changed:** Wired the entire agent read/write path to the existing Firestore `agents/{agentKey}` collection. **Data layer:** new `src/lib/firebase/admin.ts` (server-only Admin SDK singleton) and `src/lib/firebase/agents.ts` — the single module that knows the Firestore schema. Exports `listAgents()`, `getAgent()`, `updateAgentConfig()` (with stale-version conflict detection via `updatedAt` comparison), and `setAgentLiveStatus()`. A `TIER1_WRITE_FIELDS` allowlist enforces that only prompt and voice-settings fields can be written from the UI; all other Firestore fields are preserved via `set({merge:true})`. **API routes:** new `GET /api/agents/[agentKey]` returns full merged agent data; new `PATCH /api/agents/[agentKey]` accepts any Tier-1 payload (routes single-field `voiceEnabled` to the fast live-status path, everything else to the validated update path). Updated `GET/POST /api/agents/[agentKey]/prompt` — GET now reads Firestore first with filesystem fallback for un-migrated agents; POST writes to Firestore only. Updated `GET /api/agents` to list from Firestore. **Server components:** `layout.tsx` and `page.tsx` are now async and call `listAgents()` on every request so the sidebar reflects live `voiceEnabled` status. Agent detail page fetches full `AgentFullData` from Firestore and passes it to the client component. **`AgentClient`:** accepts `AgentFullData` instead of `AgentConfig`. Live/Paused toggle now writes `voiceEnabled` to Firestore with an optimistic update that reverts cleanly on failure. Shows a live-agent warning banner ("Changes apply to the next call") when enabled. Displays "Last edited X ago by Y" audit label from `updatedAt` / `updatedByName`. **`InstructionsTab` (AIJobDescriptionTab):** added `voiceGreeting` (Opening line) and `voiceInstructions` (Voice behavior rules) fields. Full dirty-state tracking (`original` vs `current`); sticky "You have unsaved changes" bar at the bottom with Discard / Save changes actions; `beforeunload` guard when navigating away. Validation: `roleAndResponsibilities` is required. On 409 conflict from the server a modal offers "Reload latest" or "Overwrite anyway". **`VoiceBehaviorTab`** (new): Voice & Behavior tab with Language, Voice type, Voice ID, and STT language selectors; collapsible Advanced section for STT model, TTS model, and LLM model. Same dirty-state + stale-version conflict pattern as the Instructions tab. Sidebar status dots updated from phone-number presence to `voiceEnabled`.
> - **Why:** Every prompt or voice change previously required editing raw Firestore documents in the Firebase Console — a developer task. This integration is what turns the redesigned UI into a working product for non-technical SMB owners.
> - **Files:**
>   - `src/lib/firebase/admin.ts` _(new)_
>   - `src/lib/firebase/agents.ts` _(new)_
>   - `src/app/api/agents/[agentKey]/route.ts` _(new)_
>   - `src/components/VoiceBehaviorTab.tsx` _(new)_
>   - `src/app/api/agents/[agentKey]/prompt/route.ts`
>   - `src/app/api/agents/route.ts`
>   - `src/app/layout.tsx`
>   - `src/app/page.tsx`
>   - `src/app/agents/[direction]/[agentKey]/page.tsx`
>   - `src/components/AgentClient.tsx`
>   - `src/components/AIJobDescriptionTab.tsx`
>   - `src/components/Sidebar.tsx`
>   - `src/lib/agents/registry.ts`
>   - `.env.example`

---

### 💬 Microcopy & Tone

---

> ### Plain-English Copy Pass
>
> - **What changed:** Audited every user-visible string and rewrote anything jargon-heavy, vague, or technically cold. **Instructions tab:** "Changes take effect after restarting the agent" → "Changes are live in a few seconds"; "Save changes" → "Save"; saved state now reads "Saved ✓"; error toast becomes "Couldn't save your instructions — check your connection and try again"; AI suggestion stub → "AI suggestions are on the way — we'll let you know." **Agent header:** "Test agent" button → "Try it out"; kebab stub toasts → "… is coming soon — we're working on it"; toggle-failure toast → "Couldn't update the agent — try again in a moment"; Go Live dialog description reworded to "Your agent will start answering real incoming calls right away. Give it a quick test first if you haven't already." **Test panel:** panel heading "Test call" → "Try it out"; "Test via your browser microphone — no phone call needed" → "Talk to your agent directly — no phone number needed"; "Connect microphone" → "Start talking"; "Connected" → "You're live"; outbound helper → "We'll call you so you can hear your agent in action"; placeholder → "+1 (555) 000-0000"; eliminated a native `alert()` call (replaced with `console.error`). **Test Call modal:** header label "Test Call in Progress" → "Listening in"; clipboard toast → "Transcript copied"; report-issue toast → "Got it — we'll take a look"; connection-failure toast → "Couldn't connect to the call — check your network and try again." **Playground:** banner "Unsaved sandbox changes" → "Unsaved changes"; "Save to agent" → "Save"; success toast → "Saved — changes are live in a few seconds"; error toast → "Couldn't save — check your connection and try again."
> - **Why:** Copy is design. Jargon and passive-voice errors make an otherwise polished UI feel unfinished; plain, warm copy builds trust faster than any visual polish.
> - **Files:**
>   - `src/components/AIJobDescriptionTab.tsx`
>   - `src/components/AgentClient.tsx`
>   - `src/components/TestCallPanel.tsx`
>   - `src/components/TestCallModal.tsx`
>   - `src/components/PlaygroundClient.tsx`

---

### ✨ Features

---

> ### Mobile-Responsive Layout
>
> - **What changed:** Made the entire product usable on phones. **Bottom tab bar:** reduced `MOBILE_TABS` to 3 items (Home, Agents, Calls) and added a "More" tap target that opens the full slide-out drawer; `AppLayout` wires the new `onMobileOpen` prop into the Sidebar so the button works from any route. **Tables → cards:** Dashboard Recent Calls and Call History both render a card view on mobile (`sm:hidden`) and the existing tables on desktop (`hidden sm:block`); cards surface direction, phone number, outcome, agent name, duration, and sentiment in a compact two-row layout without horizontal scroll. **Modals → full-screen sheets:** `Dialog` gained a `mobileSheet` boolean prop; when set, the overlay pins `items-end` and the inner panel slides up from the bottom with `rounded-t-2xl`. `TestCallModal` uses `mobileSheet` with `h-[92vh]` so the transcript fills the screen. **Two-column transcript → tab view:** on mobile the side-by-side Original/Translation grid (`hidden sm:grid`) is swapped for a tab toggle (`sm:hidden`) that drives a `mobileTxTab` state (`"original" | "translation"`) switching a single full-width column — desktop behavior is unchanged. **Settings responsive:** all `grid grid-cols-2` layouts in Profile, Workspace, and Billing made responsive (`grid-cols-1 sm:grid-cols-2`). The Settings left-rail sub-nav converts to a horizontally scrollable chip row on mobile and a vertical rail on desktop. Team members table wrapped in `overflow-x-auto` to prevent viewport overflow. **Main content:** `AppLayout` adds `pb-24 lg:pb-8` so content is never obscured by the mobile tab bar.
> - **Why:** SMB owners check dashboards, skim call history, and read transcripts on their phones — they need visibility even when they're not at a desk.
> - **Files:**
>   - `src/components/AppLayout.tsx` _(bottom-bar padding + onMobileOpen prop)_
>   - `src/components/Sidebar.tsx` _(3-tab bar + More button)_
>   - `src/components/DashboardClient.tsx` _(table → mobile cards)_
>   - `src/components/CallHistoryClient.tsx` _(table → mobile cards)_
>   - `src/components/TestCallModal.tsx` _(mobileSheet + tab transcript)_
>   - `src/components/ui/dialog.tsx` _(mobileSheet prop)_
>   - `src/app/settings/layout.tsx` _(horizontal scroll nav on mobile)_
>   - `src/app/settings/profile/page.tsx` _(responsive grid)_
>   - `src/app/settings/workspace/page.tsx` _(responsive grid)_
>   - `src/app/settings/billing/page.tsx` _(responsive grids)_
>   - `src/app/settings/team/page.tsx` _(overflow-x-auto on members table)_

---

> ### Onboarding & Empty States
>
> - **What changed:** Added three interconnected first-run surfaces. **Welcome modal:** appears automatically on first login (guards on `localStorage` key `"onboarding-done"`); 3 steps — (1) purpose picker (Answer calls / Make calls / Both) with icon cards, (2) industry picker (Restaurant / Clinic / Agency / Other) with emoji tiles, (3) language picker (English / Spanish / French / Other). On "Generate my agent" a 1.8 s animated progress bar plays, then the "done" view surfaces a Bot icon, a reassuring confirmation, and a "Test it in Playground →" CTA. Backdrop click or the × button skips and marks onboarding complete. The modal can also be re-triggered from anywhere via `window.dispatchEvent(new CustomEvent("open-welcome-modal"))`. **Setup checklist widget:** floating `fixed bottom-6 right-6` card (w-72) that persists until explicitly dismissed. Shows 5 steps: Create your first agent (auto-checked when `agents.length > 0`), Test in Playground, Assign a phone number, Make your first real call, Invite a teammate. Each uncompleted step with an href is a `<Link>` with an arrow indicator and marks itself complete on click. Completed steps show strikethrough + check icon. The progress bar fills as steps complete and turns green when all done; an all-done state swaps the header and surfaces a dismiss prompt. Step state persists to `localStorage` keys `"setup-checklist-checked"` and `"setup-checklist-dismissed"`. **Empty state CTAs:** every listless view now has an actionable CTA — dashboard Recent Calls (→ "Try a test call"), dashboard Agents panel (→ opens welcome modal), Call History table when unfiltered (→ "Try a test call in Playground"), and the existing First Run dashboard state (→ now dispatches `open-welcome-modal` event instead of being a dead button). Both new components are injected at the `AppLayout` level so they appear on every route without page-level plumbing.
> - **Why:** Activation is the #1 commercial metric for SMB SaaS. If a new user doesn't make a test call in session one they almost certainly won't convert — this feature closes the gap between sign-up and the "I just heard my AI work" moment in under 10 minutes.
> - **Files:**
>   - `src/components/WelcomeModal.tsx` _(new)_
>   - `src/components/SetupChecklist.tsx` _(new)_
>   - `src/components/AppLayout.tsx` _(injects both components)_
>   - `src/components/DashboardClient.tsx` _(FirstRunState + AgentsPanel + RecentCallsPanel empty state CTAs)_
>   - `src/components/CallHistoryClient.tsx` _(empty table CTA when unfiltered)_

---

> ### User Profile, Settings & Logout
>
> - **What changed:** Added a full settings area at `/settings` with a persistent left-rail sub-navigation (Profile / Workspace / Notifications / Billing / Team / API & Integrations). **Profile:** avatar initials display with change-photo stub, editable name + email, change-password form with show/hide toggles, and a two-factor authentication toggle (Switch component). **Workspace:** business name + logo preview (initials-driven), timezone selector, default language selector. **Notifications:** three sections (Email / SMS / In-app) each with named toggles for specific event types (failed calls, missed calls, daily summary, weekly report, mentions). **Billing:** current plan card with feature checklist and usage progress bar (color shifts warning → destructive as usage climbs), inline payment-method update form with card fields, invoices table with per-row PDF download stub. **Team:** invite-a-member form (email + role select + Enter key support), members table with per-row role-badge, status pill (Active/Invited), a contextual menu (promote/demote + remove) with inline confirmation, owner row is non-removable. **API & Integrations:** API key display with reveal/hide toggle, copy-to-clipboard, and 2-step regenerate; integrations list (Twilio, LiveKit, OpenAI, Deepgram connected; HubSpot, Zapier disconnected) with connect/disconnect toggles. **Avatar dropdown:** the user row in the sidebar footer now opens a floating dropdown above it with a "Settings" link (→ `/settings/profile`) and a two-step "Log out" confirmation (first click shows inline "Are you sure?" with Cancel/Confirm buttons; clicking outside resets both). Updated the Account secondary nav (Integrations, Team, Billing) to point to the correct `/settings/…` sub-pages instead of dead routes.
> - **Why:** Account management, team access control, and billing visibility are table-stakes for any SaaS product; without them the product feels unfinished and operators can't self-serve changes to their workspace.
> - **Files:**
>   - `src/app/settings/layout.tsx` _(new — left-rail sub-nav)_
>   - `src/app/settings/page.tsx` _(new — redirect to /settings/profile)_
>   - `src/app/settings/profile/page.tsx` _(new)_
>   - `src/app/settings/workspace/page.tsx` _(new)_
>   - `src/app/settings/notifications/page.tsx` _(new)_
>   - `src/app/settings/billing/page.tsx` _(new)_
>   - `src/app/settings/team/page.tsx` _(new)_
>   - `src/app/settings/api/page.tsx` _(new)_
>   - `src/components/Sidebar.tsx` _(avatar dropdown + secondary nav hrefs)_

---

> ### Call History — Promoted to Its Own Section
>
> - **What changed:** Promoted call history from a buried panel inside the agent detail page to a first-class top-level route at `/calls` (already wired in the sidebar as "Call History"). New `CallHistoryClient` renders a filterable, sortable, exportable table of all calls across every agent. **Filters:** search by phone number or agent name, date range (today / yesterday / 7 days / 30 days / all time), agent, direction (inbound / outbound), outcome (completed / missed / dropped / transferred / failed), and sentiment. **Saved views:** any filter combination can be saved as a named pill (up to 8, persisted in `localStorage`) with a delete affordance on hover. **Table columns:** Time (relative + absolute), Agent, Caller/Recipient, Direction icon, Duration, Outcome badge, Sentiment icon, Quick actions (Play, Transcript). All columns are sortable ascending/descending. **Bulk actions:** row checkboxes + select-all; bulk Export CSV and Archive (removes from view, marks archived in history file). **Slide-over detail panel:** row click opens a fixed 480 px drawer (backdrop closes it); three tabs — Overview (metadata grid, sentiment score bar, recording stub), Transcript (stored transcript rendered as chat bubbles, empty state if none), AI Summary (fetches `/api/calls/summary` on first open, shows bullets / sentiment bar / action items). Extended the `CallRecord` interface with optional `direction`, `outcome`, `sentiment`, `sentimentScore`, `transcript`, `tags`, `archived`, and `endTime` fields (fully backward-compatible). Updated `GET /api/history` to return all non-archived records (up to 500, sorted desc) when no `agent` query param is provided. Added `PATCH /api/history` for bulk archive.
> - **Why:** Ops-minded SMB owners live in call history — they audit what went wrong, catch missed calls, and spot trends. Burying it inside per-agent pages made that impossible.
> - **Files:**
>   - `src/app/calls/page.tsx` _(new)_
>   - `src/components/CallHistoryClient.tsx` _(new)_
>   - `src/lib/history.ts` _(extended interface)_
>   - `src/app/api/history/route.ts` _(updated GET + new PATCH)_

---

### 💅 Styling and UI Improvements

---

> ### Test Call Modal — Live Phone Monitoring
>
> - **What changed:** Rewrote `TestCallModal` as a full-featured ~900 px (80 vh) call-monitoring experience. **Header:** live call duration timer + animated status dot (Dialing → Ringing → Connected → Ended). Inline end-call confirmation replaces the close button while a call is active to prevent accidental dismissal. **Dial progress strip:** three-step indicator (Dialing → Ringing → Connected) that auto-advances (2 s to ringing, then on `RoomEvent.Connected` from LiveKit). **Two-column transcript:** agent utterances left, caller right, scrollable with a "Jump to latest" pill that appears when scrolled more than 80 px from bottom. **Language selector stub:** English active, Spanish/Arabic/French disabled with "(coming soon)". **Post-call summary:** AI-generated via new `/api/calls/summary` (Gemini `gemini-3-flash-preview`) — 3 bullet points, sentiment badge with 0–100 score bar, up to 5 action items as a checklist, full transcript scroll, and CTAs (Done, Share transcript, Report issue). The modal uses `livekit-client` Room in observer mode (`audio: false`) so it can monitor the phone call without injecting audio. On `RoomEvent.Disconnected` it fetches the summary and transitions to the summary view. Added `/api/calls/summary` as a new route. Wired modal into `PhoneTestPanel` in `PlaygroundClient`: on successful outbound call dispatch, the API response `roomName` is extracted, stored, and the modal opens automatically.
> - **Why:** Gives operators visibility into exactly how the phone call is progressing without needing a separate dashboard tab — the modal turns the "black box" phone call into an observable, auditable interaction.
> - **Files:**
>   - `src/components/TestCallModal.tsx` _(rewritten)_
>   - `src/app/api/calls/summary/route.ts` _(new)_
>   - `src/components/PlaygroundClient.tsx` _(wired modal into PhoneTestPanel)_

---

> ### Playground — Dedicated Testing Environment
>
> - **What changed:** Added `/playground` as a first-class route (wired to the existing sidebar link). Three-pane layout: **Left** — agent picker dropdown + collapsed read-only instructions preview with an "Edit in sandbox" toggle that expands into four editable textareas; a yellow "Unsaved sandbox changes" banner with Save-to-agent / Discard actions appears whenever the sandbox diverges from saved state. **Center** — mode tabs ("Web test" / "Phone test"); Web test uses browser mic via LiveKit (same connect/dispatch flow as the old TestCallPanel, remounts on agent change); Phone test shows a country-code selector + phone-number input + "Call me" button for outbound agents, or a "Call this number" instruction card for inbound agents. Session history panel below shows the last 5 sessions per agent (stored in `localStorage`). **Right** — docked live transcript panel (same streaming handler as TestCallPanel, lifted to parent state so transcript is visible across panes), copy button, translation support for `restaurant-es`. Empty state shown when no agents are configured.
> - **Why:** Separating testing from agent config removes the fear of breaking production — users can iterate rapidly in the sandbox before going live.
> - **Files:**
>   - `src/app/playground/page.tsx` _(new)_
>   - `src/components/PlaygroundClient.tsx` _(new)_

---

> ### Agent Detail Page — Business-Owner-Friendly Redesign
>
> - **What changed:** Overhauled the agent detail page from a developer-style config view to a plain-English business tool. Header: inline editable agent name (click to rename), `description` subtitle, direction badge renamed "Answers calls" / "Makes calls" (with PhoneIncoming/Outgoing icons), status renamed "Live" / "Paused", "Test agent" shortcut link, and a kebab menu (Duplicate, Export config, View logs, Delete — stubs). Going Live now requires a confirmation modal ("This will start accepting real calls…"). TestCallPanel removed from the right sidebar; replaced with a **Recent activity** panel showing active calls with elapsed timers and the last 8 call records with relative timestamps and status badges. Tabs renamed: "Voice & Behavior" (was Settings), "Tools & Actions" (was Actions), "Phone & Channels" (was Connect). Instructions tab sections renamed to plain English: "What it does", "How it talks", "What to avoid", "Anything else" — each with a helper line, a filled placeholder, and an **Improve with AI** stub button (shows an info toast). Fixed the `; ` artifact that appeared in the Additional Instructions field (the regex was capturing the closing TS template literal characters; stripped in `extractSection`). Replaced `alert()` with toast calls throughout. Added `ToastProvider` to `AppLayout` so all pages can use `useToast`.
> - **Why:** Non-technical users could not confidently use the old page; jargon ("AI Job Description", "Outbound", "Running/Stopped") was a trust barrier at SMB pricing.
> - **Files:**
>   - `src/components/AgentClient.tsx` _(rewritten)_
>   - `src/components/AIJobDescriptionTab.tsx` _(updated — export renamed `InstructionsTab`)_
>   - `src/components/AppLayout.tsx`
>   - `src/app/agents/[direction]/[agentKey]/page.tsx`
>   - `src/app/api/agents/[agentKey]/prompt/route.ts`

---

> ### Design System & Visual Language
>
> - **What changed:** Established a full light-mode design system. Set brand tokens in `globals.css` — primary `#2563EB`, page background `#F7F8FA`, card `#FFFFFF`, plus semantic `--success`, `--warning`, `--destructive`. Switched font from Geist to Inter via `next/font/google`. Created 13 new UI primitives in `src/components/ui/`: button (CVA variants/sizes), card, input, textarea, select, badge, avatar, skeleton, separator, dialog (portal), tabs, table, toast (auto-dismiss), and empty-state. Converted all feature components (`AgentCard`, `AgentClient`, `TestCallPanel`, `AIJobDescriptionTab`, `TestCallModal`) to light mode using CSS-variable token classes. Fixed a circular font reference (`--font-sans: var(--font-sans)` → `var(--font-inter)`).
> - **Why:** SMB pricing ($99–$499/month) requires perceived enterprise quality; establishes the token baseline all subsequent work depends on.
> - **Files:**
>   - `src/app/globals.css`
>   - `src/app/layout.tsx`
>   - `src/components/ui/button.tsx` _(new)_
>   - `src/components/ui/card.tsx` _(new)_
>   - `src/components/ui/input.tsx` _(new)_
>   - `src/components/ui/textarea.tsx` _(new)_
>   - `src/components/ui/select.tsx` _(new)_
>   - `src/components/ui/badge.tsx` _(new)_
>   - `src/components/ui/avatar.tsx` _(new)_
>   - `src/components/ui/skeleton.tsx` _(new)_
>   - `src/components/ui/separator.tsx` _(new)_
>   - `src/components/ui/dialog.tsx` _(new)_
>   - `src/components/ui/tabs.tsx` _(new)_
>   - `src/components/ui/table.tsx` _(new)_
>   - `src/components/ui/toast.tsx` _(new)_
>   - `src/components/ui/empty-state.tsx` _(new)_
>   - `src/components/AgentCard.tsx`
>   - `src/components/AgentClient.tsx`
>   - `src/components/TestCallPanel.tsx`
>   - `src/components/AIJobDescriptionTab.tsx`
>   - `src/components/TestCallModal.tsx`

---

### ✨ Features

---

> ### Left Sidebar Navigation
>
> - **What changed:** Replaced the bare root layout with a persistent app shell. `AppLayout` (client component) owns `collapsed` + `mobileOpen` state. `Sidebar` renders at 240 px expanded / 64 px icon-only rail with a workspace switcher, primary nav (Dashboard, Agents expandable with per-agent sub-items + status dots, Playground, Calls, Numbers, Knowledge, Analytics), secondary nav (Integrations, Team, Billing), and a footer (Help & Docs, User). Collapsed icons show CSS hover tooltips. Agents section auto-expands on agent routes. Mobile: full-width slide-out drawer + fixed 4-tab bottom bar. `TopBar` (h-14) adds a PanelLeft collapse toggle (desktop), hamburger (mobile), breadcrumbs, and a ⌘K search placeholder. `layout.tsx` resolves `agents` from the registry server-side and passes them as props so agent sub-items render on first paint without client env var reads.
> - **Why:** Provides consistent wayfinding and collapses to an icon rail so agents have maximum working area.
> - **Files:**
>   - `src/components/AppLayout.tsx` _(new)_
>   - `src/components/Sidebar.tsx` _(new)_
>   - `src/components/TopBar.tsx` _(new)_
>   - `src/components/Breadcrumbs.tsx`
>   - `src/app/layout.tsx`

---

> ### Dashboard — KPIs, Live Activity & Recent Calls
>
> - **What changed:** Replaced the agent-list home page with a full dashboard. New `GET /api/dashboard` aggregates call history into KPI stats (calls today, avg. duration, success rate — each with % trend vs. prior 24 h) and 7-day sparkline arrays. `DashboardClient` renders: time-based greeting + CTA; 4 KPI cards with SVG sparklines and trend chips; live activity panel polling `/api/rooms/active` every 4 s with elapsed-time counters; recent calls table with relative timestamps and status badges; compact agents panel with Live / Paused / Draft status pills and per-agent Test buttons; first-run empty state (3-step illustrated flow) when no agents exist. Three independent polling intervals (4 s / 8 s / 30 s) are cleaned up on unmount.
> - **Why:** Gives operators an at-a-glance health view without navigating per-agent pages; live panel surfaces active calls the moment they start.
> - **Files:**
>   - `src/app/api/dashboard/route.ts` _(new)_
>   - `src/components/DashboardClient.tsx` _(new)_
>   - `src/app/page.tsx`

---

## 🗓️ **2026-03-14**

---

### ✨ Features

---

> ### AI Job Description Tab UI (4 Editable Prompt Sections)
>
> - **What changed:** Built a new UI for the "AI Job Description" tab on the agent detail page. Created `GET /api/agents/[agentKey]/prompt` to read the agent's `prompt.ts` file from disk and split it into four sections based on markers: `[ROLE AND RESPONSIBILITIES]`, `[PERSONA LANGUAGE AND TONE]`, `[MISTAKES TO AVOID]`, and `[ADDITIONAL INSTRUCTIONS]`. Created `POST /api/agents/[agentKey]/prompt` to reassemble the strings and save it back to disk. Rendered these 4 sections in expanding textareas that autogrow. Added a Save Changes button and loading skeletons. Added section markers to the existing prompts for `sales-en` and `restaurant-es`.
> - **Why:** To allow users to directly modify an agent's system prompt in structured logical sections via the dashboard without needing to edit the raw TypeScript files. Changes take effect on the next agent restart.
> - **Files:**
>   - `src/lib/agents/inbound/restaurant-es/prompt.ts`
>   - `src/lib/agents/outbound/sales-en/prompt.ts`
>   - `src/app/api/agents/[agentKey]/prompt/route.ts` _(new)_
>   - `src/components/AIJobDescriptionTab.tsx` _(new)_
>   - `src/components/AgentClient.tsx`

---

## 🗓️ **2026-03-15**

---

### ✨ Features

---

> ### Agent Detail Page — Two-Column Layout with Persistent Test Call Sidebar
>
> - **What changed:** Rebuilt the agent detail page from a single-column layout with a modal into a permanent two-column grid. Left column (65%) contains the page header, five URL-state tabs (`?tab=`), tab content placeholders, Active Calls, and Call History. Right column (35%, 420px) holds a sticky `TestCallPanel` that is always visible. The old `TestCallModal` component was deleted. Inbound agents show the browser mic connect flow in the sidebar; outbound agents show the phone dial UI. Tab selection is preserved on refresh via `?tab=` search param using `useSearchParams` + `useRouter`. `Suspense` boundary added in `page.tsx` to satisfy Next.js requirements for `useSearchParams` in client components.
> - **Why:** Mirrors how professional voice AI platforms are structured — configuration on the left, live testing on the right — so you can edit a prompt and immediately test it without navigating away or opening a modal.
> - **Files:**
>   - `src/components/AgentClient.tsx` _(rewritten)_
>   - `src/components/TestCallPanel.tsx` _(new)_
>   - `src/components/TestCallModal.tsx` _(deleted)_
>   - `src/app/agents/[direction]/[agentKey]/page.tsx`

---

> ### Agent Activate/Deactivate Toggle Switch
>
> - **What changed:** Replaced the "Start Agent" / "Stop Agent" text buttons with a shadcn `Switch` component (green when active, grey when inactive) labelled "Active" / "Inactive". Initialized shadcn/ui with `@base-ui/react` and added the Switch component.
> - **Why:** A toggle switch communicates binary on/off state more clearly than text buttons and matches the production-monitoring intent of the control.
> - **Files:**
>   - `src/components/AgentClient.tsx`
>   - `src/components/ui/switch.tsx` _(new)_

---

### 🐛 Fixes

---

> ### Fix `jose` Module Not Found Build Error
>
> - **What changed:** Added `"livekit-server-sdk"` to `serverExternalPackages` in `next.config.ts`.
> - **Why:** `livekit-server-sdk` imports `jose` (a Node.js crypto library) which cannot be bundled for the browser. Marking it as a server external package prevents Next.js/Turbopack from attempting to include it in client bundles.
> - **Files:**
>   - `next.config.ts`

---

> ### Fix Agent Not Starting on Playground Test Call
>
> - **What changed:** Added an agent process start (`POST /api/agents/process` with `action: "start"`) at the beginning of `connectToAgent` in `InboundTestPanel` and `handleCall` in `OutboundCallPanel`, before the LiveKit token or outbound call requests. Added agent process stop on LiveKit `onDisconnected` in the inbound panel.
> - **Why:** The agent process was not running when users clicked "Connect Microphone", so no agent joined the test room. The process is now auto-started on call initiation and auto-stopped when the call ends, keeping playground calls self-contained and independent of the production toggle.
> - **Files:**
>   - `src/components/TestCallPanel.tsx`

---

> ### Fix EPIPE Crash on Agent Stop
>
> - **What changed:** Changed `child.kill()` to `child.kill("SIGINT")` in the agent process stop handler.
> - **Why:** `SIGTERM` (the default) abruptly terminates the main agent process while LiveKit's worker IPC is still active, causing worker subprocesses to crash with `Error: write EPIPE` when they try to send a message to the now-dead parent. `SIGINT` gives the LiveKit agent framework time to shut down worker processes cleanly before the main process exits.
> - **Files:**
>   - `src/app/api/agents/process/route.ts`

---

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
