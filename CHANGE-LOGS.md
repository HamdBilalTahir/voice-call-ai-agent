## 🗓️ **2026-06-02**

---

### ✨ Features

---

> ### Sarah Agent — Speaking Character Block Added to Persona
>
> - **What changed:** A "Speaking Character" section was prepended to Sarah's `personaLanguageAndTone` field in Firestore. It defines her character (warm, attentive, professional without being stiff), her natural vocabulary ("absolutely", "of course", "happy to help", "let me just check that"), natural connectors ("you know", "actually", "look"), and corporate filler to avoid ("certainly", "indeed", "I apologize for any inconvenience"). Her existing intent framework, education tone calibration, pacing rules, and response structure are untouched.
> - **Why:** The improved `PLATFORM_VOICE_RULES` baseline handles mechanics (contractions, mirroring, pacing). The persona layer handles character and word-choice — the two are cleanly separated so they don't contradict each other.
> - **Files:**
>   - Firestore: `agents/gZpvYpAgmk9WShjXqF8G` _(personaLanguageAndTone: Speaking Character block prepended)_

---

> ### Platform Voice Rules — Human Speech Defaults Improved
>
> - **What changed:** `PLATFORM_VOICE_RULES` in `promptBuilder.ts` expanded from a single sentence into a structured `[VOICE AND SPEECH RULES]` block that covers: always-on contractions, natural filler words and acknowledgments (`umm`, `uh`, `yeah`, `right`, `I see`, `got it`), natural sentence openers (`So,`, `Actually,`, `Look,`, `Here's the thing —`), occasional self-correction (`I mean —`, `wait, actually —`), energy mirroring to the caller's mood, natural pacing with pauses after questions, and hard-stop on interruption.
> - **Why:** The previous rule block only mentioned "natural filler phrases like umm or let me think sparingly". Without explicit guidance, the model defaults to robotic, over-formal speech. The expanded ruleset gives every agent a human-feeling baseline that persona instructions can then layer on top of.
> - **Files:**
>   - `src/lib/agents/promptBuilder.ts` _(PLATFORM_VOICE_RULES: single-sentence → structured [VOICE AND SPEECH RULES] block)_

---

> ### Gemini Live API — Caller Transcript Locked to Session Language Script
>
> - **What changed:** `inputAudioTranscription: {}` is now passed to `RealtimeModel` so Gemini uses the session's `language` BCP-47 code when transcribing the caller's audio. Previously `user_input_transcribed` events came back in whatever script Gemini auto-detected (Roman Urdu in Latin, Hindi in Devanagari, Urdu in Urdu script — mixed per utterance). With `inputAudioTranscription` enabled alongside `language: "ur-PK"`, Urdu speech is consistently transcribed in Urdu/Arabic script.
> - **Why:** `AudioTranscriptionConfig` in the Google SDK is an empty interface with no explicit language/script option. However enabling the field (even as `{}`) signals to the Gemini API to use the session `speechConfig.languageCode` for transcription output. Note: Hindi speech (a different language from Urdu) still transcribes in Devanagari — cross-language normalization would require post-call LLM processing.
> - **Files:**
>   - `src/lib/agents/sessionBuilder.ts` _(RealtimeModel constructor: inputAudioTranscription: {})_

---

> ### Language / Accent Dropdown — BCP-47 Codes Now Shown in Labels
>
> - **What changed:** Each option in the Language / Accent dropdown now includes the BCP-47 locale code in parentheses — e.g. `English — South Asian / Pakistani (en-IN)`, `Urdu (ur-PK)`, `Arabic (ar-XA)`.
> - **Why:** Without the code visible, it wasn't obvious which locale was being set — particularly for non-obvious codes like `ar-XA` (Arabic) or `en-IN` (South Asian accent). Showing the code lets operators cross-reference Gemini docs without leaving the UI.
> - **Files:**
>   - `src/components/VoiceBehaviorTab.tsx` _(LIVE_API_LANGUAGES: code appended to each label in parentheses)_

---

> ### Gemini Live API — Per-Locale Language Instructions in Compiled System Prompt
>
> - **What changed:** When `liveApiLanguage` is set to a non-English BCP-47 locale, a tailored `[LANGUAGE]` instruction block is automatically prepended to the compiled system prompt — no manual prompt writing needed. The block is injected in `buildSystemPrompt`, so it (a) appears in the compiled-prompt preview in the UI and (b) applies to all pipeline types (Live API and cascading). Each locale has a hand-crafted instruction string in the `LOCALE_LANGUAGE_INSTRUCTION` map covering language, script, register, and common model failure modes. Examples: `ur-PK` explicitly forbids Devanagari and specifies right-to-left Urdu script; `ja-JP` specifies keigo register; `de-DE` specifies formal Sie; `zh-CN` specifies Simplified characters and forbids Pinyin. English variants (`en-*`) receive no instruction — the model's default is English.
> - **Why:** A generic `"respond only in X"` template is insufficient across all languages. Three discovered failure modes: (1) the `language` param on `RealtimeModel` only steers TTS accent, not LLM output language — without a prompt instruction the agent speaks English regardless of locale; (2) setting `ur-PK` caused the agent to respond in Urdu phonetics but write in Devanagari (Hindi script) because Urdu and Hindi share spoken roots; (3) some languages require register/formality guidance the model won't default to correctly. A per-locale map lets each language have exactly the right instruction without template workarounds.
> - **Files:**
>   - `src/lib/agents/promptBuilder.ts` _(LOCALE_LANGUAGE_INSTRUCTION map with 13 hand-crafted locale entries; PromptFields: liveApiLanguage?; buildSystemPrompt prepends [LANGUAGE] block from map; buildDispatchMetadata passes vs?.liveApiLanguage)_
>   - `src/app/api/agents/[agentKey]/compiled-prompt/route.ts` _(passes agent.voiceSettings?.liveApiLanguage so preview matches runtime)_
>   - `src/lib/agents/sessionBuilder.ts` _(language injection removed from buildLiveApiInstructions — handled upstream in buildSystemPrompt)_

---

> ### Agent Save — `updatedAt` Number vs Firestore Timestamp Type Mismatch Fixed
>
> - **What changed:** `updateAgentConfig` now handles `updatedAt` being stored as either a plain Unix-ms number or a Firestore `Timestamp` object. Both the stale-version check (`currentTs?.toMillis()`) and the post-write read-back (`newTs?.toMillis()`) now use `typeof x === "number" ? x : x?.toMillis() ?? fallback` instead of calling `.toMillis()` unconditionally.
> - **Why:** Sarah's Firestore document had `updatedAt` stored as a plain number. The stale-version read called `.toMillis()` on it, which threw `currentTs?.toMillis is not a function`, causing every save attempt to fail with "Failed to save — please try again."
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(updateAgentConfig: stale-check serverMs computation; post-commit updatedAtMs computation — both now typeof-guard before .toMillis())_

---

> ### Gemini Live API — Language / Accent Dropdown in Voice & Behavior Tab
>
> - **What changed:** A new "Language / Accent" select field was added to the Gemini Live Settings panel in the Voice & Behavior tab. It exposes 18 BCP-47 locale options (including `en-IN` for a South Asian / Pakistani accent). The selected value is saved to Firestore as `voiceSettings.liveApiLanguage`, passed through `buildDispatchMetadata` as `meta.liveApiLanguage`, and forwarded to `RealtimeModel` as the `language` constructor option (already supported by the Google SDK — omitting it lets Gemini auto-detect; providing a locale steers the accent).
> - **Why:** Accent steering for Gemini Live API is controlled entirely by the BCP-47 `language` parameter — there is no native voice-cloning path. Exposing this as a user-configurable dropdown lets operators select the closest regional variant (e.g. `en-IN` for South Asian-accented English, `ur-PK` for Urdu) without requiring a code change.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(VoiceSettings interface: liveApiLanguage?: string; VoiceSettingsWriteSchema: liveApiLanguage z.string().max(20).optional())_
>   - `src/lib/agents/promptBuilder.ts` _(DispatchMetadata: liveApiLanguage?: string; buildDispatchMetadata: if vs?.liveApiLanguage → meta.liveApiLanguage)_
>   - `src/components/VoiceBehaviorTab.tsx` _(LIVE_API_LANGUAGES constant; liveApiLanguage in FormState + defaultForm + fromData + doSave; SelectField added to Gemini Live Settings grid)_

---

