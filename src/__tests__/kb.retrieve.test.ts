/**
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEmbedContent = jest.fn();
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      embedContent: mockEmbedContent,
    }),
  })),
}));

const mockSearch = jest.fn();
jest.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    search: mockSearch,
    getCollections: jest.fn().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn().mockResolvedValue({}),
  })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

import { retrieveKBContext } from "@/lib/kb/retrieve";

const FAKE_VECTOR = Array.from({ length: 768 }, () => 0.1);

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.QDRANT_URL = "http://localhost:6333";
  mockEmbedContent.mockResolvedValue({ embedding: { values: FAKE_VECTOR } });
});

afterEach(() => jest.clearAllMocks());

describe("retrieveKBContext", () => {
  it("returns empty string when kbSearchHint is empty", async () => {
    const result = await retrieveKBContext("agent-1", "");
    expect(result).toBe("");
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("returns empty string when kbSearchHint is whitespace only", async () => {
    const result = await retrieveKBContext("agent-1", "   ");
    expect(result).toBe("");
  });

  it("returns empty string when Qdrant returns no results", async () => {
    mockSearch.mockResolvedValue([]);
    const result = await retrieveKBContext("agent-1", "property listings");
    expect(result).toBe("");
  });

  it("returns empty string when all results score below threshold", async () => {
    mockSearch.mockResolvedValue([
      { score: 0.1, payload: { text: "Some property info" } },
      { score: 0.2, payload: { text: "Another property" } },
    ]);
    const result = await retrieveKBContext("agent-1", "property listings");
    expect(result).toBe("");
  });

  it("returns formatted KB context for results above threshold", async () => {
    mockSearch.mockResolvedValue([
      { score: 0.85, payload: { text: "3-bed house on Maple St, $850k" } },
      { score: 0.72, payload: { text: "2-bed apartment on Oak Ave, $450k" } },
    ]);
    const result = await retrieveKBContext("agent-1", "property listings");
    expect(result).toContain("[KNOWLEDGE BASE]");
    expect(result).toContain("Maple St");
    expect(result).toContain("Oak Ave");
  });

  it("filters by agentKey in the Qdrant query", async () => {
    mockSearch.mockResolvedValue([]);
    await retrieveKBContext("my-agent-key", "menu items");
    expect(mockSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        filter: {
          must: [{ key: "agentKey", match: { value: "my-agent-key" } }],
        },
      }),
    );
  });

  it("returns empty string and does not throw when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await retrieveKBContext("agent-1", "property listings");
    expect(result).toBe("");
  });

  it("returns empty string and does not throw when Qdrant search fails", async () => {
    mockSearch.mockRejectedValue(new Error("Qdrant connection refused"));
    const result = await retrieveKBContext("agent-1", "property listings");
    expect(result).toBe("");
  });
});
