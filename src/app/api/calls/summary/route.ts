import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const PROMPT = `Analyze this voice call transcript and return a JSON object with exactly these keys:
- "bullets": array of exactly 3 concise bullet points summarizing what happened
- "sentiment": one of "positive", "neutral", or "negative" (overall caller sentiment)
- "sentimentScore": integer 0–100 (0 = very negative, 50 = neutral, 100 = very positive)
- "actionItems": array of up to 5 follow-up actions detected (empty array if none)

Return ONLY valid JSON. No markdown fences, no explanation.

Transcript:
{transcript}`;

export interface CallSummary {
  bullets: string[];
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  actionItems: string[];
}

const FALLBACK: CallSummary = {
  bullets: [
    "Call completed.",
    "No detailed transcript available.",
    "Review recording if needed.",
  ],
  sentiment: "neutral",
  sentimentScore: 50,
  actionItems: [],
};

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript?.trim() || !process.env.GEMINI_API_KEY) {
      return NextResponse.json(FALLBACK);
    }

    const prompt = PROMPT.replace("{transcript}", transcript.slice(0, 8000));
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(cleaned) as CallSummary;

    return NextResponse.json({
      bullets: Array.isArray(data.bullets)
        ? data.bullets.slice(0, 3)
        : FALLBACK.bullets,
      sentiment: ["positive", "neutral", "negative"].includes(data.sentiment)
        ? data.sentiment
        : "neutral",
      sentimentScore:
        typeof data.sentimentScore === "number"
          ? Math.max(0, Math.min(100, data.sentimentScore))
          : 50,
      actionItems: Array.isArray(data.actionItems)
        ? data.actionItems.slice(0, 5)
        : [],
    } satisfies CallSummary);
  } catch (err) {
    console.error("[summary] error:", err);
    return NextResponse.json(FALLBACK);
  }
}
