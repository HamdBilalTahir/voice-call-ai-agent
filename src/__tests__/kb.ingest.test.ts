/**
 * @jest-environment node
 */
import { chunkText } from "@/lib/kb/ingest";

// chunkText constants (must match ingest.ts)
const MAX = 500;
const MIN = 50;

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
}

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n   ")).toEqual([]);
  });

  it("drops paragraphs shorter than MIN_WORDS", () => {
    const short = words(MIN - 1); // 49 words — below threshold
    const chunks = chunkText(short);
    expect(chunks).toHaveLength(0);
  });

  it("keeps a single paragraph at exactly MIN_WORDS", () => {
    const para = words(MIN);
    const chunks = chunkText(para);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(para);
  });

  it("produces a single chunk for text under MAX_WORDS", () => {
    const para = words(MAX - 10);
    const chunks = chunkText(para);
    expect(chunks).toHaveLength(1);
  });

  it("splits paragraphs longer than MAX_WORDS into multiple chunks", () => {
    const longPara = words(MAX * 2 + 50); // ~1050 words
    const chunks = chunkText(longPara);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => {
      expect(c.split(/\s+/).length).toBeLessThanOrEqual(MAX);
    });
  });

  it("merges small paragraphs until they reach MAX_WORDS", () => {
    // Two 300-word paragraphs separated by double newline → should be two chunks
    const para = words(300);
    const text = `${para}\n\n${para}`;
    const chunks = chunkText(text);
    // Each 300-word para fits under MAX; they don't merge since combined = 600 > MAX
    expect(chunks).toHaveLength(2);
  });

  it("preserves all words — no content dropped", () => {
    const para1 = words(200);
    const para2 = words(200);
    const para3 = words(200);
    const text = `${para1}\n\n${para2}\n\n${para3}`;
    const chunks = chunkText(text);
    const allChunkWords = chunks.join(" ").split(/\s+/);
    // 600 total words across chunks
    expect(allChunkWords.length).toBe(600);
  });

  it("normalises internal newlines within a paragraph to spaces", () => {
    const para = `${words(60)}\nsome\nnewlines\nhere`;
    const chunks = chunkText(para);
    expect(chunks[0]).not.toContain("\n");
  });

  it("handles multiple blank lines between paragraphs", () => {
    // Two 100-word paragraphs: 100+100=200 < MAX, so they merge into one chunk
    const para = words(100);
    const text = `${para}\n\n\n\n${para}`;
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    // All words are still present
    expect(chunks[0].split(/\s+/).length).toBe(200);
  });
});
