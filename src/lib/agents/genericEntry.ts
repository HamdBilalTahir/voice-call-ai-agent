/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { type JobContext, voice, defineAgent, log } from "@livekit/agents";
import { RoomEvent } from "@livekit/rtc-node";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  type AgentDefaults,
  type WorkerDispatchMeta,
  buildSession,
  buildLiveApiInstructions,
} from "./sessionBuilder";
import { buildVoiceTools, isFarewell } from "./voiceTools";
import { getDb } from "./workerFirestore";

export type { AgentDefaults } from "./sessionBuilder";

// ── Shared helpers ────────────────────────────────────────────────────────────

async function appendTurn(
  callHistoryId: string,
  turn: object & { speaker: string; text: string },
): Promise<void> {
  const logger = log();
  logger.info(
    { callHistoryId, speaker: turn.speaker, textLen: turn.text.length },
    "[Transcript] appending turn",
  );
  try {
    await getDb()
      .collection("callHistory")
      .doc(callHistoryId)
      .collection("transcripts")
      .add({ ...turn, ts: Date.now() });
    logger.info(
      { callHistoryId, speaker: turn.speaker },
      "[Transcript] turn saved to Firestore",
    );
  } catch (err) {
    logger.error({ err, callHistoryId }, "[Transcript] Firestore write failed");
  }
}

function writeUsage(roomName: string, payload: object) {
  const usageDir = path.join(process.cwd(), ".agent-usage");
  fs.mkdirSync(usageDir, { recursive: true });
  fs.writeFileSync(
    path.join(usageDir, `${roomName}.json`),
    JSON.stringify(payload),
  );
}

// ── SIP call-answered waiter ──────────────────────────────────────────────────

// Waits until the LiveKit SIP bridge sets sip.callStatus="active" on the phone
// participant, which happens only when the callee picks up. TrackSubscribed fires
// too early (during ringing) because the SIP bridge pre-subscribes the audio
// track before the call is answered. 60-second timeout as a fallback.
function waitForSipCallActive(
  ctx: JobContext,
  identity: string,
): Promise<void> {
  return new Promise((resolve) => {
    const isActive = (p: any) => p?.attributes?.["sip.callStatus"] === "active";

    const existing = ctx.room.remoteParticipants.get(identity);
    if (existing && isActive(existing)) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, 60_000);
    const handler = (
      changedAttrs: Record<string, string>,
      participant: any,
    ) => {
      if (
        participant.identity === identity &&
        changedAttrs["sip.callStatus"] === "active"
      ) {
        clearTimeout(timer);
        ctx.room.off(RoomEvent.ParticipantAttributesChanged, handler);
        resolve();
      }
    };
    ctx.room.on(RoomEvent.ParticipantAttributesChanged, handler);
  });
}

// ── Live API pipeline ─────────────────────────────────────────────────────────

