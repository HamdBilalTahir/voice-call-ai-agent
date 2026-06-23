/**
 * @jest-environment node
 */

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn() },
}));
jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn().mockReturnValue([]),
}));

// Firestore mock — set up before admin mock so getDb returns our fake db
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockOrderBy = jest.fn().mockReturnValue({ get: mockGet });

jest.mock("../lib/firebase/admin", () => ({
  getDb: jest.fn().mockReturnValue({
    batch: () => ({ set: mockBatchSet, commit: mockBatchCommit }),
    collection: () => ({
      doc: () => ({
        collection: () => ({
          orderBy: mockOrderBy,
          doc: () => ({}),
        }),
      }),
    }),
  }),
}));

jest.mock("../lib/firebase/agentCompiled", () => ({
  getCompiledPrompt: jest.fn(),
}));
jest.mock("../lib/firebase/agents", () => ({ getAgent: jest.fn() }));
jest.mock("../lib/firebase/resolveProviderKeys", () => ({
  resolveProviderKeys: jest.fn(),
}));
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest
      .fn()
      .mockReturnValue({ generateContent: jest.fn() }),
  })),
}));

import { executePostCallActions } from "@/lib/agents/actionExecutor";
import { getCompiledPrompt } from "../lib/firebase/agentCompiled";
import { getAgent } from "../lib/firebase/agents";
import { resolveProviderKeys } from "../lib/firebase/resolveProviderKeys";
import { GoogleGenerativeAI } from "@google/generative-ai";

const mockGetCompiledPrompt = jest.mocked(getCompiledPrompt);
const mockGetAgent = jest.mocked(getAgent);
const mockResolveProviderKeys = jest.mocked(resolveProviderKeys);

const mockGenerateContent = jest.fn();

const transcriptDocs = [
  { data: () => ({ speaker: "agent", text: "Hello, how can I help?" }) },
  {
    data: () => ({
      speaker: "caller",
      text: "I'm interested in buying a property.",
    }),
  },
  {
    data: () => ({
      speaker: "agent",
      text: "Great! Let me share some listings.",
    }),
  },
];

const evaluatedActions = [
  {
    trigger: "if caller showed interest",
    action: "add to CRM",
    triggered: true,
    reason: "Caller stated interest.",
  },
  {
    trigger: "if appointment requested",
    action: "create calendar event",
    triggered: false,
    reason: "Not requested.",
  },
];

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";

  // Wire up the Gemini mock through the class constructor
  (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
    getGenerativeModel: jest
      .fn()
      .mockReturnValue({ generateContent: mockGenerateContent }),
  }));

  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify(evaluatedActions) },
  });

  mockGetCompiledPrompt.mockResolvedValue({
    callAgentPrompt: "You are Maria.",
    kbSearchHint: "property listings",
    postCallActions: [
      { trigger: "if caller showed interest", action: "add to CRM" },
      { trigger: "if appointment requested", action: "create calendar event" },
    ],
    sourceHash: "abc123",
    compiledAt: Date.now(),
  });

  mockGetAgent.mockResolvedValue({ key: "test-agent" });
  mockResolveProviderKeys.mockResolvedValue({ liveApiKey: "test-key" });
  mockGet.mockResolvedValue({ empty: false, docs: transcriptDocs });
  mockBatchSet.mockReset();
  mockBatchCommit.mockResolvedValue(undefined);
});

afterEach(() => jest.clearAllMocks());

describe("executePostCallActions", () => {
  it("skips when postCallActions is empty", async () => {
    mockGetCompiledPrompt.mockResolvedValue({
      callAgentPrompt: "You are Maria.",
      kbSearchHint: "",
      postCallActions: [],
      sourceHash: "abc",
      compiledAt: Date.now(),
    });
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("skips when compiled config is null", async () => {
    mockGetCompiledPrompt.mockResolvedValue(null);
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("skips when transcript is empty", async () => {
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("sends transcript and postCallActions to Gemini", async () => {
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const userText =
      mockGenerateContent.mock.calls[0][0].contents[0].parts[0].text;
    expect(userText).toContain("if caller showed interest");
    expect(userText).toContain("I'm interested in buying");
  });

  it("writes all evaluated actions to Firestore", async () => {
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockBatchSet).toHaveBeenCalledTimes(evaluatedActions.length);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("includes callHistoryId, agentKey, roomName on each written action", async () => {
    await executePostCallActions("call-1", "agent-1", "room-1");
    const written = mockBatchSet.mock.calls[0][1];
    expect(written).toMatchObject({
      callHistoryId: "call-1",
      agentKey: "agent-1",
      roomName: "room-1",
      triggered: true,
      action: "add to CRM",
    });
  });

  it("falls back to GEMINI_API_KEY env var when no per-agent key", async () => {
    mockResolveProviderKeys.mockResolvedValue({});
    process.env.GEMINI_API_KEY = "env-fallback-key";
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it("skips execution when no API key is available", async () => {
    mockResolveProviderKeys.mockResolvedValue({});
    delete process.env.GEMINI_API_KEY;
    await executePostCallActions("call-1", "agent-1", "room-1");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