> ### Multi-Tenant Isolation — All Data Scoped to Logged-In User
>
> - **What changed:** Call history, dashboard stats, playground agent list, and the agents sidebar are now all filtered to only show data belonging to the currently logged-in user. The `__uid` cookie (set by `AuthContext` on login) is read server-side in every data-fetching path. `getCallHistory` accepts an optional `agentKeys?: string[]` parameter; when provided it issues a Firestore `where("agentKey", "in", [...])` query chunked into batches of 30 (Firestore `in` limit). An empty allow-list returns zero records rather than all records. `CallHistoryClient` additionally receives `userAgentKeys` (the uid-scoped set) separately from `agents` (the full set used for name resolution), so agent names always resolve correctly even for records belonging to other users that might have slipped through.
> - **Why:** The app previously fetched all agents and all call records without user scoping, meaning every logged-in user saw every other user's agents, calls, and dashboard stats. Scoping was already applied to the sidebar (via `listAgents(uid)`), but the API routes for history and dashboard called `listAgents()` and `getCallHistory()` without a uid, leaking cross-user data.
> - **Files:**
>   - `src/lib/history.ts` _(getCallHistory: optional agentKeys param; Firestore "in" query chunked at 30; empty array → return [])_
>   - `src/app/api/history/route.ts` _(reads \_\_uid cookie; listAgents(uid) → agentKeys; passes to getCallHistory)_
>   - `src/app/api/dashboard/route.ts` _(reads \_\_uid cookie; listAgents(uid) for both agentKeys filter and agents panel; single Firestore read reused)_
>   - `src/app/playground/page.tsx` _(reads \_\_uid cookie; passes to listAgents(uid))_
>   - `src/app/calls/page.tsx` _(reads \_\_uid cookie; parallel listAgents(uid) + listAgents() — uid-scoped for filtering, all-agents for name lookup)_
>   - `src/components/CallHistoryClient.tsx` _(userAgentKeys prop; userRecords memo filters records by key set; agent dropdown filtered to user's agents only; Agent column moved to first position)_

---

### 🐛 Bug Fixes

---

> ### Phone Call — Greeting Now Plays After Callee Answers (SIP Active Status Fix)
>
> - **What changed:** `waitForSipAudio` (which waited for `TrackSubscribed`) was replaced with `waitForSipCallActive`, which waits for the LiveKit SIP participant's `sip.callStatus` attribute to become `"active"` via `RoomEvent.ParticipantAttributesChanged`. The 60-second timeout fallback is retained.
> - **Why:** The SIP bridge pre-subscribes its audio track when it joins the LiveKit room — during the ringing phase, before the callee has answered. `TrackSubscribed` fired immediately (2ms after the check) even while the phone was still ringing, causing the agent to start the session and speak the greeting into dead air. `sip.callStatus = "active"` is only set by LiveKit when the PSTN call is actually answered, making it the correct signal to wait for.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(waitForSipAudio → waitForSipCallActive; uses RoomEvent.ParticipantAttributesChanged + sip.callStatus check)_

---

> ### Phone Call — Farewell Now Hangs Up the PSTN Call (Room Delete Fix)
>
> - **What changed:** The farewell detection handler in `runLiveApiSession` now calls `RoomServiceClient.deleteRoom(roomName)` (from `livekit-server-sdk`) instead of `ctx.room.disconnect()`.
> - **Why:** `ctx.room.disconnect()` only disconnects the agent participant from the LiveKit room. The SIP participant (representing the live PSTN call) remains in the room, keeping the phone call alive indefinitely — the caller had to hang up manually, and the observer modal stayed "Connected". Deleting the entire room forces the SIP bridge to hang up the call and closes all participants, which transitions the UI to the summary state.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(farewell handler: RoomServiceClient imported; deleteRoom(roomName) with ctx.room.disconnect() fallback; 3s delay retained)_

---

> ### Playground — Phone Number Preserved After Calling
>
> - **What changed:** `setLocalNumber("")` was removed from the `handleCall` success path in the outbound call panel.
> - **Why:** Clearing the number after a call was intentional (to reset the form), but the number was already persisted to `localStorage` on every keystroke. After a call, the input went blank — which felt like the persistence wasn't working — even though reloading the page would restore it. Keeping the number visible after calling makes the behaviour consistent with what's stored.
> - **Files:**
>   - `src/components/PlaygroundClient.tsx` _(handleCall: removed setLocalNumber("") on success)_

---

> ### Agent Page — Firestore Quota Exhaustion from History Over-Polling Fixed
>
> - **What changed:** The single polling loop that fetched both `/api/rooms/active` and `/api/history` every 5 seconds was split into two independent loops: rooms/active every 5 seconds, history every 60 seconds.
> - **Why:** Both endpoints were coupled in a `Promise.all` on a 5-second interval. The rooms/active check is a LiveKit API call (cheap), but the history endpoint queries Firestore for up to 50 documents per call. At 12 requests/minute × 50 docs = 600 Firestore reads/minute per open tab, the free tier's 50k daily read quota was exhausted within ~2 hours of testing. Call history only changes when a call ends, so frequent polling provided no benefit.
> - **Files:**
>   - `src/components/AgentClient.tsx` _(useEffect polling: split into two separate effects; rooms/active 5s, history 60s)_

---

> ### Login — Agent Sidebar Empty After Sign-In (Hard Redirect Fix)
>
> - **What changed:** After a successful login, the redirect now uses `window.location.href = "/"` instead of `router.replace("/")`. The sign-out path in `AuthContext` retains `router.replace("/login")`.
> - **Why:** Next.js App Router soft navigation reuses the cached root layout without re-running its server-side render. The root layout reads the `__uid` cookie to call `listAgents(uid)` and populate the sidebar — but that cookie is written client-side by `AuthContext` after Firebase Auth resolves. A soft nav to `/` after login hit the cached layout (rendered before the cookie existed), producing an empty agent list. Forcing a hard navigation causes the browser to make a fresh GET request with the newly written cookie, so the server renders the layout with the correct uid on first load.
> - **Files:**
>   - `src/app/login/page.tsx` _(useEffect redirect: window.location.href = "/" instead of router.replace("/"))_

---

> ### Dashboard — Trend Chip "No data" Relabelled to "No prior day"
>
> - **What changed:** The `TrendChip` component now renders `— No prior day` instead of `— No data` when the trend value is `null`.
> - **Why:** "No data" was misleading — the card metrics (calls, duration, success rate) all had real values. The null trend simply meant there were no calls yesterday to compare against, not that today's data was missing. "No prior day" correctly communicates that the comparison period is empty, not the metric itself.
> - **Files:**
>   - `src/components/DashboardClient.tsx` _(TrendChip null branch: "No prior day")_

---

## 🗓️ **2026-06-01**

---

### 🐛 Bug Fixes

---

> ### Live API — Greeting Now Spoken Immediately on Call Connect (gemini-3.1 + 2.5 Fix)
>
> - **What changed:** The Live API pipeline in `runLiveApiSession` now triggers the greeting immediately after `session.start()` instead of waiting for the first user audio input. A `switch (true)` gates on the model string:
>   - **`model.includes("3.1")`** → drills `session → activity → realtimeSession` and calls `rtSession.sendClientEvent({ type: "realtime_input", value: { text: "[call connected]" } })`. This routes through the internal `sendTask` message queue to `session.sendRealtimeInput({ text })`, which is the documented mechanism for triggering a model response on `gemini-3.1-flash-live-preview` (where `generateReply` and `proactivity` are both blocked by the SDK and the Google API respectively).
>   - **all other models** → calls `await session.generateReply()` directly (supported on 2.5+ native audio models).
> - **Why:** The greeting was injected into the system prompt via `buildLiveApiInstructions` (`[VOICE SESSION START]: … say it right now`), but Gemini Live API doesn't proactively speak from system instructions alone — it waits for a user turn. For `gemini-3.1-flash-live-preview` specifically: the SDK blocks `generateReply()` via a `!model.includes("3.1")` capability check; Google's docs state that `proactivity` and affective dialogue are not yet supported on 3.1; `send_client_content` requires `history_config.initial_history_in_client_content: true` which the LiveKit SDK does not expose. `sendRealtimeInput` with text is the only supported path on 3.1 to immediately prompt a model response.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(switch on model string after session.start(); 3.1 branch uses sendClientEvent realtime_input text trigger; default branch uses session.generateReply())_

---

> ### Call History — Usage/Cost Now Persisted Even When Webhook Beats the Worker (Race Fix)
>
> - **What changed:** `GET /api/calls/[roomName]/usage` now fires a fire-and-forget `updateCallRecord` write to Firestore whenever it successfully reads the usage file. Previously the endpoint only returned the data to the caller (the playground polling loop) without persisting it.
> - **Why:** The `room_finished` LiveKit webhook and the agent worker's `close` event handler race to write / read the same `.agent-usage/{roomName}.json` file. When the webhook fires first (common in low-latency local + ngrok setups), it reads a file that doesn't exist yet, silently skips the usage block, and marks the call completed with no usage data. The call record is then frozen — nothing ever retries the write. The playground UI calculated cost correctly because it polls the usage endpoint independently, but that data never reached Firestore and the call history showed `—` for tokens and cost. The fix makes the usage endpoint the fallback writer: the first successful poll after the file is ready persists the usage. The write is idempotent — if the webhook already wrote the usage, the same data is written again harmlessly.
> - **Files:**
>   - `src/app/api/calls/[roomName]/usage/route.ts` _(on successful file read: fire-and-forget updateCallRecord with usage; import CallUsage + updateCallRecord from history)_

---

### ✨ Features

---

> ### Playground — Client-Side Call Completion Fallback
>
> - **What changed:** A new `POST /api/calls/[roomName]/complete` route was added. It reads the call record and, if the status is still `"in-progress"`, sets it to `"completed"` with the current timestamp and calculated duration. `PlaygroundClient.onDisconnected` now fires this endpoint 15 seconds after disconnect — long enough for the `room_finished` webhook to arrive first (which is the preferred path), but short enough to catch it if the webhook was unreachable (e.g. no ngrok tunnel). The route returns `{ skipped: "already completed" }` when the webhook already handled it, making it a no-op in the normal flow.
> - **Why:** Widget test calls running against a local dev server only receive LiveKit `room_finished` webhooks if a public tunnel (ngrok) is running at the time the room closes. Calls that ended before a tunnel was started stay stuck as `"in-progress"` indefinitely. The 15-second client-side fallback covers this scenario without interfering with the authoritative webhook path — the webhook wins if it arrives within those 15 seconds; the client fallback wins otherwise.
> - **Files:**
>   - `src/app/api/calls/[roomName]/complete/route.ts` _(new — POST handler; reads call record; updates status/outcome/endTime/duration only if still in-progress)_
>   - `src/components/PlaygroundClient.tsx` _(onDisconnected: 15s setTimeout fires POST /api/calls/{room}/complete after usage polling starts)_

---

> ### Agent Prompt — Sarah (Layref) Sections Revised After Live Call Analysis
>
> - **What changed:** All four prompt sections for the Sarah LAYREF agent (`gZpvYpAgmk9WShjXqF8G`) were rewritten and pushed directly to Firestore (both the parent agent doc and `config/voice` subcollection). Key changes per section:
>   - **roleAndResponsibilities:** Added mandatory market-name confirmation before proceeding ("Just to confirm — you said Greece, is that right?"). Added three discovery questions (what caught your interest, prior investment experience, goal) that must happen before qualification data is collected. Meeting slots are now offered once only — if the caller hesitates the agent asks "what time works better?" instead of repeating the same slots. Full objection-handling paths added for confused callers, callers who need time, and callers who want to speak to a human. Dead tool references removed (`create_custom_task`, `close chat`, `send_message`). Agent no longer promises to "send a message" during the call — uses "our team will follow up" instead. Word limit raised from 40 → 50.
>   - **personaLanguageAndTone:** Added explicit pacing rules — wait for the caller to finish, match their energy, stop pushing when they say they need a moment. Word limit aligned to 50.
>   - **mistakesToAvoid:** Removed entire follow-up task block (tools removed) and cal-tool-failure block (tool removed). Added: never assume the market name was heard correctly — always confirm. Added: offer meeting slots once only, then open-ended. Added: don't push for a booking after the caller declines or hesitates. Added: don't promise outbound messages during the call.
>   - **additionalInstructions:** Removed dead tool block ("Call simultaneously: update_qualification, send_message, change_lead_status"). Removed "Always create follow-up tasks after messages". Added Greece market context (previously almost entirely Dubai-focused). Added note that all data is extracted automatically post-call so the agent should focus on conversation, not explicit collection. Qualification checklist updated to require verbal market confirmation and at least one discovery question before data collection.
> - **Why:** A live test call revealed three failure modes: (1) agent jumped from the caller's name straight to budget/contact/meeting slots with no discovery, causing the caller to say "you didn't even ask any questions"; (2) the same two meeting slots were repeated four times even after the caller expressed confusion; (3) the prompt contained extensive instructions for tools that no longer exist (`create_custom_task`, `send_message`, `change_lead_status`, `schedule_meeting`, `close_chat`) — dead weight that could confuse Gemini. Additionally, the agent misheard "breeze" as "Greece" and proceeded without confirming, derailing the entire call on a false premise.
> - **Where:** Firestore — `agents/gZpvYpAgmk9WShjXqF8G` (parent doc) and `agents/gZpvYpAgmk9WShjXqF8G/config/voice` (subcollection)

---

> ### Call History — Copy Transcript Button
>
> - **What changed:** A "Copy transcript" button now appears in the top-right corner of the Transcript tab when turns have loaded. Clicking it formats all turns as `[HH:MM:SS] Speaker: text` lines joined by newlines and writes them to the clipboard via `navigator.clipboard.writeText`. The button icon switches to a green checkmark and the label changes to "Copied!" for 2 seconds before reverting. A `transcriptCopied` boolean state drives the visual feedback.
> - **Why:** Operators frequently need to paste call transcripts into other tools (CRMs, reports, review threads) and the chat-bubble layout in the UI is not copy-pasteable as plain text. The formatted output preserves speaker attribution and timestamps in a human-readable format that pastes cleanly anywhere.
> - **Files:**
>   - `src/components/CallHistoryClient.tsx` _(Copy icon imported; transcriptCopied state; copy button with clipboard write + 2s feedback above transcript turns)_

---

> ### Architecture — Post-Call LLM Extraction Replaces Mid-Call Tool Calls
>
> - **What changed:** All data-collection tools (`create_custom_task`, `delete_task`, `update_qualification`, `change_lead_status`, `schedule_meeting`, `send_message`) have been removed from the in-call tool set. A new post-call extraction step runs automatically when `room_finished` fires: it reads the `transcripts` subcollection, fetches the agent's compiled system prompt from Firestore, resolves the agent's Gemini API key, and sends both to `gemini-2.0-flash` with a structured extraction prompt. The LLM returns a JSON payload covering qualification fields, follow-up tasks, a meeting booking (if discussed), and queued messages. Results are written to the same Firestore collections as before (`call_qualifications`, `call_tasks`, `call_meetings`, `call_messages`) with an added `source: "post_call_extraction"` field for traceability. The extraction runs fire-and-forget from the webhook handler so it never blocks the LiveKit webhook response. The `PLATFORM_VOICE_RULES` constant was updated to remove references to mid-call tool usage. The only remaining in-call tool is `end_call`.
> - **Why:** Mid-call tool calls caused the Gemini Live API to dispatch multiple function calls in a single turn, which created competing speech handles in the LiveKit SDK's `SegmentSynchronizer`, deadlocking the audio pipeline and leaving the caller in silence. More fundamentally, the tools were solving the wrong problem: Gemini does not need to call Firestore to "remember" what the caller said — that information is already in its context window throughout the call. The tools were purely a persistence mechanism, not a cognitive one. Moving persistence to a post-call extraction pass gives the agent a completely uninterrupted conversational flow where the prompt drives all scenario handling, and structured data is extracted from the finished transcript once without any risk of mid-call stalls.
> - **Files:**
>   - `src/lib/agents/callExtractor.ts` _(new — reads transcripts subcollection, builds extraction prompt from agent system prompt + transcript, calls gemini-2.0-flash, writes qualification/tasks/meeting/messages to Firestore)_
>   - `src/app/api/agent/route.ts` _(room_finished handler: extractCallData() called fire-and-forget after updateCallRecord)_
>   - `src/lib/agents/voiceTools.ts` _(6 data-collection tools removed; only end_call remains; toolInFlight logic removed as no longer needed)_
>   - `src/lib/agents/promptBuilder.ts` _(PLATFORM_VOICE_RULES updated to remove references to mid-call tool calls)_

---

### 🐛 Bug Fixes

---

> ### Live API — @livekit/agents Upgraded to 1.4.4 (Playback Flush and Interruption Race Conditions Fixed)
>
> - **What changed:** All `@livekit/agents` and `@livekit/agents-plugin-*` packages upgraded from 1.4.3 to 1.4.4. All 7 plugin packages (`cartesia`, `deepgram`, `elevenlabs`, `google`, `openai`, `silero`, plus core) were updated together to keep versions aligned.
> - **Why:** 1.4.4 includes two fixes directly relevant to the audio stall issue: "Fixed playback flush and speech interruption race conditions" and "Addressed realtime generation cancellation when user speech interrupts the agent." These target the scenario where user speech arrives while a Gemini tool call is still mid-flight, which is exactly when the `SegmentSynchronizerImpl` deadlocked. Ultimately the root fix is the architectural removal of mid-call tools, but the SDK upgrade also improves stability for any remaining concurrent audio events.
> - **Files:**
>   - `package.json` / `package-lock.json` _(all @livekit/agents\* packages bumped to 1.4.4)_

---

> ### Live API — Thinking State Watchdog Added as Last-Resort Recovery
>
> - **What changed:** `runLiveApiSession` now tracks when the agent enters the `thinking` state via `agent_state_changed`. A `setInterval` watchdog fires every 5 seconds. If the agent has been continuously in `thinking` for more than 30 seconds it calls `(session as any).interrupt()` to force the session back to listening, then resets the timer to prevent re-triggering on the same stall. The interval is cleared in the `close` handler.
> - **Why:** With mid-call tools removed, this watchdog should never fire in normal operation. It is kept as a last-resort safety net for any unexpected future stall scenario (e.g., a network hiccup causing a Gemini generation to hang). 30 seconds was chosen as a clearly-anomalous threshold that avoids false positives during legitimate long thinking pauses. The previous 8-second watchdog was designed to recover from the tool-call race condition; since that race is now eliminated architecturally, the threshold was raised significantly.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(thinkingStartMs tracked in agent_state_changed; thinkingWatchdog interval; interrupt() called at 30s; interval cleared on close)_

---

> ### Live API — @livekit/agents Downgraded 1.4.4 → 1.4.3 (rotateSegment Fatal Crash Regression)
>
> - **What changed:** All `@livekit/agents` and `@livekit/agents-plugin-*` packages were rolled back from 1.4.4 to 1.4.3. All 7 packages reverted together.
> - **Why:** 1.4.4 introduced a regression: a phantom `onInputSpeechStopped` event that Gemini emits internally when finalising a user turn was treated as a real speech-stop event. The SDK called `rotateSegment` while a previous rotation was still in progress, logged `"rotateSegment called while previous segment is still being rotated"`, and immediately exited `AgentActivity mainTask`, dropping the call mid-conversation with `reason: "user_initiated"`. The original reason for upgrading to 1.4.4 (concurrent speech handle deadlock from parallel tool calls) is now eliminated architecturally — all data-collection tools were removed — so reverting to 1.4.3 is safe and stable.
> - **Files:**
>   - `package.json` / `package-lock.json` _(all @livekit/agents\* packages rolled back to ^1.4.3)_

---

> ### Live API — Session Crash Fix: end_call + Concurrent Speech Handle Race
>
> - **What changed:** Two changes to `buildVoiceTools` and one to its call site: (1) The `end_call` tool description was tightened to only trigger after an explicit caller farewell phrase (`"bye"`, `"goodbye"`, `"thanks, take care"`) — the previous wording `"conversation is fully complete"` was too broad and caused Gemini to call the tool mid-conversation when it judged data collection to be done. (2) `session.interrupt()` is now called inside the `end_call` execute function before the `ctx.room.disconnect()` timeout, cancelling any concurrent in-flight speech handle before the room closes. (3) The `AgentSession` object is now passed into `buildVoiceTools` as a second parameter so the execute function has access to `interrupt()`.
> - **Why:** Even with only one remaining tool, Gemini can emit both a text response and a tool call in the same generation turn. When this happened with `end_call`, the SDK created two concurrent speech handles — one for the tool response, one for the text response. Both completed near-simultaneously on interrupt, triggering two `rotateSegment` calls that raced → `AgentActivity mainTask: exiting` → `reason: "user_initiated"` session close mid-call. The `session.interrupt()` call collapses the concurrent handle before the room disconnects. The description fix prevents Gemini from prematurely calling `end_call` before the caller says goodbye.
> - **Files:**
>   - `src/lib/agents/voiceTools.ts` _(end_call description rewritten; session param added to buildVoiceTools signature; session.interrupt() called in execute; disconnect delay reduced 2500 → 1500ms)_
>   - `src/lib/agents/genericEntry.ts` _(session passed as second arg to buildVoiceTools)_

---

> ### Playground — Widget Resets When Agent Session Closes Server-Side
>
> - **What changed:** `WebCallWidget` now tracks when the agent participant (`agent` from `useVoiceAssistant()`) transitions from present to absent (i.e., the agent left the room). A `useRef` (`agentWasPresent`) flips to `true` the first time `agent !== undefined`. When `agent` becomes `undefined` after having been present, a 3-second timer fires `room.disconnect()` from the browser side. This triggers the existing `onDisconnected` callback, which resets `token`/`url` state (returning the UI to "Start call"), calls `onCallEnded()` to stop the worker process, and starts the usage polling loop.
> - **Root cause analysis:** Three approaches were tried before this fix landed. (1) `RoomEvent.ParticipantDisconnected` + `remoteParticipants.size === 0` — failed because the room can have other remote participants (observer bridge, etc.) keeping the count above zero. (2) `agentState === "disconnected"` — failed because reading `useVoiceAssistant()` source revealed that `agentState` only returns `"disconnected"` when the **room** connection itself is in `ConnectionState.Disconnected`. When the agent participant leaves but the browser is still connected, `agentState` returns `"connecting"` (because `!agent` is `true`), never `"disconnected"`. (3) `agent === undefined` (current fix) — correct because `useVoiceAssistant().agent` is the RemoteParticipant object. It is `undefined` when no agent-kind participant is in the room. This is the precise signal that the agent left. The 3s delay handles brief WebSocket reconnection windows — if the agent reconnects before 3s, the cleanup return cancels the timer.
> - **Verified by Playwright test:** `node /tmp/widget_test.mjs` — fake mic injects `bye_audio.wav`, agent reaches "Listening", audio stall causes agent session to close, `agent` becomes `undefined`, 3s timer fires `room.disconnect()`, `[BROWSER] disconnect from room` logged, "Start call" button reappears at `20.6s`.
> - **Files:**
>   - `src/components/PlaygroundClient.tsx` _(agentWasPresent ref added; useEffect on agent → disconnect after 3s when agent goes undefined; prior agentState/RoomEvent attempts removed; RoomEvent import removed)_

---

> ### Live API — end_call Tool Removed; Call Termination via Farewell Detection
>
> - **What changed:** The `end_call` tool was removed entirely from `voiceTools.ts`. `buildVoiceTools()` now accepts no parameters and returns `{}`. Call termination is handled by a new `isFarewell(text)` function that checks the agent's spoken text against a list of closing phrases (`"goodbye"`, `"good bye"`, `"bye bye"`, `"take care"`, `"talk soon"`, `"reach out"`, `"best of luck"`, `"all the best"`, `"have a great"`, `"good day"`, `"good night"`, `"until next time"`, `"speak soon"`, `"chat soon"`). The check runs inside the existing `conversation_item_added` handler in `genericEntry.ts` — when the agent's text matches, a 3-second `setTimeout` calls `ctx.room.disconnect()`. The `[CALL END RULES]` and `[SILENCE HANDLING]` addenda that instructed the agent to call `end_call` were removed from `buildLiveApiInstructions`. The `PLATFORM_VOICE_RULES` prompt block was updated to say "all data collection happens automatically after the call ends."
> - **Why:** Even with a single tool registered, Gemini Live API can emit both a text response and a tool call in the same generation turn. When `end_call` was called alongside a farewell sentence, the SDK created two concurrent speech handles. Both completing near-simultaneously triggered two `rotateSegment` calls that raced — `"rotateSegment called while previous segment is still being rotated"` → `AgentActivity mainTask: exiting` → session closed with `reason: "user_initiated"`. The `session.interrupt()` fix inside `execute()` was also ineffective because the SDK creates speech handles before `execute` is ever called. Removing the tool entirely eliminates the race at source: the agent speaks a farewell phrase naturally, the transcript handler detects it, and the room disconnects after a short delay — no tool call, no competing speech handle.
> - **Files:**
>   - `src/lib/agents/voiceTools.ts` _(end_call removed; buildVoiceTools takes no params, returns {}; isFarewell() exported with phrase list)_
>   - `src/lib/agents/genericEntry.ts` _(isFarewell imported; farewell check added in conversation_item_added for assistant turns; buildVoiceTools called with no args; session no longer passed to voiceTools)_
>   - `src/lib/agents/promptBuilder.ts` _(PLATFORM_VOICE_RULES updated: tool-call language replaced with "all data collection happens automatically after the call ends")_
>   - `src/lib/agents/sessionBuilder.ts` _(CALL END RULES and SILENCE HANDLING addenda removed from buildLiveApiInstructions)_

---

> ### Live API — generateReply Trigger Removed (Incompatible with Native Audio Models)
>
> - **What changed:** The `await session.generateReply({ userInput: "." })` call that previously fired immediately after `session.start()` was removed. A comment was added explaining why it must not be used for native audio models.
> - **Why:** `generateReply` is explicitly incompatible with `gemini-live-2.5-flash-native-audio` and similar native audio models — the SDK logs a warning and rejects the call. However, Gemini still sends a server content event from its own internal logic, and because the framework has no active generation handle (it was never started via `generateReply`), the message is logged as `"received server content but no active generation"`. This leaves the session in a corrupted state: the next time the agent tries to speak (when the caller says something), the speech handle stalls for ~10 seconds before the watchdog recovers it. The native audio model greets naturally on the caller's first audio input, making the artificial trigger unnecessary.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(generateReply call removed after session.start(); explanatory comment added)_

---

> ### Playground — Widget Auto-Resets and Post-Call Processes Trigger When Agent Session Closes
>
> - **What changed:** `WebCallWidget` now registers a `RoomEvent.ParticipantDisconnected` listener on the LiveKit room. When any remote participant leaves and no remote participants remain (i.e., the agent worker has disconnected), it waits 1.5 seconds then calls `room.disconnect()` from the client side. This triggers the existing `onDisconnected` callback on `<LiveKitRoom>`, which resets `token`/`url` state (returning the UI to "Start call"), calls `onCallEnded()` to stop the worker process, and starts the usage polling loop that populates call cost in the UI. `RoomEvent` is imported from `livekit-client`.
> - **Why:** When the server-side agent closes the session expectedly (via farewell detection calling `ctx.room.disconnect()`), it disconnects the **agent worker** from the room — the browser client remains connected because it is a separate participant. The `<LiveKitRoom onDisconnected>` callback only fires when the local client disconnects, so it never triggered on server-side agent exits. The call button stayed in "active" state indefinitely, post-call transcript and cost data never loaded, and the worker process was never signalled to stop. The participant disconnect listener closes the gap by making the client detect the agent's departure and self-disconnect.
> - **Files:**
>   - `src/components/PlaygroundClient.tsx` _(RoomEvent imported from livekit-client; useEffect with ParticipantDisconnected listener added to WebCallWidget; room.disconnect() called after 1.5s when no remote participants remain)_

---

### 🗄️ Data & Infrastructure

---

> ### Pricing — gemini-2.5-flash Added; Post-Call Extraction Cost Tracked and Folded into Total
>
> - **What changed:** Four related changes across the pricing and history pipeline: (1) `"gemini-2.5-flash"` added to `PROVIDER_RATES` at **$0.15/1M input, $0.60/1M output** for use as a cascading LLM. (2) A new `EXTRACTION_TEXT_RATES` table added alongside `PROVIDER_RATES` for models called via standard `generateContent` (not Live API audio mode); entry: `"gemini-2.5-flash": { inputPerMToken: 0.15, outputPerMToken: 0.6 }`. (3) `UsageData` extended with optional `extractionModel`, `extractionInputTokens`, `extractionOutputTokens`; `CostBreakdown` extended with `extraction: { inputCost, outputCost, total }`; `calculateCost` computes extraction cost via `lookupExtractionRates()` and folds it into `total` and `perMinute`. (4) `CallRecord` extended with `extractionInputTokens?: number` and `extractionOutputTokens?: number`; `callExtractor.ts` reads `result.response.usageMetadata.promptTokenCount` / `candidatesTokenCount` after each extraction run and persists them via `updateCallRecord`; `CallHistoryClient` passes these fields through `usageCost()` so the UI total includes the extraction cost.
> - **Why:** Post-call extraction runs a separate LLM call on every completed call. Without tracking its token usage the call cost figures in the dashboard understate the true per-call spend. Capturing counts at extraction time and storing them on the call record attributes the cost to the correct call and surfaces it in call history without any retroactive lookup.
> - **Files:**
>   - `src/lib/pricing.ts` _(gemini-2.5-flash in PROVIDER_RATES; EXTRACTION_TEXT_RATES + lookupExtractionRates added; UsageData + CostBreakdown extended; calculateCost includes extraction cost)_
>   - `src/lib/history.ts` _(extractionInputTokens + extractionOutputTokens added to CallRecord)_
>   - `src/lib/agents/callExtractor.ts` _(token counts read from usageMetadata; updateCallRecord called with extraction token fields after writes complete)_
>   - `src/components/CallHistoryClient.tsx` _(usageCost accepts optional record param for extraction fields; extractionModel + tokens passed to calculateCost)_

---

> ### Extraction Model — gemini-2.5-flash Chosen After ModelService.ListModels Verification
>
> - **What changed:** `EXTRACTION_MODEL` in `callExtractor.ts` set to `"gemini-2.5-flash"`. Verified by calling `GET /v1beta/models` against the project API key, which returned 54 models with their `supportedGenerationMethods`. Critical finding: `gemini-3.1-flash-live-preview` (a previous candidate) only exposes `bidiGenerateContent` — it does **not** support `generateContent`, so using it in `callExtractor.ts` would have thrown a runtime error on every post-call extraction. `gemini-2.5-flash` supports `generateContent` and costs less than `gemini-3.1-flash-lite` ($0.15/$0.60 vs $0.25/$1.50 per 1M tokens).
> - **Why:** The extraction call uses the standard `@google/generative-ai` SDK's `model.generateContent()` path. Only models with `"generateContent"` in `supportedGenerationMethods` work on this path. Live API audio models (`*-live-preview`, `*-native-audio`) are `bidi`-only and will fail at runtime if passed to `getGenerativeModel`. Verifying via the live API avoided a silent production failure.
> - **Files:**
>   - `src/lib/agents/callExtractor.ts` _(EXTRACTION_MODEL = "gemini-2.5-flash")_

---

## 🗓️ **2026-05-26**

---

### ✨ Features

---

> ### Live API — Unregistered Tool References in Prompt Logged as Warnings
>
> - **What changed:** After `buildVoiceTools()` returns, `runLiveApiSession` now scans the compiled system prompt for any snake*case identifiers that start with a recognised tool-verb prefix (`create*`, `update*`, `delete*`, `change*`, `schedule*`, `send*`, `end*`, `get*`, `set*`, `add*`, `remove*`, `list*`, `fetch*`, `book*`, `cancel*`, `search\_`). Any match that is **not** in the registered tools object emits a `warn`-level log: `[Pipeline] prompt references tool "X" which is not registered — it will be unavailable`. Common snake_case prose (`follow_up`, `iso_8601`, etc.) is excluded by the verb-prefix filter.
> - **Why:** Operators frequently copy-paste system prompts from other agents or external sources that reference tools configured for a different agent. Gemini never receives those tools in the `tools` parameter so it can't call them, but without a warning there is no signal that the prompt is referring to capabilities that are silently absent. The log gives immediate visibility at session start so the mismatch can be corrected before the call goes live.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(post-tool-build scan: regex extracts snake_case verb-prefixed identifiers from baseInstructions; any not in registeredTools set emits a logger.warn per tool name)_

---

> ### Call History — Transcript Tab Shows Message-by-Message Conversation with Timestamps
>
> - **What changed:** The Transcript tab in the call history slide-over now fetches and renders each conversation turn individually instead of showing a flat pre-assembled string. A new `GET /api/calls/transcript?callId={docId}` route reads the `callHistory/{id}/transcripts` Firestore subcollection (where individual turns are written by the worker in real-time during the call) ordered by timestamp and returns an array of `{ speaker, text, ts }` objects. The component fetches lazily — only when the Transcript tab is first opened for a record — and resets when a different record is selected. Each turn is rendered as a chat bubble: agent turns left-aligned with a primary colour label, caller turns right-aligned with a success colour label, both showing a `HH:MM:SS` timestamp inline beside the speaker name. A loading spinner is shown while fetching; "No transcript recorded" is shown only when the subcollection is empty.
> - **Why:** Transcripts were already being written per-turn to a Firestore subcollection by the worker, but the UI never read them — it only checked `record.transcript` (a legacy string field on the main document) which is never populated. This change closes that gap and replaces the flat string format with a structured, timestamped chat view that makes it easy to follow the conversation flow and correlate agent responses to caller input.
> - **Files:**
>   - `src/app/api/calls/transcript/route.ts` _(new — GET handler; reads transcripts subcollection ordered by ts; returns TranscriptTurn array)_
>   - `src/components/CallHistoryClient.tsx` _(transcriptTurns + transcriptLoading state; fetchTranscript callback; useEffect lazy-fetch on tab open; transcript tab rewritten with chat bubble layout + timestamps)_

---

### 🐛 Bug Fixes

---

> ### Live API — Transcript Writes Flushed Before Worker Exits (Fire-and-Forget Writes Were Abandoned on SIGTERM)
>
> - **What changed:** `appendTurn()` now returns `Promise<void>` instead of `void`. Within `runLiveApiSession`, a `pendingTranscriptWrites` array collects the promise for every turn saved via `saveTurn()`. The `close` event handler now calls `await Promise.allSettled(pendingTranscriptWrites)` before writing the usage file, ensuring all in-flight Firestore writes have settled before the process exits. Previously, when SIGTERM hit the worker after a call ended, any Firestore writes still in-flight (e.g., the last one or two turns) were abandoned — the process exited with pending async operations. The flush uses `allSettled` (not `all`) so a single failed write does not abort the others.
> - **Why:** The LiveKit broker sends `room_finished` shortly after the room closes, and `killWorkerForRoom` sends SIGTERM to the worker process. Between the room-close event and SIGTERM there is a narrow window — typically only a few hundred milliseconds. Fire-and-forget Firestore writes that started just before the room closed were reliably lost, causing the last transcript turns to be missing from the subcollection.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(appendTurn return type changed to Promise<void>; pendingTranscriptWrites array added; saveTurn helper pushes promise; close handler flushes all writes via Promise.allSettled before writeUsage)_

---

> ### Widget Test — Transcript Subcollection Now Populated (callHistoryId Was Missing from Dispatch Metadata)
>
> - **What changed:** `POST /api/calls/test` now writes the call record to Firestore **before** building dispatch metadata, so `callHistoryId` is available to include in the metadata payload. Previously, `addCallRecord` was called after `createDispatch`, meaning `extra = {}` was passed to `buildDispatchMetadata` with no `callHistoryId`. The worker's `if (callHistoryId)` guard in `appendTurn` skipped every write, leaving the `transcripts` subcollection empty for all widget tests. The route now: (1) fetches agent data and derives `pipelineMode`, (2) writes the call record and captures the returned Firestore doc ID as `callHistoryId`, (3) builds dispatch metadata with `{ agentKey, callHistoryId }` in the `extra` object, (4) dispatches the agent. The `DataStreamError` thrown by the LiveKit browser SDK when the agent disconnects mid-transcription-stream is now also caught in `TranscriptCapture` — the incomplete segment is marked final with whatever text was accumulated rather than producing an unhandled promise rejection.
> - **Why:** Without `callHistoryId` in dispatch metadata the worker had no Firestore document to write transcript turns to. The pattern matches the outbound route fix (call record before SIP participant creation) but was not applied to the widget test path at the same time.
> - **Files:**
>   - `src/app/api/calls/test/route.ts` _(addCallRecord moved before createDispatch; callHistoryId + agentKey passed to buildDispatchMetadata extra; duplicate addCallRecord at end removed)_
>   - `src/components/PlaygroundClient.tsx` _(TranscriptCapture: try-catch around for-await loop; DataStreamError caught; partial segment marked isFinal on disconnect)_

---

> ### Live API — Agent Transcript Turns Now Captured via conversation_item_added (speech_created Was Broken)
>
> - **What changed:** The agent transcript capture in `runLiveApiSession` was switched from the `speech_created` event to the `conversation_item_added` event. The old handler read `ev.speechHandle.synthesizedText` which does not exist on `SpeechHandle` — the property was never defined in the SDK type, so it always produced an empty string and the `if (text.trim())` guard silently dropped every agent turn. The new handler listens to `conversation_item_added`, filters for `item.role === "assistant"`, and reads `item.textContent` (the `ChatMessage` getter that joins all text parts). This path is populated by the framework's internal activity — when an agent generation completes, it creates a `ChatMessage` with `role: "assistant"` and calls `_conversationItemAdded`, which emits the event. For models that support output transcription (`gemini-3.1-flash-live-preview`), `textContent` contains the spoken text. For native-audio-only models (`gemini-live-2.5-flash-native-audio`), `textContent` is empty and agent turns continue to be absent from the transcript.
> - **Why:** The `SpeechCreatedEvent.speechHandle` field has no `synthesizedText` property — the SDK exposes `chatItems`, `done()`, `waitForPlayout()`, and internal lifecycle methods, but no raw text. Reading a non-existent property returned `undefined`, which fell through to `ev?.text` (also absent), then to `""`, and the turn was never saved. The bug caused zero agent transcript turns to be recorded across all Live API calls despite the subcollection write infrastructure being in place.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(speech_created listener replaced with conversation_item_added; agent text read via item.textContent; role filter added)_

---

> ### Live API — Worker Auto-Spawns per Call and Auto-Kills on Room Finish
>
> - **What changed:** Every outbound call now spawns a dedicated fresh worker process and kills it automatically when the call ends. `spawnWorker()` in `outbound/route.ts` spawns `src/lib/agents/worker/agent.ts` via `tsx`, pipes both stdout and stderr to the Next.js terminal, and resolves only once `"registered worker"` appears in stdout (15-second timeout). The worker PID is written to `.worker-pids/{roomName}.pid` via `saveWorkerPid()`. The `room_finished` LiveKit webhook handler calls `killWorkerForRoom(roomName)` which reads the PID file, sends SIGTERM, and deletes the file. This means declined calls, missed calls, and completed calls all clean up the worker. Worker stdout is forwarded to the parent Next.js process in real-time so all agent logs (`[Pipeline]`, `[Transcript]`, `[STT]`, `[Agent]`) appear directly in the terminal.
> - **Why:** A single long-lived worker reuses its LiveKit WebSocket connection across multiple calls. After a few hours the WebSocket drops and the worker stops receiving dispatch notifications — new calls appear to connect but the agent never joins. Spawning a fresh worker per call guarantees a live WebSocket for every call. Killing it on room finish prevents idle worker accumulation.
> - **Files:**
>   - `src/app/api/calls/outbound/route.ts` _(spawnWorker, saveWorkerPid, killWorkerForRoom added; worker spawn + PID save between SIP participant creation and agent dispatch; stdout/stderr forwarded to parent)_
>   - `src/app/api/agent/route.ts` _(killWorkerForRoom imported and called on room_finished event)_

---

> ### Live API — Silence Check and Call-End Rules Restored
>
> - **What changed:** `buildLiveApiInstructions()` in `sessionBuilder.ts` was updated to re-add two instruction addenda that had been removed: `[SILENCE HANDLING]` — if the caller has not spoken for 45 or more seconds, the agent says "Are you still there?" exactly once; if no response within another 30 seconds it says a brief farewell and calls `end_call("completed")`; and `[CALL END RULES]` — when the caller says a clear farewell the agent speaks a brief farewell then calls `end_call("completed")`; for spam or repeated abuse it calls `end_call("spam")` immediately.
> - **Why:** These rules were removed in an earlier refactor and left the agent with no timeout or call-termination behaviour — calls would hang indefinitely if the caller went silent or said goodbye.
> - **Files:**
>   - `src/lib/agents/sessionBuilder.ts` _(SILENCE HANDLING and CALL END RULES addenda re-added to buildLiveApiInstructions)_

---

> ### Live API — Greeting Trigger Uses AgentSession.generateReply Instead of New RealtimeSession
>
> - **What changed:** After `session.start()`, the greeting trigger now calls `await (session as any).generateReply({ userMessage: "." })` instead of the previous `(session as any).llm?.session?.()` approach. The old approach called `RealtimeModel.session()` which creates a **new disconnected** `RealtimeSession` — the synthetic user turn was sent to a session object that had no active Gemini connection, producing `"received server content but no active generation"` in the logs and no spoken greeting. `AgentSession.generateReply` routes through the framework's internal activity pipeline which holds the live Gemini connection, so the trigger fires correctly.
> - **Why:** Gemini Live API waits for a user turn before generating any output. Without a trigger the agent sits silently until the caller speaks first. The old injection approach was confirmed broken by logs; using `AgentSession.generateReply` is the correct public entry point that the framework itself uses for reply generation.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(greeting trigger replaced: llm?.session?.().sendClientEvent → session.generateReply({ userMessage: "." }))_

---

> ### Outbound Route — Full Step-by-Step Console Trace for Call Debugging
>
> - **What changed:** Added `console.log` at every meaningful step of `POST /api/calls/outbound`: auth check pass/fail, body parse result, env var presence, SIP trunk fetch (with trunk count), room name and participant identity, call record write with resulting `callHistoryId`, provider key resolution (with key presence flags), dispatch metadata assembly (with key fields logged), worker spawn result (with PID), SIP participant creation, agent dispatch. Error paths also log the reason before returning.
> - **Why:** Without per-step logging, failures anywhere in the outbound route (auth, trunk fetch, worker spawn, SIP errors) were invisible — the only signal was the final HTTP response code. The trace makes it possible to pinpoint exactly which step failed from the Next.js terminal output.
> - **Files:**
>   - `src/app/api/calls/outbound/route.ts` _(console.log at every step of POST handler)_

---

> ### Call History — Pipeline Column Added (Live API vs Cascading)
>
> - **What changed:** A new **Pipeline** column was added to the Call History table between Sentiment and LLM. Each row shows a coloured badge based on `record.pipelineMode`: **"Live API"** (violet) for `live_api` and **"Cascading"** (blue) for `cascading`. The column header is sortable-ready via `thCls`. Every call record already stores `pipelineMode` at write time via the outbound and test routes, so no schema change was required.
> - **Why:** Operators running both pipeline modes need to distinguish at a glance which calls used Gemini Live API vs. the cascading STT → LLM → TTS stack — both for debugging and for reconciling cost differences between the two modes.
> - **Files:**
>   - `src/components/CallHistoryClient.tsx` _(Pipeline column header + badge cell inserted before LLM column)_

---

> ### Live API — Enabled for All Call Types (Phone + Test Number + Widget)
>
> - **What changed:** The "Phase 1 gate" in `src/app/api/calls/outbound/route.ts` that forced `useLiveApi: false` for all outbound phone calls has been removed. Live API now works everywhere the toggle is enabled — browser widget (Playground), test phone number calls, and real outbound calls. `pipelineMode` is derived directly from `agentData.voiceSettings?.useLiveApi` with no override. The "Playground only (phase 1)" amber warning banner in VoiceBehaviorTab was also removed.
> - **Why:** The gate was a temporary placeholder while the Live API integration was being validated. With greeting injection and function-call-speech fixes landed, the restriction is no longer warranted.
> - **Files:**
>   - `src/app/api/calls/outbound/route.ts` _(Phase1Gate block removed; resolvedKeys + dispatchMetadata now built from unmodified agentData)_
>   - `src/components/VoiceBehaviorTab.tsx` _(amber "Playground only" warning banner removed)_

---

> ### Playground — Test Phone Number Persisted Across Sessions
>
> - **What changed:** The country code selector and phone number input in the Playground phone test panel now read their initial values from `localStorage` (`playground_country_code`, `playground_local_number`) and write back on every change. Both `useState` calls use lazy initialisers with a try/catch so SSR doesn't throw on `localStorage` access.
> - **Why:** Operators test the same phone number repeatedly — requiring them to re-enter it every page load was unnecessary friction.
> - **Files:**
>   - `src/components/PlaygroundClient.tsx` _(PhoneTestPanel: lazy localStorage init for countryCode + localNumber; write-back on onChange)_

---

### 🐛 Bug Fixes

---

> ### Live API — Concurrent Tool Calls Serialised via Per-Session Promise Queue (Audio Pipeline Deadlock Fix)
>
> - **What changed:** All tool `execute` functions in `buildVoiceTools` are now routed through a per-session promise chain. After building the tools object normally, `buildVoiceTools` post-processes every entry: each `execute` is replaced with a wrapper that appends to a shared `toolQueue` promise and returns a chained promise. If two tools fire simultaneously, the second one is queued and only starts executing after the first resolves. A failed tool does not block the queue (`toolQueue = p.catch(() => {})` absorbs the rejection). A `[VoiceTools] queuing tool call` log line is emitted on each dispatch to make the ordering visible.
> - **Why:** Gemini Live API can dispatch multiple function calls in a single generation turn. When this happened, the LiveKit SDK created two concurrent speech handles for the same turn. The `SegmentSynchronizerImpl` then deadlocked — `audio forwarding stalled waiting for TTS frames` was logged after an 18-second timeout, the agent entered `speaking → thinking` state, and no audio was ever produced again for the remainder of the call. The caller heard silence for up to 60+ seconds until they hung up. Serialising the tool executes means the SDK processes one tool response at a time, preventing the concurrent speech handle collision.
> - **Files:**
>   - `src/lib/agents/voiceTools.ts` _(tools built as named const; toolQueue promise chain + serial wrapper added at bottom; every tool's execute routed through the queue via Object.fromEntries post-processing)_

---

> ### Webhook — Firestore Empty-Update Crash Fixed
>
> - **What changed:** `updateCallRecord()` in `history.ts` now exits early if the updates object is empty after stripping the `id` field. Previously, calling Firestore's `.update({})` with an empty object threw `"Update() requires either a single JavaScript object..."` and returned HTTP 500 from the webhook handler. The `room_started` webhook handler was also tightened to skip the update entirely when `lkCreationTime` is undefined (the only field it writes), which was the most common trigger for the empty-object path.
> - **Why:** The `room_started` LiveKit webhook fires immediately when a room is created. If `creation_time` is absent from the webhook payload (which LiveKit omits in some configurations), the handler was calling `.update({})` — an invalid Firestore operation. The guard prevents the crash without changing any observable behaviour.
> - **Files:**
>   - `src/lib/history.ts` _(updateCallRecord: early return on empty data object; createIfMissing option added for inbound calls)_
>   - `src/app/api/agent/route.ts` _(room_started handler: skip update when lkCreationTime is undefined)_

---

> ### Outbound Calls — Call Record Written Before SIP Participant Created (Race Condition Fix)
>
> - **What changed:** In `calls/outbound/route.ts`, `addCallRecord()` is now called immediately after the room name is generated — before `sipClient.createSipParticipant()` and before `agentDispatchClient.createDispatch()`. Previously the record was written at the very end of the route handler (after SIP setup and agent dispatch), which took up to 4–5 seconds. The LiveKit `room_started` webhook would fire during that window and log `"no doc with roomName=..."` because the record didn't exist yet. The same fix was applied to `calls/inbound/route.ts`.
> - **Why:** LiveKit webhooks (`room_started`, `participant_joined`) are delivered within milliseconds of room creation. Writing the call record last guaranteed a race condition on every outbound call. Writing it first ensures webhooks always find an existing document to update.
> - **Files:**
>   - `src/app/api/calls/outbound/route.ts` _(addCallRecord moved before createSipParticipant; agent config resolved first so pipelineMode is known at record-write time)_
>   - `src/app/api/calls/inbound/route.ts` _(addCallRecord moved before roomService.createRoom)_

---

> ### Outbound / Inbound Calls — Room Name Uses Agent Name Slug
>
> - **What changed:** Room names for both outbound and inbound calls are now derived from the agent's human-readable name rather than the Firestore document ID. A slug is generated from `agentData.name` (e.g. `"Sarah" → "sarah"`, `"Sales Bot" → "sales-bot"`) and used as the room name prefix: `<slug>-<phoneNumber>-<timestamp>`. Previously outbound rooms used the Firestore document ID as the prefix (e.g. `gZpvYpAgmk9WShjXqF8G-+971...`), which made LiveKit dashboard rooms unreadable.
> - **Why:** Room names appear in the LiveKit Cloud dashboard and in call history. A human-readable slug makes it immediately clear which agent handled which call without cross-referencing Firestore IDs.
> - **Files:**
>   - `src/app/api/calls/outbound/route.ts` _(roomName prefix derived from agentData.name slug)_
>   - `src/app/api/calls/inbound/route.ts` _(roomName prefix derived from agentData.name slug)_

---

> ### Live API — `session.say()` No Longer Called in Realtime Mode
>
> - **What changed:** `genericEntry.ts` no longer calls `session.say(greeting)` when the pipeline is Live API. The greeting was already injected into the Gemini model's instructions via `buildLiveApiInstructions` (the `[VOICE SESSION START]` directive), so calling `session.say()` was redundant and threw `"trying to generate speech from text without a TTS model"` because `RealtimeModel` has no separate TTS component.
> - **Why:** The `AgentSession.say()` method delegates to the TTS model; the Live API session has no TTS slot. The greeting is handled by Gemini itself on session open via the injected instruction directive.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(greeting say() call moved inside cascading-only branch)_

---

### ♻️ Refactors

---

> ### Architecture — Static Agents Removed; All Agents Now Firestore-Only
>
> - **What changed:** The two hardcoded static agents (`sales-en`, `restaurant-es`) have been removed from the codebase. Every agent is now a dynamic Firestore document. Key changes across the codebase:
>   - **`registry.ts`**: `agents` object emptied. Static entries removed. The export is kept for backwards-compatible imports but holds no data.
>   - **`src/lib/agents/worker/agent.ts`** _(new)_: A single generic worker replaces both `outbound/sales-en/agent.ts` and `inbound/restaurant-es/agent.ts`. It registers with LiveKit under the dispatch rule name passed via the `AGENT_DISPATCH_RULE` environment variable, and accepts all pipeline config (system prompt, model, TTS, STT) from dispatch metadata at runtime.
>   - **`process/route.ts`**: Fully rewritten. Removed registry lookup and `templateWorkerKey()`. Now reads `direction` and `dispatchRuleName` from Firestore for any agent key. Spawns the single generic worker with `AGENT_DISPATCH_RULE=<dispatchRuleName>` injected into the child process environment.
>   - **`firebase/agents.ts`**: `dispatchRuleName` is now optional in `CreateAgentParams`. `createAgent()` auto-derives it from the agent's name slug (`"Sarah" → "sarah"`, `"Sales Bot" → "sales-bot"`) if not explicitly provided.
>   - **`agents/route.ts`**: `templateDispatchRule()` helper removed. Agent creation no longer requires a static template dispatch rule — slug derivation in `createAgent` handles it.
>   - **`calls/inbound/route.ts`**: Rewritten to look up agents from Firestore (not static registry). Writes the call record before room creation (race condition fix). Uses the agent's own `dispatchRuleName` for dispatch. Passes `resolvedKeys` for provider API keys.
>   - **`dashboard/route.ts`**: Replaced `Object.values(agents)` (static registry) with `listAgents()` (Firestore).
>   - **`PlaygroundClient.tsx`**: Removed all `agentKey === "restaurant-es"` hardcoded checks. Translation behaviour (Spanish → English subtitles in transcript) is now driven by a `translateEnabled` prop derived from `agent.language.startsWith("en")`, making it work for any non-English agent automatically.
> - **Why:** Static agents were a bootstrap scaffold that became a liability. They polluted the playground agent selector with agents the user never configured, caused the playground to auto-default to `sales-en` on every page load, and meant adding a new agent required a code change and redeploy. All agents being Firestore-only means the product is fully data-driven — operators create, edit, and delete agents from the UI with no code changes required.
> - **Files:**
>   - `src/lib/agents/registry.ts` _(agents object emptied)_
>   - `src/lib/agents/worker/agent.ts` _(new — single generic worker for all agents)_
>   - `src/app/api/agents/process/route.ts` _(full rewrite — Firestore lookup + generic worker spawn with AGENT_DISPATCH_RULE env)_
>   - `src/lib/firebase/agents.ts` _(dispatchRuleName optional; auto-slug in createAgent)_
>   - `src/app/api/agents/route.ts` _(templateDispatchRule removed)_
>   - `src/app/api/calls/inbound/route.ts` _(Firestore lookup; pre-call record write; own dispatch rule)_
>   - `src/app/api/dashboard/route.ts` _(listAgents() replaces static registry)_
>   - `src/components/PlaygroundClient.tsx` _(restaurant-es hardcodes replaced with translateEnabled language prop)_

---

> ### Agent Entry — Split into Separate Live API and Cascading Pipeline Functions
>
> - **What changed:** `makeAgentEntry()` in `genericEntry.ts` was refactored from a single monolithic function with scattered `if (meta.useLiveApi)` branches into two self-contained async functions: `runLiveApiSession()` and `runCascadingSession()`. The entry point now just parses dispatch metadata and routes to one or the other. Each function owns its own session construction, event listeners, greeting logic, and usage tracking. A shared `writeUsage()` helper eliminates the duplicated file-write code. Live API usage capture: accumulates `realtimeInputTokens` / `realtimeOutputTokens` from `metrics_collected` events; writes `sttModel: "live_api"` and `ttsModel: "live_api"` since the Live API absorbs both. Cascading usage capture: unchanged — reads from `session.usage.modelUsage` on close.
> - **Why:** Mixing two fundamentally different pipeline shapes (end-to-end realtime audio vs. three-stage STT/LLM/TTS) in one function made both harder to read, test, and extend independently. The split makes each path self-documenting and removes the risk of a cascading-specific change accidentally affecting the Live API path.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(runLiveApiSession + runCascadingSession extracted; writeUsage helper added; makeAgentEntry reduced to connect + route)_

---

### 🗄️ Data & Infrastructure

---

> ### Pricing — Gemini Live API Token Rates Added (Verified Against Google Docs)
>
> - **What changed:** Three Gemini Live API model entries added to `PROVIDER_RATES` in `pricing.ts`, with rates verified against the official Google AI pricing page (`ai.google.dev/gemini-api/docs/pricing`). `gemini-live-2.5-flash-native-audio`: audio input **$3.00/1M tokens**, audio output **$12.00/1M tokens**. `gemini-3.1-flash-live-preview`: same tier at **$3.00/$12.00** (preview pricing matches 2.5 Flash Live). `gemini-2.0-flash-exp` (deprecated Feb 2026, shutting down Jun 2026): audio input **$0.70/1M**, audio output **$0.40/1M**. All three have `stt` and `tts` rates of $0 — the Live API absorbs STT and TTS into the single model charge. Key ordering was also fixed: the more specific `gemini-2.0-flash-exp` key is now placed above `gemini-2.0-flash` in the `PROVIDER_RATES` object. `lookupRates()` uses substring matching, so without this ordering `"gemini-2.0-flash-exp"` would have matched the `"gemini-2.0-flash"` entry (text rates) instead of its own audio-rate entry. The header comment was updated to `2026-05` and a source URL added above the Live API block. The cascading Gemini entries (`gemini-2.0-flash`, `gemini-3-flash-preview`) were moved below the Live API block to reinforce the ordering rule.
> - **Why:** Live API calls previously showed $0.00 cost because `pricing.ts` had no entries for any Live API model. Audio tokens are billed at 25 tokens/second and priced ~6–30x higher than text tokens depending on the model — using audio rates is the correct approximation for voice calls where the vast majority of tokens are audio. The substring-match ordering bug would have silently applied text rates ($0.10/$0.40) to `gemini-2.0-flash-exp` Live API calls instead of the correct audio rates ($0.70/$0.40).
> - **Files:**
>   - `src/lib/pricing.ts` _(Live API entries added with verified rates; key ordering fixed; cascading entries moved below Live API block; header and source comment updated)_

---

> ### Playground — Instructions Sections Collapse on Click-Outside
>
> - **What changed:** Each prompt section in the Playground instructions panel now toggles between a compact preview and an expanded textarea. **Compact state (default):** the section content is rendered as a clickable `div` with `line-clamp-3`, showing at most three lines with ellipsis and an "Empty" placeholder when blank. **Expanded state:** clicking the div (or pressing Enter) switches to a full auto-height `Textarea` with `autoFocus`. Clicking or tabbing outside the textarea collapses it back after a 150ms debounce. The debounce (via `blurTimerRef`) is cancelled by `onMouseDown` on any compact div, preventing a flicker when moving focus directly from one section to another. `activeSection` state (type `keyof PromptSections | null`) tracks which section is open; `blurTimerRef` holds the pending timeout ID.
> - **Why:** With all sections expanded simultaneously the instructions panel becomes a wall of text that is hard to scan. The click-to-expand pattern lets operators quickly read all sections in compact form and dive into the one they want to edit, without the others expanding or scrolling away.
> - **Files:**
>   - `src/components/PlaygroundClient.tsx` _(activeSection state; blurTimerRef; section map replaced with compact div / Textarea toggle; 150ms blur debounce)_

---

> ### Agents — Live/Paused Status Moved to `status/current` Subcollection
>
> - **What changed:** `voiceEnabled` is no longer the sole write target when toggling an agent Live or Paused. `setAgentLiveStatus()` now does a batch write: the source of truth goes to `agents/{agentKey}/status/current` (`{ voiceEnabled, updatedAt, updatedBy, updatedByName }`), and `voiceEnabled` is also written to the parent doc as a denormalized field so `listAgents()` can read the sidebar dot without an extra subcollection fetch per agent. `getAgent()` was extended to read `status/current` in the same `Promise.all` that already reads `config/voice`, and overlays `voiceEnabled` from the subcollection onto the merged agent object (backward-compat: falls back to parent doc field for agents not yet toggled with new code). `createAgent()` now writes an initial `status/current` doc (`voiceEnabled: false`) as part of the same batch that creates the parent doc and `config/voice`. Additionally, the registry guard in `setAgentLiveStatus()` that blocked the toggle for dynamic agents (not in the static registry) has been removed — the function now works for all agents.
> - **Why:** Storing operational state (`voiceEnabled`) alongside structural metadata and config on a single flat document makes it harder to apply targeted Firestore security rules and harder to build a status-change audit log. The `status` subcollection mirrors the pattern used for `config/voice` and gives a clear, isolated location for present and future agent state (e.g. `status/history` for past toggles). The registry guard bug also meant dynamic agents — the majority of UI-created agents — could never be toggled Live.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(setAgentLiveStatus: batch write to status/current + parent denorm; registry guard removed; getAgent: status/current read in Promise.all, voiceEnabled overlaid; createAgent: initial status/current doc in batch)_

---

> ### Agents — Voice Settings Moved to `config/voice` Subcollection
>
> - **What changed:** `voiceSettings` is no longer written to the top-level `agents/{agentKey}` document. It is now stored in the `agents/{agentKey}/config/voice` subcollection document. **Writes:** `updateAgentConfig()` splits the incoming payload into two parts — non-voiceSettings Tier-1 fields (name, instructions, etc.) go to the parent doc; all `voiceSettings` sub-fields go to `config/voice` via a Firestore batch commit, so both writes are atomic. **Reads:** `getAgent()` now issues two parallel reads (`Promise.all`) — the parent doc and `config/voice` — then overlays the subcollection data on top of the parent doc's `voiceSettings` before merging. This makes the subcollection the source of truth while preserving backward compatibility for agents whose `config/voice` doc doesn't exist yet (they continue reading from the parent doc's `voiceSettings` field). **Sidebar performance:** `useLiveApi` is denormalized to the parent doc on every save so `listAgents()` (which only reads parent docs) can still render the "Live" badge in the sidebar without issuing a subcollection fetch per agent. **New agents:** `createAgent()` now uses a pre-generated `docRef` and a batch write to atomically create both the parent doc and the `config/voice` subcollection doc in a single round-trip, removing the previous `col.add()` + `docRef.update({ key })` pattern.
> - **Why:** Storing all configuration in a flat top-level document mixes structural metadata (direction, dispatchRuleName, userId) with operational config (provider selections, model choices, API key references). The subcollection separation gives each concern its own document, makes Firestore security rules easier to scope (e.g. restrict `config/voice` writes to server-side only), and opens a clear path to versioned config history (`config/{timestamp}`) without restructuring the parent doc.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(AgentFirestoreDoc: useLiveApi denormalized field; mergeAgentData: reads useLiveApi from top-level first; getAgent: parallel reads parent + config/voice, backward-compat merge; updateAgentConfig: batch split — voiceSettings → subcollection, rest → parent, useLiveApi denormalized; createAgent: pre-generated docRef + batch write for parent + config/voice)_

---

## 🗓️ **2026-05-25**

---

### ✨ Features

---

> ### Voice & Behavior — ElevenLabs Voice Browser with Audio Previews and Filters
>
> - **What changed:** The TTS Voice ID field in the Voice & Behavior tab was replaced by a "Browse voices…" button that opens a full-screen **VoicePickerModal**. The modal fetches the user's available ElevenLabs voices from a new `GET /api/elevenlabs/voices` route, which proxies the ElevenLabs API with a 5-minute Next.js revalidation cache. Voices are displayed in a scrollable list with search (name, accent, description, use case) and three sets of filter pills: **Gender** (Male / Female), **Age** (Young / Middle Aged / Old), and **Use** (Conversational / Narration / News Presenter / Characters / Assistant). Each row shows a play button that uses the voice's `preview_url` directly in the browser (`new Audio(preview_url)`), plus a gender/accent/age/use-case tag cluster. Selecting a voice stores both `voice_id` and display name in form state; the trigger button updates to show the selected voice name. The API route resolves the ElevenLabs API key from the user's `providerConfigs` vault (via `configId` param + Bearer auth) or falls back to `ELEVENLABS_API_KEY` env var, matching the pattern used by the other provider routes.
> - **Why:** The raw ElevenLabs voice ID is a UUID string with no human context — operators had no way to discover or audition voices without leaving the product. The browser brings the full voice catalogue, with audio previews and metadata filtering, into the same settings panel where the voice is configured.
> - **Files:**
>   - `src/components/VoicePickerModal.tsx` _(new — full-screen modal with search, filter pills, play/pause preview, select button)_
>   - `src/app/api/elevenlabs/voices/route.ts` _(new — proxies ElevenLabs voices list; configId vault or env key; 5-min revalidation)_
>   - `src/components/VoiceBehaviorTab.tsx` _(Browse voices trigger button; showVoicePicker state; selectedVoiceName display; VoicePickerModal rendered conditionally)_

---

> ### Voice & Behavior — Gemini Live API Voice Browser with Audio Previews and Gender/Character Filters
>
> - **What changed:** The Live API voice dropdown in the Voice & Behavior tab was replaced by a "Browse voices…" button that opens a full-screen **GeminiVoicePickerModal**. The modal has a static list of all 30 Gemini voices (named after astronomical objects — planetary moons and stars) with search (name or tone descriptor) and two sets of filter pills: **Gender** (Female / Male) and **Character** (Bright / Warm / Clear / Authoritative / Deep / Smooth / Energetic). Each voice row shows a play button that calls `GET /api/gemini/voice-preview?voice=...` to generate a short audio clip via the Gemini TTS API. Gender is assigned from community benchmark data (voicerankings.com) since Google publishes no official gender metadata. Voice cards show gender (pink for Female, blue for Male), tone descriptor, and character category (violet) as badge tags. A header note clarifies that language follows the agent's system prompt, not the voice selection. The footer shows the count of filtered voices and reiterates the no-language-filter constraint.
> - **Why:** Gemini provides no static preview audio for Live API voices, and the voice names are astronomical object names with no intuitive meaning. Without previews and categorization operators cannot make an informed voice choice. Gender and character filters let operators narrow to a voice type first, then audition candidates.
> - **Files:**
>   - `src/components/GeminiVoicePickerModal.tsx` _(new — 30-voice static list with gender/character metadata; search + filter pills; play/pause via voice-preview API; select button)_
>   - `src/app/api/gemini/voice-preview/route.ts` _(new — generates WAV audio via gemini-2.5-flash-preview-tts; PCM16-to-WAV conversion; server-side in-memory cache; browser Cache-Control 24h)_
>   - `src/components/VoiceBehaviorTab.tsx` _(Browse voices trigger for Live API; showGeminiVoicePicker state; GeminiVoicePickerModal rendered conditionally)_

---

> ### Gemini Live API — Updated Model List to Latest Versions
>
> - **What changed:** The Live API model dropdown in the Voice & Behavior tab was updated from three stale model IDs to the current set: **Gemini 3.1 Flash Live (Preview)** (`gemini-3.1-flash-live-preview`, newest), **Gemini 2.5 Flash Native Audio** (`gemini-live-2.5-flash-native-audio`, stable), and **Gemini 2.0 Flash (Legacy)** (`gemini-2.0-flash-exp`). The worker fallback default in `sessionBuilder.ts` was updated from `gemini-2.0-flash-exp` to `gemini-live-2.5-flash-native-audio` so new agents default to the stable 2.5 model rather than the older experimental one.
> - **Why:** Model names were stale — `gemini-2.0-flash-exp` was the previous best-effort fallback but `gemini-live-2.5-flash-native-audio` is now the recommended production choice for the Live API. Using the wrong model in the default path would produce lower quality audio for operators who have not yet explicitly picked a model.
> - **Files:**
>   - `src/components/VoiceBehaviorTab.tsx` _(LIVE_API_MODELS constant updated with correct model IDs and display names)_
>   - `src/lib/agents/sessionBuilder.ts` _(fallback default changed from gemini-2.0-flash-exp to gemini-live-2.5-flash-native-audio)_

---

### 🏗️ Architecture

---

> ### Gemini Live API — Architecture Documentation Updated
>
> - **What changed:** `Architecture.md` updated across three sections. **Section 3 (High-Level Architecture diagram):** AI agent worker box now shows both pipeline modes side-by-side — cascading (default) and Gemini Live API (playground only, phase 1). **Section 5 (Firestore Data Model):** `voiceSettings` table extended with four new fields: `useLiveApi`, `liveApiModel`, `liveApiVoice`, `liveApiConfigId`. **Section 10 (AI Voice Pipeline):** replaced the single pipeline flow with two separate ASCII flow diagrams — one for cascading (reads `session.usage.modelUsage` on close) and one for Live API (reads accumulated `realtimeInputTokens`/`realtimeOutputTokens` from `metrics_collected` events on close). Added a Phase 1 gate note explaining the outbound override and a four-row API key fallback table including the new `liveApiKey → GEMINI_API_KEY` fallback.
> - **Why:** The architecture doc is the first place a new engineer reads to understand system behaviour. Without this update it would describe a system that no longer exists — a single cascading pipeline — rather than the dual-mode design now in production.
> - **Files:**
>   - `Architecture.md` _(section 3 diagram, section 5 voiceSettings table, section 10 pipeline flows, phase 1 gate note, key fallback table)_

---

> ### Gemini Live API — Phase 1 Routing Gate (Outbound Blocked, Playground Unrestricted)
>
> - **What changed:** Added a phase 1 gate in `POST /api/calls/outbound`. After resolving agent data, if `voiceSettings.useLiveApi` is true, the route clones the agent data with `useLiveApi: false`, emits a `console.warn` with `agentKey` and `roomName`, and builds dispatch metadata from the gated clone. The gate ensures the cascading pipeline is always used for real phone calls in phase 1. `pipelineMode` in the call history record correctly reflects `"cascading"` for gated calls. The test route (`/api/calls/test`) has no gate — browser playground tests use the Live API when the toggle is on.
> - **Why:** The Live API requires audio to travel over WebRTC, which works correctly in the browser playground. PSTN calls go through the Twilio SIP → LiveKit audio path, which has not yet been validated with the Live API. The gate prevents unvalidated paths from reaching production callers while keeping playground testing fully functional.
> - **Files:**
>   - `src/app/api/calls/outbound/route.ts` _(phase 1 gate — clones agentData with useLiveApi:false; console.warn on gate fire; gated clone used for resolveProviderKeys + buildDispatchMetadata)_

---

> ### Gemini Live API — Phase 1 Playground-Only Note in Voice & Behavior Tab
>
> - **What changed:** When the Gemini Live API toggle is enabled, an amber informational banner now appears at the top of the Live API settings section (inside the toggle card). The banner explains that Live API is currently active only in browser playground tests, and that real phone calls (inbound and outbound) continue to use the cascading STT → LLM → TTS pipeline until phase 2 is enabled. The banner uses the existing `AlertCircle` icon and is styled with `bg-amber-500/10 border border-amber-500/20` to be prominent without looking like an error.
> - **Why:** Without this note, an operator who enables the toggle and makes a phone call would see no difference in behaviour and have no way to know why. The banner sets the expectation upfront and points at the phase 2 path forward.
> - **Files:**
>   - `src/components/VoiceBehaviorTab.tsx` _(amber phase 1 banner inside the useLiveApi toggle card)_

---

> ### Gemini Live API — "Live" Badge on Agent Sidebar Entries
>
> - **What changed:** Agent entries in the sidebar now display a small "Live" badge when `voiceSettings.useLiveApi` is true. The badge is rendered inside the sidebar link, between the agent name and the right edge, using a violet pill style that is visually distinct from the green voice-enabled dot. To make the field available without changing the prop type on `Sidebar` or `AppLayout`, `useLiveApi?: boolean` was added as an overlaid field on `AgentConfig` (following the same pattern as `voiceEnabled`), and `mergeAgentData()` in `agents.ts` now sets it from `doc.voiceSettings?.useLiveApi`.
> - **Why:** Operators managing multiple agents need a quick at-a-glance signal in the navigation to know which agents are running the Live API pipeline, without opening each agent's settings.
> - **Files:**
>   - `src/lib/agents/registry.ts` _(useLiveApi added to AgentConfig as an overlaid field)_
>   - `src/lib/firebase/agents.ts` _(mergeAgentData sets useLiveApi from voiceSettings)_
>   - `src/components/Sidebar.tsx` _("Live" badge rendered when agent.useLiveApi is true)_

---

> ### Gemini Live API — Toggle, Settings Panel, and Pipeline Dimming in Voice & Behavior Tab
>
> - **What changed:** **Toggle:** A "Use Gemini Live API (experimental)" toggle switch is now rendered at the top of the Voice & Behavior panel, above the LLM section. It is bound to `voiceSettings.useLiveApi` and persisted to Firestore on save. **Live API settings panel:** when the toggle is on, a "Gemini Live Settings" section expands inside the toggle card with a model dropdown (`LIVE_API_MODELS`), a voice dropdown (`LIVE_API_VOICES`), and an API key picker bound to `liveApiConfigId`. The API key picker reuses the same vault flow as the other providers. **Pipeline dimming:** when the toggle is on, the LLM, TTS, and STT provider sections each reduce to `opacity-40 pointer-events-none` and display a one-line inline note ("Disabled — Gemini Live API handles the full pipeline."). Values in those sections are preserved in form state so they can be restored if the toggle is turned off without a save. **FormState** extended with `useLiveApi`, `liveApiModel`, `liveApiVoice`, `liveApiConfigId`. `fromData()` and `defaultForm` updated to read/initialise these fields. `doSave()` includes all four fields in the PATCH payload.
> - **Why:** The toggle is the primary user-facing control for this feature. Keeping the cascading-pipeline fields visible but dimmed makes it clear that those settings still exist and will be used if the toggle is turned off — rather than hiding them and making operators wonder where they went.
> - **Files:**
>   - `src/components/VoiceBehaviorTab.tsx` _(useLiveApi toggle; Live API settings section; LLM/TTS/STT dimming; FormState + fromData + defaultForm + doSave extended)_

---

> ### Gemini Live API — Structured Pipeline-Mode Logging at Dispatch and Session Start
>
> - **What changed:** **Worker (`genericEntry.ts`):** immediately after `buildSession()` resolves, a single structured `logger.info` line is emitted with `{ pipelineMode, model, voice?, room }`. `pipelineMode` is `"live_api"` or `"cascading"`. `model` is the resolved Live API model or the resolved LLM model for the cascading path. `voice` is included only when `pipelineMode` is `"live_api"` (e.g. `"Puck"`). `room` is `ctx.room.name`. **Control plane (`outbound/route.ts`, `test/route.ts`):** a `console.info("[Pipeline] dispatch", { pipelineMode, agentKey, roomName })` line is emitted immediately before `createDispatch()` in both routes, so every dispatch is traceable from server logs without opening the call history UI.
> - **Why:** Without a log line at session start, the only way to confirm which pipeline ran a given call was to read the usage JSON file after the call ended. Logging at dispatch time and again at session start gives two independent checkpoints — useful when debugging agent-not-picking-up issues where the session never starts.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(structured log line at session start with pipelineMode, model, voice, room)_
>   - `src/app/api/calls/outbound/route.ts` _(console.info at dispatch with pipelineMode, agentKey, roomName)_
>   - `src/app/api/calls/test/route.ts` _(console.info at dispatch with pipelineMode, agentKey, roomName)_

---

> ### Gemini Live API — Greeting, Lifecycle, and Usage Logging in Live Mode
>
> - **What changed:** `genericEntry.ts` updated to correctly handle the Live API session lifecycle. **Greeting:** `session.say()` returns an awaitable `SpeechHandle` and works identically in both modes — no change required; the existing try/catch guard remains. **Live API lifecycle events:** added `metrics_collected` listener that accumulates `inputTokens`/`outputTokens` from `realtime_model_metrics` events and logs `ttftMs` and model name per generation; added `session_usage_updated` listener that logs the `modelUsage` array. These events are not emitted by the cascading pipeline so the listeners add Live API observability without affecting existing behaviour. **Usage writer:** now branches on `meta.useLiveApi` — in Live mode it uses the accumulated realtime token counters and sets `sttModel`/`ttsModel` to `"live_api"` (the Live API handles audio natively, so no separate STT/TTS figures exist); in cascading mode the existing `session.usage.modelUsage` logic is unchanged. The outer try/catch on the close handler ensures neither branch can crash the worker.
> - **Why:** The Live API emits usage through `realtime_model_metrics` events rather than the `llm_usage`/`tts_usage`/`stt_usage` entries the cascading writer expects. Without branching, every Live API call would log zero tokens. The new lifecycle event listeners give operators visibility into per-generation latency and token counts without requiring a separate monitoring tool.
> - **Files:**
>   - `src/lib/agents/genericEntry.ts` _(metrics_collected + session_usage_updated listeners; usage writer branched on useLiveApi; accumulated realtime token counters)_

---

> ### Gemini Live API — Session Builder (`sessionBuilder.ts`)
>
> - **What changed:** Extracted all STT/LLM/TTS construction logic from `genericEntry.ts` into a new `src/lib/agents/sessionBuilder.ts` module. The module exports `AgentDefaults`, `WorkerDispatchMeta` (superset of the old local `DispatchMeta`, now including `useLiveApi`, `liveApiModel`, `liveApiVoice`, `liveApiKey`), and `buildSession(meta, defaults) → voice.AgentSession`. When `meta.useLiveApi` is true, `buildSession` instantiates `google.beta.realtime.RealtimeModel` with the Live API model, voice, key, and system prompt, and returns a `voice.AgentSession` with no STT or TTS components. When false, it returns the existing cascading `deepgram.STT → google/openai.LLM → elevenlabs/cartesia.TTS` session unchanged. `genericEntry.ts` is now lifecycle-only: it connects, parses metadata, calls `buildSession`, wires session events, starts the session, plays the greeting, and writes usage on close. `AgentDefaults` is re-exported from `genericEntry.ts` so the two agent worker files require no changes.
> - **Why:** Adding a second pipeline mode inline would have doubled the complexity of `makeAgentEntry`. A dedicated builder keeps each pipeline self-contained and testable in isolation.
> - **Files:**
>   - `src/lib/agents/sessionBuilder.ts` _(new — AgentDefaults, WorkerDispatchMeta, buildSession with Live API and cascading branches)_
>   - `src/lib/agents/genericEntry.ts` _(refactored to lifecycle-only; imports buildSession; re-exports AgentDefaults)_

---

### 🗄️ Data & Infrastructure

---

> ### Gemini Live API — `pipelineMode` Field on Call History Documents
>
> - **What changed:** Added `pipelineMode?: "cascading" | "live_api"` to the `CallRecord` interface in `history.ts`. Both dispatch routes now derive the mode from `agentData.voiceSettings?.useLiveApi` immediately after building dispatch metadata and pass it to `addCallRecord`. Both routes default to `"cascading"` if the agent fetch fails, so the field is always present on new documents. Existing call history documents are not backfilled.
> - **Why:** Cost analysis, quality comparison, and debugging all require knowing which pipeline ran each call. Without this field there is no way to filter or attribute call records to a specific pipeline mode after the fact.
> - **Files:**
>   - `src/lib/history.ts` _(pipelineMode added to CallRecord interface)_
>   - `src/app/api/calls/outbound/route.ts` _(pipelineMode derived from agentData and written to call record)_
>   - `src/app/api/calls/test/route.ts` _(pipelineMode derived from agentData and written to call record)_

---

> ### Gemini Live API — Dispatch Metadata and Key Resolution
>
> - **What changed:** **`DispatchMetadata`** extended with `useLiveApi: boolean` (always emitted), plus optional `liveApiModel`, `liveApiVoice`, and `liveApiKey`. **`ResolvedProviderKeys`** extended with `liveApiKey`. **`buildDispatchMetadata()`** now always writes `useLiveApi` (true/false) so the worker can branch without a null check; all existing cascading-pipeline fields (`llmApiKey`, `ttsApiKey`, `sttApiKey`, etc.) are always included in the JSON regardless of the toggle state to keep the shape stable for logging. When `useLiveApi` is true, `liveApiModel`, `liveApiVoice`, and `liveApiKey` are appended; when false they are omitted. **`resolveProviderKeys()`** adds resolution for `liveApiConfigId` → raw API key, using the same `getProviderConfig` path as the other three providers.
> - **Why:** The agent worker reads all runtime config from dispatch metadata and must have everything it needs to construct the correct pipeline without Firestore access at call time. Keeping the cascading-pipeline fields in metadata regardless of the toggle means log consumers don't need to handle two different JSON shapes.
> - **Files:**
>   - `src/lib/agents/promptBuilder.ts` _(DispatchMetadata + ResolvedProviderKeys extended; buildDispatchMetadata always sets useLiveApi, conditionally appends Live API fields)_
>   - `src/lib/firebase/resolveProviderKeys.ts` _(liveApiConfigId → liveApiKey resolution added)_

---

> ### Gemini Live API — Provider Key Resolution with Environment Fallback
>
> - **What changed:** `resolveProviderKeys()` now gates the entire Live API key lookup behind `vs?.useLiveApi` — when the toggle is off the Firestore read is skipped entirely. When the toggle is on and `liveApiConfigId` is set, the raw key is fetched from the `providerConfigs` vault as usual. When the toggle is on but no `liveApiConfigId` is configured, the function falls back to `process.env.GEMINI_API_KEY` and writes it into `result.liveApiKey`. The property was also renamed from `liveApiApiKey` → `liveApiKey` in both `ResolvedProviderKeys` and `DispatchMetadata` for naming consistency with the rest of the Live API field set.
> - **Why:** Resolving a key on every dispatch for agents that never use the Live API wastes a Firestore read. The env fallback makes the feature usable out of the box — operators who rely on the global Gemini key don't need to re-enter it as a named vault credential. Raw keys resolved here stay server-side and never reach the browser.
> - **Files:**
>   - `src/lib/firebase/resolveProviderKeys.ts` _(useLiveApi guard; GEMINI_API_KEY env fallback; liveApiApiKey → liveApiKey rename)_
>   - `src/lib/agents/promptBuilder.ts` _(liveApiApiKey → liveApiKey rename in DispatchMetadata, ResolvedProviderKeys, and buildDispatchMetadata)_

---

> ### Gemini Live API — Firestore Schema Extension
>
> - **What changed:** Added four new optional fields to the `voiceSettings` sub-object on `agents/{agentKey}` Firestore documents: `useLiveApi` (boolean, default absent = false), `liveApiModel` (string), `liveApiVoice` (string), and `liveApiConfigId` (string). All four are optional — existing documents require no migration and continue to operate on the STT→LLM→TTS pipeline. Updated the `VoiceSettings` TypeScript interface in `agents.ts` to declare all four fields. Extended `VoiceSettingsWriteSchema` (Zod) with corresponding validators so the fields pass through the Tier-1 write path to Firestore.
> - **Why:** Each agent must be able to independently store its Live API preference and associated model/voice/key reference without losing its existing STT/LLM/TTS settings. These fields are the foundation for the per-agent toggle that swaps the modular pipeline for Google's native multimodal audio.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(VoiceSettings interface + VoiceSettingsWriteSchema extended with useLiveApi, liveApiModel, liveApiVoice, liveApiConfigId)_

---

> ### Gemini Live API — Zod Validation for Create/Update Endpoints
>
> - **What changed:** **`VoiceSettingsWriteSchema`:** added `.min(1)` to the three new string Live API fields so empty strings are rejected when a value is provided. **`POST /api/agents`:** replaced the bare `req.json()` destructure with a formal `CreateAgentBodySchema` (Zod) covering all existing creation fields plus an optional `voiceSettings` object accepting the four Live API fields; validation errors now return HTTP 400 with field-path messages (e.g. `voiceSettings.liveApiModel: String must contain at least 1 character(s)`). **`PATCH /api/agents/[agentKey]`:** error format updated from bare message strings to `path.field: message` format so Live API field violations are identified precisely. **`CreateAgentParams`** extended with the four optional Live API fields; **`createAgent()`** merges any provided values into the default `voiceSettings` at document creation time.
> - **Why:** API routes must safely reject malformed input before it reaches Firestore. The POST route had no Zod schema at all, making it impossible to return structured validation errors. Field-level error paths let clients surface the exact invalid field without guessing.
> - **Files:**
>   - `src/lib/firebase/agents.ts` _(min(1) on string Live API fields; CreateAgentParams extended; createAgent merges initial Live API settings)_
>   - `src/app/api/agents/route.ts` _(CreateAgentBodySchema added; POST uses safeParse; voiceSettings threaded to createAgent)_
>   - `src/app/api/agents/[agentKey]/route.ts` _(PATCH error format includes field paths)_

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
