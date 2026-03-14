import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim() || !process.env.GEMINI_API_KEY) {
    return new Response("", { status: 200 });
  }
  const prompt = `Translate the following text to English. If it is already in English, return it unchanged. Return ONLY the translation, no quotes, no explanation:\n\n${text}`;

  console.log("[translate] streaming for:", text.substring(0, 60));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
          // Filter out thinking/reasoning parts — only stream actual output text
          const parts: Array<{ text?: string; thought?: boolean }> =
            (chunk.candidates?.[0]?.content?.parts as never) ?? [];
          const piece = parts
            .filter((p) => !p.thought && p.text)
            .map((p) => p.text)
            .join("");
          if (piece) {
            controller.enqueue(new TextEncoder().encode(piece));
          }
        }
      } catch (error) {
        console.error("[translate] error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
