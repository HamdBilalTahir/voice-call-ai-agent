export type AgentDirection = "inbound" | "outbound";

export interface AgentConfig {
  key: string;
  direction: AgentDirection;
  dispatchRuleName: string;
  phoneNumber: string;
  description: string;
}

export const agents: Record<string, AgentConfig> = {
  "sales-en": {
    key: "sales-en",
    direction: "outbound",
    dispatchRuleName:
      process.env.AGENT_DISPATCH_RULE_SALES_EN || "outbound-dispatch",
    phoneNumber: process.env.AGENT_NUMBER_SALES_EN || "",
    description: "English Outbound Sales Agent",
  },
  "restaurant-es": {
    key: "restaurant-es",
    direction: "inbound",
    dispatchRuleName:
      process.env.AGENT_DISPATCH_RULE_RESTAURANT_ES || "inbound-dispatch",
    phoneNumber: process.env.AGENT_NUMBER_RESTAURANT_ES || "",
    description: "Spanish Inbound Restaurant Agent",
  },
};
