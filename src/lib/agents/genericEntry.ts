/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { type JobContext, voice, defineAgent, log } from "@livekit/agents";
import { RoomEvent } from "@livekit/rtc-node";
import {
  type AgentDefaults,
  type WorkerDispatchMeta,
  buildSession,
  buildLiveApiInstructions,
} from "./sessionBuilder";
import { buildVoiceTools } from "./voiceTools";
import { getDb } from "./workerFirestore";

export type { AgentDefaults } from "./sessionBuilder";

// ── Shared helpers ────────────────────────────────────────────────────────────

function appendTurn(
  callHistoryId: string,
  turn: object & { speaker: string; text: string },
) {
  const logger = log();
  logger.info(
    { callHistoryId, speaker: turn.speaker, textLen: turn.text.length },
    "[Transcript] appending turn",
  );
  getDb()
    .collection("callHistory")
    .doc(callHistoryId)
    .collection("transcripts")
    .add({ ...turn, ts: Date.now() })
    .then(() =>
      logger.info(
        { callHistoryId, speaker: turn.speaker },
        "[Transcript] turn saved to Firestore",
      ),
    )
    .catch((err) =>
      logger.error(
        { err, callHistoryId },
        "[Transcript] Firestore write failed",
      ),
    );
}

function writeUsage(roomName: string, payload: object) {
  const usageDir = path.join(process.cwd(), ".agent-usage");
  fs.mkdirSync(usageDir, { recursive: true });
  fs.writeFileSync(
    path.join(usageDir, `${roomName}.json`),
    JSON.stringify(payload),
  );
}

// ── SIP participant waiter ────────────────────────────────────────────────────

// Waits until the SIP phone participant joins the room (60-second timeout).
// The participant appears in the room when the callee answers, or very shortly
// after createSipParticipant is called — whichever comes first.
function waitForSipParticipant(
  ctx: JobContext,
  identity: string,
): Promise<void> {
  return new Promise((resolve) => {
    if (ctx.room.remoteParticipants.has(identity)) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 60_000);
    const handler = (p: any) => {
      if (p.identity === identity) {
        clearTimeout(timer);
        ctx.room.off(RoomEvent.ParticipantConnected, handler);
        resolve();
      }
    };
    ctx.room.on(RoomEvent.ParticipantConnected, handler);
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

  s.on("user_input_transcribed", (ev: any) => {
    logger.info(
      { transcript: ev.transcript, isFinal: ev.isFinal },
      "[STT] transcript",
    );
    if (ev.isFinal && ev.transcript?.trim()) {
      console.log(`[Transcript] User: ${ev.transcript.trim()}`);
      if (callHistoryId) {
        appendTurn(callHistoryId, {
          speaker: "user",
          text: ev.transcript.trim(),
        });
      }
    }
  });
  s.on("agent_state_changed", (ev: any) => {
    console.log(`[Agent] state: ${ev.oldState} → ${ev.newState}`);
    logger.info(
      { from: ev.oldState, to: ev.newState },
      "[Agent] state changed",
    );
  });
  s.on("speech_created", (ev: any) => {
    const text = ev?.speechHandle?.synthesizedText ?? ev?.text ?? "";
    if (text?.trim()) {
      console.log(`[Transcript] Agent: ${text.trim()}`);
      if (callHistoryId) {
        appendTurn(callHistoryId, { speaker: "agent", text: text.trim() });
      }
    } else {
      console.log(`[Agent] speech_created (native audio — no text capture)`);
    }
    logger.info(
      { textLen: text?.length, hasCallHistoryId: !!callHistoryId },
      "[Agent] speech_created",
    );
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

  // For SIP calls: wait until the phone participant joins the room before
  // starting Gemini. The participant appears as soon as the SIP call is
  // dispatched (often while still ringing), but audio only flows once the
  // callee answers. inputOptions.participantIdentity routes the session to
  // the correct participant and prevents the observer-* bridge participant
  // from hijacking the session.
  if (meta.sipParticipantIdentity) {
    logger.info(
      { participant: meta.sipParticipantIdentity },
      "[Live] waiting for SIP participant",
    );
    await waitForSipParticipant(ctx, meta.sipParticipantIdentity);
    logger.info(
      { participant: meta.sipParticipantIdentity },
      "[Live] SIP participant joined, starting session",
    );
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
  const tools = buildVoiceTools(ctx, roomName, meta.agentKey);
  logger.info(
    { toolCount: Object.keys(tools).length, tools: Object.keys(tools) },
    "[Pipeline] tools built",
  );

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

  // Gemini Live API waits for a user turn before generating output.
  // Use AgentSession.generateReply which routes through the active internal
  // activity — the correct path to the live Gemini session.
  try {
    await (session as any).generateReply({ userMessage: "." });
    logger.info({}, "[Pipeline] greeting trigger injected");
  } catch (err) {
    logger.warn({ err }, "[Pipeline] greeting trigger failed (generateReply)");
  }

  s.once("close", async () => {
    const durationMs = Date.now() - callStartMs;
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
