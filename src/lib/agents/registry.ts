export type AgentDirection = "inbound" | "outbound";

export interface AgentConfig {
  key: string;
  direction: AgentDirection;
  name: string;
  language: string;
  dispatchRuleName: string;
  phoneNumber: string;
  description: string;
  /** Overlaid from Firestore by the data layer — not stored in this registry */
  voiceEnabled?: boolean;
  /** Overlaid from Firestore voiceSettings.useLiveApi */
  useLiveApi?: boolean;
}

// Static agents removed — all agents are managed via Firestore.
// This object is kept for backwards-compatible imports only.
export const agents: Record<string, AgentConfig> = {};
