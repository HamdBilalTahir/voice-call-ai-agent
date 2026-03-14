export type AgentDirection = "inbound" | "outbound";

export interface AgentConfig {
  key: string;
  direction: AgentDirection;
  name: string;
  language: string;
  dispatchRuleName: string;
  phoneNumber: string;
  description: string;
}

export const agents: Record<string, AgentConfig> = {
  "sales-en": {
    key: "sales-en",
    direction: "outbound",
    name: "Sales Agent (English)",
    language: "en",
    dispatchRuleName:
      process.env.AGENT_DISPATCH_RULE_SALES_EN || "outbound-dispatch",
    phoneNumber: process.env.AGENT_NUMBER_SALES_EN || "",
    description: "Outbound sales agent for English-speaking prospects.",
  },
  "restaurant-es": {
    key: "restaurant-es",
    direction: "inbound",
    name: "Restaurant Receptionist (Spanish)",
    language: "es",
    dispatchRuleName:
      process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES || "inbound-dispatch",
    phoneNumber: process.env.AGENT_NUMBER_RESTAURANT_ES || "",
    description:
      "Answers all inbound restaurant calls in Spanish. Takes orders and handles enquiries.",
  },
};
