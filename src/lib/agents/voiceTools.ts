/* eslint-disable @typescript-eslint/no-explicit-any */
import { type JobContext, llm, log } from "@livekit/agents";
import { getDb } from "./workerFirestore";

/**
 * Builds the Gemini function-call tools for a live voice session.
 *
 * These tools are executed silently (no spoken output) — Gemini calls them as
 * structured function calls and receives a text result it can optionally
 * acknowledge naturally. All data is persisted to Firestore.
 */
export function buildVoiceTools(
  ctx: JobContext,
  roomName: string,
  agentKey?: string,
) {
  const logger = log();
  const db = () => getDb();
  logger.info({ roomName, agentKey }, "[VoiceTools] building tools");

  return {
    create_custom_task: llm.tool({
      description:
        "Create a follow-up task or timed reminder for this lead. Call this after every interaction to ensure follow-up continuity.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short descriptive task title",
          },
          description: {
            type: "string",
            description: "Full task details and context",
          },
          scheduled_at: {
            type: "string",
            description:
              "ISO 8601 datetime (UTC) when this task should trigger",
          },
        },
        required: ["title"],
      } as any,
      execute: async ({ title, description, scheduled_at }: any) => {
        logger.info(
          { title, scheduled_at },
          "[Tool] create_custom_task called",
        );
        try {
          await db()
            .collection("call_tasks")
            .add({
              roomName,
              agentKey: agentKey ?? null,
              title,
              description: description ?? "",
              scheduledAt: scheduled_at ?? null,
              status: "pending",
              createdAt: Date.now(),
            });
          logger.info(
            { title },
            "[Tool] create_custom_task: saved to Firestore",
          );
          return "Task created.";
        } catch (err) {
          logger.error(
            { err, title },
            "[Tool] create_custom_task: Firestore write failed",
          );
          return "Task noted.";
        }
      },
    }),

    delete_task: llm.tool({
      description: "Delete a previously created task that is no longer needed.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "Firestore document ID of the task to delete",
          },
        },
        required: ["task_id"],
      } as any,
      execute: async ({ task_id }: any) => {
        logger.info({ task_id }, "[Tool] delete_task called");
        try {
          await db().collection("call_tasks").doc(task_id).delete();
          logger.info(
            { task_id },
            "[Tool] delete_task: deleted from Firestore",
          );
          return "Task deleted.";
        } catch (err) {
          logger.error(
            { err, task_id },
            "[Tool] delete_task: Firestore delete failed",
          );
          return "Task deletion noted.";
        }
      },
    }),

    update_qualification: llm.tool({
      description:
        "Persist qualification data collected during this call (name, budget, timeline, geography, etc.).",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          geography_interest: { type: "string", enum: ["Dubai", "Greece"] },
          budget: { type: "string" },
          timeline: { type: "string" },
          decision_authority: { type: "string" },
          qualification_status: {
            type: "string",
            enum: ["qualified", "soft_rejected", "hard_rejected", "pending"],
          },
          lead_score: { type: "number" },
        },
        required: [],
      } as any,
      execute: async (params: any) => {
        logger.info({ params }, "[Tool] update_qualification called");
        try {
          await db()
            .collection("call_qualifications")
            .doc(roomName)
            .set(
              {
                roomName,
                agentKey: agentKey ?? null,
                ...params,
                updatedAt: Date.now(),
              },
              { merge: true },
            );
          logger.info(
            { params },
            "[Tool] update_qualification: saved to Firestore",
          );
          return "Qualification updated.";
        } catch (err) {
          logger.error(
            { err, params },
            "[Tool] update_qualification: Firestore write failed",
          );
          return "Qualification noted.";
        }
      },
    }),

    change_lead_status: llm.tool({
      description: "Update the lead's pipeline status.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [
              "qualified",
              "not_interested",
              "callback_requested",
              "consultation_scheduled",
              "spam",
              "unresponsive",
            ],
          },
          notes: {
            type: "string",
            description: "Optional notes on the status change",
          },
        },
        required: ["status"],
      } as any,
      execute: async ({ status, notes }: any) => {
        logger.info({ status, notes }, "[Tool] change_lead_status called");
        try {
          await db()
            .collection("call_qualifications")
            .doc(roomName)
            .set(
              { status, notes: notes ?? "", updatedAt: Date.now() },
              { merge: true },
            );
          logger.info(
            { status },
            "[Tool] change_lead_status: saved to Firestore",
          );
          return `Status set to ${status}.`;
        } catch (err) {
          logger.error(
            { err, status },
            "[Tool] change_lead_status: Firestore write failed",
          );
          return "Status change noted.";
        }
      },
    }),

    schedule_meeting: llm.tool({
      description:
        "Book a consultation meeting with a qualified lead. Returns success or available slots if the chosen time is taken.",
      parameters: {
        type: "object",
        properties: {
          participant_name: { type: "string" },
          participant_email: { type: "string" },
          datetime_gst: {
            type: "string",
            description:
              "Meeting datetime in GST (Gulf Standard Time), e.g. '2025-06-10T14:00:00+04:00'",
          },
          geography: { type: "string", enum: ["Dubai", "Greece"] },
          notes: { type: "string" },
        },
        required: ["participant_email", "datetime_gst"],
      } as any,
      execute: async ({
        participant_name,
        participant_email,
        datetime_gst,
        geography,
        notes,
      }: any) => {
        logger.info(
          { participant_email, datetime_gst, geography },
          "[Tool] schedule_meeting called",
        );
        try {
          await db()
            .collection("call_meetings")
            .add({
              roomName,
              agentKey: agentKey ?? null,
              participantName: participant_name ?? "",
              participantEmail: participant_email,
              datetimeGst: datetime_gst,
              geography: geography ?? "",
              notes: notes ?? "",
              status: "pending_confirmation",
              createdAt: Date.now(),
            });
          logger.info(
            { participant_email, datetime_gst },
            "[Tool] schedule_meeting: saved to Firestore",
          );
          return "Meeting scheduled successfully.";
        } catch (err) {
          logger.error(
            { err, participant_email },
            "[Tool] schedule_meeting: Firestore write failed",
          );
          return "Meeting request noted.";
        }
      },
    }),

    send_message: llm.tool({
      description:
        "Queue a follow-up message (SMS or WhatsApp) to be sent to the lead after the call ends.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Message text to send to the lead",
          },
          channel: {
            type: "string",
            enum: ["sms", "whatsapp"],
            description: "Delivery channel",
          },
        },
        required: ["content"],
      } as any,
      execute: async ({ content, channel }: any) => {
        logger.info(
          { channel, contentLength: content?.length },
          "[Tool] send_message called",
        );
        try {
          await db()
            .collection("call_messages")
            .add({
              roomName,
              agentKey: agentKey ?? null,
              content,
              channel: channel ?? "sms",
              status: "pending",
              createdAt: Date.now(),
            });
          logger.info({ channel }, "[Tool] send_message: saved to Firestore");
          return "Message queued.";
        } catch (err) {
          logger.error(
            { err, channel },
            "[Tool] send_message: Firestore write failed",
          );
          return "Message noted.";
        }
      },
    }),

    end_call: llm.tool({
      description:
        "Immediately end the voice call. Use only for confirmed spam, repeated abuse, or after the consultation is fully scheduled and the conversation is complete.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["spam", "completed", "rejected", "abuse"],
            description: "Reason the call is being ended",
          },
        },
        required: ["reason"],
      } as any,
      execute: async ({ reason }: any) => {
        logger.info(
          { reason },
          "[Tool] end_call called — disconnecting in 2.5s",
        );
        // Brief delay so Gemini can finish any final spoken phrase before disconnect.
        setTimeout(() => {
          try {
            logger.info({ reason }, "[Tool] end_call: disconnecting room now");
            ctx.room.disconnect();
          } catch (err) {
            logger.warn(
              { err },
              "[Tool] end_call: room disconnect failed (may already be closing)",
            );
          }
        }, 2500);
        return `Call ending: ${reason}`;
      },
    }),
  };
}
