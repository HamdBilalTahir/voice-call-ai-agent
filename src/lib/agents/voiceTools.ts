/**
 * No in-call tools are registered.
 *
 * Data collection (qualification, tasks, meetings, messages) is handled by a
 * post-call LLM extraction pass on the full transcript.
 *
 * Call termination is handled by farewell detection in the conversation_item_added
 * handler in genericEntry.ts — when the agent speaks a farewell phrase, the room
 * is disconnected after a short delay. This avoids the concurrent speech handle
 * race that occurred when end_call was called alongside a text response.
 */
export function buildVoiceTools() {
  return {};
}

const FAREWELL_PHRASES = [
  "goodbye",
  "good bye",
  "bye bye",
  "take care",
  "talk soon",
  "reach out",
  "best of luck",
  "all the best",
  "have a great",
  "good day",
  "good night",
  "until next time",
  "speak soon",
  "chat soon",
];

// Matches "bye" as a whole word so it catches "Bye!", "bye.", standalone "bye"
// without false-positiving on substrings (none exist in English, but safer).
const FAREWELL_WORD_RE = /\bbye\b/i;

export function isFarewell(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    FAREWELL_PHRASES.some((phrase) => lower.includes(phrase)) ||
    FAREWELL_WORD_RE.test(text)
  );
}