async function runLiveApiSession(
  ctx: JobContext,
  meta: WorkerDispatchMeta,
  defaults: AgentDefaults,
) {
  const logger = log();
  const model = meta.liveApiModel ?? "gemini-live-2.5-flash-native-audio";
  const voice_ = meta.liveApiVoice ?? "Puck";
  const roomName = ctx.room.name ?? "unknown";

  logger.info(
    { pipelineMode: "live_api", model, voice: voice_, room: roomName },
    "[Pipeline] session starting",
  );

  let realtimeInputTokens = 0;
  let realtimeOutputTokens = 0;

  logger.info(
    { callHistoryId: meta.callHistoryId, agentKey: meta.agentKey },
    "[Pipeline] building session",
  );
  const session = buildSession(meta, defaults);
  const s = session as any;

  const callHistoryId = meta.callHistoryId;
  logger.info(
    { callHistoryId, hasCallHistoryId: !!callHistoryId },
    "[Pipeline] callHistoryId resolved",
  );

  // Track all in-flight Firestore transcript writes so the close handler can
  // await them before exiting — prevents turns being lost when SIGTERM fires.
  const pendingTranscriptWrites: Promise<void>[] = [];

  function saveTurn(turn: { speaker: string; text: string }) {
    if (!callHistoryId) return;
    const p = appendTurn(callHistoryId, turn);
    pendingTranscriptWrites.push(p);
  }

  s.on("user_input_transcribed", (ev: any) => {
    logger.info(
      { transcript: ev.transcript, isFinal: ev.isFinal },
      "[STT] transcript",
    );
    if (ev.isFinal && ev.transcript?.trim()) {
      console.log(`[Transcript] User: ${ev.transcript.trim()}`);
      saveTurn({ speaker: "user", text: ev.transcript.trim() });
    }
  });
  let thinkingStartMs: number | null = null;
  s.on("agent_state_changed", (ev: any) => {
    console.log(`[Agent] state: ${ev.oldState} → ${ev.newState}`);
    logger.info(
      { from: ev.oldState, to: ev.newState },
      "[Agent] state changed",
    );
    thinkingStartMs = ev.newState === "thinking" ? Date.now() : null;
  });

  // Safety-net watchdog: concurrent tool calls are now handled by the
  // optimistic pattern in voiceTools — at most one speech handle should be
  // open at any time, so this should never fire in practice. Kept as a
  // last-resort fallback for any unexpected stall scenario.
  const thinkingWatchdog = setInterval(() => {
    if (!thinkingStartMs) return;
    const stuckMs = Date.now() - thinkingStartMs;
    if (stuckMs < 30_000) return;
    logger.warn(
      { stuckMs },
      "[Pipeline] agent stuck in thinking for 30s — calling interrupt() as last resort",
    );
    thinkingStartMs = null;
    try {
      (session as any).interrupt();
    } catch (err) {
      logger.warn({ err }, "[Pipeline] interrupt() failed");
    }
  }, 5_000);
  s.on("conversation_item_added", (ev: any) => {
    const item = ev?.item;
    const role: string = item?.role ?? "";
    // textContent getter joins all text parts; undefined when native audio has no transcription
    const text: string = (item?.textContent ?? "").trim();
    logger.info(
      { role, textLen: text.length },
      "[Transcript] conversation_item_added",
    );
    if (role === "assistant" && text) {
      console.log(`[Transcript] Agent: ${text}`);
      saveTurn({ speaker: "agent", text });

      // Farewell detection — close the LiveKit room after the agent speaks a
      // closing phrase. deleteRoom() is used instead of ctx.room.disconnect()
      // because disconnecting only removes the agent; the SIP participant
      // (PSTN call) stays alive in the room. Deleting the room forces the SIP
      // bridge to hang up the call and closes the observer modal.
      if (isFarewell(text)) {
        logger.info(
          { text },
          "[Pipeline] farewell detected — scheduling room close",
        );
        const roomName = ctx.room.name ?? "";
        setTimeout(async () => {
          if (!roomName) return;
          try {
            const svc = new RoomServiceClient(
              process.env.LIVEKIT_URL!,
              process.env.LIVEKIT_API_KEY!,
              process.env.LIVEKIT_API_SECRET!,
            );
            await svc.deleteRoom(roomName);
            logger.info({ roomName }, "[Pipeline] room deleted — call ended");
          } catch {
            // Room may already be gone; fall back to agent disconnect
            try {
              ctx.room.disconnect();
            } catch {
              /* already closing */
            }
          }
        }, 3000);
      }
    }
  });
  s.on("error", (ev: any) => {
    logger.error({ err: ev.error }, "[Error] session error");
  });
  s.on("metrics_collected", (ev: any) => {
    const m = ev?.metrics;
    if (!m || m.type !== "realtime_model_metrics") return;
    realtimeInputTokens += m.inputTokens ?? 0;
    realtimeOutputTokens += m.outputTokens ?? 0;
    logger.info(
      {
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        ttftMs: m.ttftMs,
      },
      "[Live] realtime metrics",
    );
  });
  s.on("session_usage_updated", (ev: any) => {
    logger.info(
      { modelUsage: ev?.usage?.modelUsage },
      "[Live] session usage updated",
    );
  });

  // For SIP calls: wait for sip.callStatus="active" before starting Gemini.
  // The SIP bridge pre-subscribes the audio track during ringing, so TrackSubscribed
  // fires too early. The "active" attribute is set only when the callee answers.
  if (meta.sipParticipantIdentity) {
    logger.info(
      { participant: meta.sipParticipantIdentity },
      "[Live] waiting for SIP call active (callee answer)",
    );
    await waitForSipCallActive(ctx, meta.sipParticipantIdentity);
    logger.info(
      { participant: meta.sipParticipantIdentity },
      "[Live] SIP call active, starting session",
    );

    // When the callee hangs up the SIP participant disconnects — close the room
    // so the observer modal transitions to summary instead of staying "Connected".
    ctx.room.on(RoomEvent.ParticipantDisconnected, (p: any) => {
      if (p.identity === meta.sipParticipantIdentity) {
        logger.info(
          { identity: p.identity },
          "[Live] SIP participant disconnected — closing room",
        );
        setTimeout(() => {
          try {
            ctx.room.disconnect();
          } catch {
            /* already closing */
          }
        }, 1000);
      }
    });
  }

  const callStartMs = Date.now();
  const baseInstructions = meta.systemPrompt ?? defaults.systemPrompt;
  const greeting = meta.voiceGreeting ?? defaults.greeting;
  logger.info(
    {
      greetingLen: greeting?.length,
      instructionsLen: baseInstructions?.length,
    },
    "[Pipeline] building instructions",
  );
  // voice.Agent instructions override RealtimeModel constructor instructions via
  // _updateSession. Pass the full Live API instructions (with greeting + end-call
  // addenda) directly here so they are not stripped.
  const instructions = buildLiveApiInstructions(baseInstructions, greeting);
  logger.info(
    { totalInstructionsLen: instructions.length },
    "[Pipeline] instructions built",
  );

  // Build function-call tools that Gemini executes silently (no spoken output).
  const tools = buildVoiceTools();
  logger.info(
    { toolCount: Object.keys(tools).length, tools: Object.keys(tools) },
    "[Pipeline] tools built",
  );

  // Warn about any snake_case identifiers in the prompt that look like tool
  // references but have no matching registered tool — these were likely copied
  // from a different agent's prompt and will be silently unavailable to Gemini.
  const registeredTools = new Set(Object.keys(tools));
  const toolVerbPrefixes = [
    "create_",
    "update_",
    "delete_",
    "change_",
    "schedule_",
    "send_",
    "end_",
    "get_",
    "set_",
    "add_",
    "remove_",
    "list_",
    "fetch_",
    "book_",
    "cancel_",
    "search_",
  ];
  const promptRefs = [
    ...new Set(
      (baseInstructions ?? "").match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g) ??
        [],
    ),
  ];
  const missingTools = promptRefs.filter(
    (ref) =>
      !registeredTools.has(ref) &&
      toolVerbPrefixes.some((prefix) => ref.startsWith(prefix)),
  );
  if (missingTools.length > 0) {
    for (const name of missingTools) {
      logger.warn(
        { toolName: name },
        `[Pipeline] prompt references tool "${name}" which is not registered — it will be unavailable`,
      );
    }
  }

  logger.info(
    { sipParticipantIdentity: meta.sipParticipantIdentity },
    "[Pipeline] calling session.start()",
  );
  await session.start({
    agent: new voice.Agent({ instructions, tools }),
    room: ctx.room,
    ...(meta.sipParticipantIdentity
      ? { inputOptions: { participantIdentity: meta.sipParticipantIdentity } }
      : {}),
  });
  logger.info({}, "[Pipeline] session.start() returned — agent is live");

  // Trigger the initial greeting.
  // gemini-3.1-* blocks generateReply(); use sendRealtimeInput text trigger instead.
  // All other models support generateReply() directly.
  switch (true) {
    case model.includes("3.1"):
      try {
        const rtSession = (session as any).activity?.realtimeSession;
        if (!rtSession) throw new Error("realtimeSession not available");
        rtSession.sendClientEvent({
          type: "realtime_input",
          value: { text: "[call connected]" },
        });
        logger.info({}, "[Pipeline] sendRealtimeInput text trigger sent");
      } catch (err) {
        logger.warn({ err }, "[Pipeline] greeting trigger failed");
      }
      break;
    default:
      try {
        await session.generateReply();
        logger.info({}, "[Pipeline] initial generateReply() sent");
      } catch (err) {
        logger.warn({ err }, "[Pipeline] generateReply() failed");
      }
  }

  s.once("close", async () => {
    clearInterval(thinkingWatchdog);
    const durationMs = Date.now() - callStartMs;

    // Flush all in-flight transcript writes before the worker exits.
    if (pendingTranscriptWrites.length > 0) {
      logger.info(
        { count: pendingTranscriptWrites.length },
        "[Transcript] flushing pending writes before close",
      );
      await Promise.allSettled(pendingTranscriptWrites);
      logger.info({}, "[Transcript] flush complete");
    }

    try {
      writeUsage(roomName, {
        type: "call_usage",
        llmModel: model,
        inputTokens: realtimeInputTokens,
        outputTokens: realtimeOutputTokens,
        sttModel: "live_api",
        sttAudioMs: durationMs,
        ttsModel: "live_api",
        ttsCharacters: 0,
        ttsAudioMs: 0,
        callDurationMs: durationMs,
      });
      logger.info({ roomName }, "usage written to file");
    } catch (err) {
      logger.warn({ err }, "failed to write usage data");
    }
  });
}

