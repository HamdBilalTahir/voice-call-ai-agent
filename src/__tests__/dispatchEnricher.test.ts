/**
 * @jest-environment node
 */

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn() },
}));
jest.mock("../lib/firebase/admin", () => ({ getDb: jest.fn() }));
jest.mock("../lib/firebase/agentCompiled", () => ({
  getCompiledPrompt: jest.fn(),
}));
jest.mock("../lib/kb/retrieve", () => ({ retrieveKBContext: jest.fn() }));

import { enrichSystemPrompt } from "@/lib/agents/dispatchEnricher";
import { PLATFORM_VOICE_RULES } from "@/lib/agents/promptBuilder";
import type { AgentFullData } from "@/lib/firebase/agents";
import { getCompiledPrompt } from "../lib/firebase/agentCompiled";
import { retrieveKBContext } from "../lib/kb/retrieve";

const mockGetCompiledPrompt = jest.mocked(getCompiledPrompt);
const mockRetrieveKBContext = jest.mocked(retrieveKBContext);

const baseAgent: AgentFullData = {
  key: "test-agent",
  direction: "outbound",
  name: "Test Agent",
  language: "en",
  dispatchRuleName: "test-dispatch",
  phoneNumber: "",
  description: "",
  voiceEnabled: true,
  roleAndResponsibilities: "You are a helpful real estate agent.",
  personaLanguageAndTone: "Warm and professional.",
  mistakesToAvoid: "Never promise prices.",
  additionalInstructions: "Be ready with listings.",
  voiceGreeting: "Hi, how can I help?",
  voiceInstructions: "",
  voiceSettings: {
    callType: "outbound",
    language: "en-US",
    sttLanguage: "en-US",
    sttModel: "nova-3",
    ttsModel: "sonic-3",
    ttsVoiceId: "",
    voiceType: "female-1",
    llmModel: "gemini-2.0-flash",
  },
  tools: [],
};

afterEach(() => jest.clearAllMocks());

describe("enrichSystemPrompt", () => {
  describe("when compiled config is available", () => {
    beforeEach(() => {
      mockGetCompiledPrompt.mockResolvedValue({
        callAgentPrompt: "You are Maria, a real estate agent.",
        kbSearchHint: "property listings",
        postCallActions: [],
        sourceHash: "abc123",
        compiledAt: Date.now(),
      });
      mockRetrieveKBContext.mockResolvedValue("");
    });

    it("includes PLATFORM_VOICE_RULES", async () => {
      const prompt = await enrichSystemPrompt("test-agent", baseAgent);
      expect(prompt).toContain(PLATFORM_VOICE_RULES);
    });

    it("uses callAgentPrompt instead of raw sections", async () => {
      const prompt = await enrichSystemPrompt("test-agent", baseAgent);
      expect(prompt).toContain("You are Maria, a real estate agent.");
      expect(prompt).not.toContain("You are a helpful real estate agent.");
    });

    it("appends KB context when retrieveKBContext returns content", async () => {
      mockRetrieveKBContext.mockResolvedValue(
        "[KNOWLEDGE BASE]\n3-bed house on Maple St, $850k",
      );
      const prompt = await enrichSystemPrompt("test-agent", baseAgent);
      expect(prompt).toContain("[KNOWLEDGE BASE]");
      expect(prompt).toContain("Maple St");
    });

    it("does not append KB section when no KB context returned", async () => {
      const prompt = await enrichSystemPrompt("test-agent", baseAgent);
      expect(prompt).not.toContain("[KNOWLEDGE BASE]");
    });

    it("calls retrieveKBContext with correct agentKey and kbSearchHint", async () => {
      await enrichSystemPrompt("test-agent", baseAgent);
      expect(mockRetrieveKBContext).toHaveBeenCalledWith(
        "test-agent",
        "property listings",
      );
    });

    it("skips KB retrieval when kbSearchHint is empty", async () => {
      mockGetCompiledPrompt.mockResolvedValue({
        callAgentPrompt: "You are Maria.",
        kbSearchHint: "",
        postCallActions: [],
        sourceHash: "abc",
        compiledAt: Date.now(),
      });
      await enrichSystemPrompt("test-agent", baseAgent);
      expect(mockRetrieveKBContext).not.toHaveBeenCalled();
    });

    it("prepends locale instruction for non-English locales", async () => {
      const spanishAgent = {
        ...baseAgent,
        voiceSettings: { ...baseAgent.voiceSettings, liveApiLanguage: "es-ES" },
      };
      const prompt = await enrichSystemPrompt("test-agent", spanishAgent);
      expect(prompt).toContain("[LANGUAGE]");
      expect(prompt).toContain("Spanish");
    });
  });

  describe("when compiled config is not available", () => {
    beforeEach(() => {
      mockGetCompiledPrompt.mockResolvedValue(null);
      mockRetrieveKBContext.mockResolvedValue("");
    });

    it("falls back to buildSystemPrompt from raw sections", async () => {
      const prompt = await enrichSystemPrompt("test-agent", baseAgent);
      expect(prompt).toContain(PLATFORM_VOICE_RULES);
      expect(prompt).toContain("You are a helpful real estate agent.");
    });

    it("does not call retrieveKBContext", async () => {
      await enrichSystemPrompt("test-agent", baseAgent);
      expect(mockRetrieveKBContext).not.toHaveBeenCalled();
    });
  });

  describe("resilience", () => {
    it("falls back gracefully when getCompiledPrompt throws", async () => {
      mockGetCompiledPrompt.mockRejectedValue(new Error("Firestore error"));
      mockRetrieveKBContext.mockResolvedValue("");
      const prompt = await enrichSystemPrompt("test-agent", baseAgent);
      expect(prompt).toContain(PLATFORM_VOICE_RULES);
    });
  });
});
