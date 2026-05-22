export const PLATFORM_VOICE_RULES =
  'You are speaking to the user over a voice call. Keep your responses short and conversational. DO NOT use markdown, bullet points, or special characters. Use natural filler phrases like "umm" or "let me think" sparingly. If the user interrupts you, stop talking and listen gracefully.';

export interface PromptFields {
  roleAndResponsibilities?: string;
  personaLanguageAndTone?: string;
  mistakesToAvoid?: string;
  additionalInstructions?: string;
}

/**
 * Assembles the final LLM system prompt from the platform voice rules (constant)
 * and the four user-editable instruction sections. Sections are prepended with
 * bracketed headers and omitted entirely when empty.
 */
export function buildSystemPrompt(fields: PromptFields): string {
  const parts: string[] = [PLATFORM_VOICE_RULES];

  if (fields.roleAndResponsibilities?.trim()) {
    parts.push(
      `[ROLE AND RESPONSIBILITIES]\n${fields.roleAndResponsibilities.trim()}`,
    );
  }
  if (fields.personaLanguageAndTone?.trim()) {
    parts.push(
      `[PERSONA LANGUAGE AND TONE]\n${fields.personaLanguageAndTone.trim()}`,
    );
  }
  if (fields.mistakesToAvoid?.trim()) {
    parts.push(`[MISTAKES TO AVOID]\n${fields.mistakesToAvoid.trim()}`);
  }
  if (fields.additionalInstructions?.trim()) {
    parts.push(
      `[ADDITIONAL INSTRUCTIONS]\n${fields.additionalInstructions.trim()}`,
    );
  }

  return parts.join("\n\n");
}