// ── Cascading pipeline ────────────────────────────────────────────────────────

async function runCascadingSession(
  ctx: JobContext,
  meta: WorkerDispatchMeta,
  defaults: AgentDefaults,
) {
  const logger = log();
  const model = meta.llmModel ?? defaults.llmModel;

  logger.info(
    { pipelineMode: "cascading", model, room: ctx.room.name },
    "[Pipeline] session starting",
  );

  const session = buildSession(meta, defaults);
  const s = session as any;

  s.on("user_input_transcribed", (ev: any) => {
    logger.info(
      { transcript: ev.transcript, isFinal: ev.isFinal },
      "[STT] transcript",
    );
  });
  s.on("agent_state_changed", (ev: any) => {
    logger.info(
      { from: ev.oldState, to: ev.newState },
      "[Agent] state changed",
    );
  });
  s.on("error", (ev: any) => {
    logger.error({ err: ev.error }, "[Error] session error");
  });

  const callStartMs = Date.now();
  const instructions = meta.systemPrompt ?? defaults.systemPrompt;
  const greeting = meta.voiceGreeting ?? defaults.greeting;

  await session.start({
    agent: new voice.Agent({ instructions }),
    room: ctx.room,
    ...(meta.sipParticipantIdentity
      ? { inputOptions: { participantIdentity: meta.sipParticipantIdentity } }
      : {}),
  });

  try {
    await session.say(greeting, { allowInterruptions: true });
  } catch (err) {
    logger.warn({ err }, "greeting failed");
  }

  const roomName = ctx.room.name ?? "unknown";
  s.once("close", async () => {
    try {
      const rawUsage = (session as any).usage?.modelUsage ?? [];
      const llmUsage = rawUsage.find((u: any) => u.type === "llm_usage") ?? {};
      const ttsUsage = rawUsage.find((u: any) => u.type === "tts_usage") ?? {};
      const sttUsage = rawUsage.find((u: any) => u.type === "stt_usage") ?? {};

      writeUsage(roomName, {
        type: "call_usage",
        llmModel: meta.llmModel ?? defaults.llmModel,
        inputTokens: llmUsage.inputTokens ?? 0,
        outputTokens: llmUsage.outputTokens ?? 0,
        sttModel: `deepgram-${meta.sttModel ?? defaults.sttModel}`,
        sttAudioMs: sttUsage.audioDurationMs ?? Date.now() - callStartMs,
        ttsModel: meta.ttsModel ?? defaults.ttsModel,
        ttsCharacters: ttsUsage.charactersCount ?? 0,
        ttsAudioMs: ttsUsage.audioDurationMs ?? 0,
        callDurationMs: Date.now() - callStartMs,
      });
      logger.info({ roomName }, "usage written to file");
    } catch (err) {
      logger.warn({ err }, "failed to write usage data");
    }
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function makeAgentEntry(defaults: AgentDefaults) {
  return defineAgent({
    entry: async (ctx: JobContext) => {
      console.log(`[ENTRY] ${defaults.workerName} subprocess started`);
      const logger = log();
      try {
        console.log(`[ENTRY] connecting to room`);
        logger.info(
          `[${defaults.workerName}] entry started, connecting to room`,
        );
        await ctx.connect();
        console.log(`[ENTRY] connected to room`);
        logger.info(`[${defaults.workerName}] connected to room`);

        let meta: WorkerDispatchMeta = {};
        try {
          meta = JSON.parse(ctx.job.metadata || "{}") as WorkerDispatchMeta;
          logger.info(
            {
              useLiveApi: meta.useLiveApi,
              agentKey: meta.agentKey,
              callHistoryId: meta.callHistoryId,
              sipParticipantIdentity: meta.sipParticipantIdentity,
              liveApiModel: meta.liveApiModel,
              liveApiVoice: meta.liveApiVoice,
              hasSystemPrompt: !!meta.systemPrompt,
              hasGreeting: !!meta.voiceGreeting,
            },
            `[${defaults.workerName}] dispatch metadata parsed`,
          );
        } catch (err) {
          logger.warn(
            { err },
            `[${defaults.workerName}] malformed metadata — using static defaults`,
          );
        }

        if (meta.useLiveApi) {
          logger.info(
            {},
            `[${defaults.workerName}] routing to Live API pipeline`,
          );
          await runLiveApiSession(ctx, meta, defaults);
        } else {
          logger.info(
            {},
            `[${defaults.workerName}] routing to cascading pipeline`,
          );
          await runCascadingSession(ctx, meta, defaults);
        }
      } catch (err) {
        console.error(`[ENTRY] fatal error:`, err);
        logger.error({ err }, `[${defaults.workerName}] fatal error in entry`);
      }
    },
  });
}
