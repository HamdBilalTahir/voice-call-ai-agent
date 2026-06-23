/**
 * @jest-environment node
 */
import {
  hashPromptSections,
  compilePromptSections,
  type PromptSections,
} from "@/lib/agents/promptCompiler";

// ─── Mock Gemini ──────────────────────────────────────────────────────────────

const mockGenerateContent = jest.fn();
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

// ─── hashPromptSections ───────────────────────────────────────────────────────

describe("hashPromptSections", () => {
  const base: PromptSections = {
    roleAndResponsibilities: "You are a real estate agent.",
    personaLanguageAndTone: "Warm, professional, concise.",
    mistakesToAvoid: "Never promise specific prices.",
    additionalInstructions: "Be ready with property listings.",
  };

  it("returns a 16-char hex string", () => {
    const hash = hashPromptSections(base);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    expect(hashPromptSections(base)).toBe(hashPromptSections({ ...base }));
  });

  it("changes when any section changes", () => {
    const original = hashPromptSections(base);
    expect(
      hashPromptSections({ ...base, roleAndResponsibilities: "Different" }),
    ).not.toBe(original);
    expect(
      hashPromptSections({ ...base, personaLanguageAndTone: "Different" }),
    ).not.toBe(original);
    expect(
      hashPromptSections({ ...base, mistakesToAvoid: "Different" }),
    ).not.toBe(original);
    expect(
      hashPromptSections({ ...base, additionalInstructions: "Different" }),
    ).not.toBe(original);
  });

  it("treats undefined and empty string the same", () => {
    const withUndefined = hashPromptSections({});
    const withEmpty = hashPromptSections({
      roleAndResponsibilities: "",
      personaLanguageAndTone: "",
      mistakesToAvoid: "",
      additionalInstructions: "",
    });
    expect(withUndefined).toBe(withEmpty);
  });
});

// ─── compilePromptSections ────────────────────────────────────────────────────

describe("compilePromptSections", () => {
  const sections: PromptSections = {
    roleAndResponsibilities: "You are Maria, a real estate agent.",
    personaLanguageAndTone: "Warm and professional.",
    mistakesToAvoid: "Never promise exact prices.",
    additionalInstructions:
      "Be ready with property listings. After call, add interested callers to CRM.",
  };

  const compiledResponse = {
    callAgentPrompt:
      "You are Maria, a warm and professional real estate agent. Never promise exact prices.",
    kbSearchHint: "property listings",
    postCallActions: [
      { trigger: "if caller showed interest", action: "add to CRM" },
    ],
  };

  beforeEach(() => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(compiledResponse) },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it("returns callAgentPrompt, kbSearchHint, postCallActions, sourceHash, compiledAt", async () => {
    const result = await compilePromptSections(sections, "test-api-key");
    expect(result.callAgentPrompt).toBe(compiledResponse.callAgentPrompt);
    expect(result.kbSearchHint).toBe(compiledResponse.kbSearchHint);
    expect(result.postCallActions).toEqual(compiledResponse.postCallActions);
    expect(result.sourceHash).toBe(hashPromptSections(sections));
    expect(typeof result.compiledAt).toBe("number");
  });

  it("sets sourceHash to match hashPromptSections output", async () => {
    const result = await compilePromptSections(sections, "test-api-key");
    expect(result.sourceHash).toBe(hashPromptSections(sections));
  });

  it("returns empty arrays/strings when LLM returns partial response", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ callAgentPrompt: "Hi" }) },
    });
    const result = await compilePromptSections(sections, "test-api-key");
    expect(result.kbSearchHint).toBe("");
    expect(result.postCallActions).toEqual([]);
  });

  it("throws when LLM returns invalid JSON", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "not json" },
    });
    await expect(compilePromptSections(sections, "key")).rejects.toThrow();
  });
});
