import fs from "fs";
import path from "path";

const HISTORY_FILE = path.join(process.cwd(), "call-history.json");

export interface CallRecord {
  id: string;
  agentKey: string;
  phoneNumber: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "completed" | "missed" | "in-progress";
  direction?: "inbound" | "outbound";
  outcome?: "completed" | "dropped" | "transferred" | "failed";
  sentiment?: "positive" | "neutral" | "negative";
  sentimentScore?: number;
  transcript?: string;
  tags?: string[];
  archived?: boolean;
}

export function getCallHistory(): CallRecord[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }
    const data = fs.readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading call history:", error);
    return [];
  }
}

export function getAgentCallHistory(agentKey: string): CallRecord[] {
  const history = getCallHistory();
  return history
    .filter((record) => record.agentKey === agentKey)
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 50);
}

export function addCallRecord(record: CallRecord) {
  const history = getCallHistory();
  history.push(record);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export function updateCallRecord(id: string, updates: Partial<CallRecord>) {
  const history = getCallHistory();
  const index = history.findIndex((r) => r.id === id);
  if (index !== -1) {
    history[index] = { ...history[index], ...updates };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }
}
