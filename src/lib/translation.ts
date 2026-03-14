/**
 * Streams a translation of `original` to English from the /api/translate endpoint.
 * Calls `onChunk` with each partial accumulated result as chunks arrive.
 * Returns the final translation, or "" if the text is already English or on error.
 */
export const translateToEnglish = async (
  original: string,
  onChunk: (partial: string) => void,
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: original }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return "";

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      onChunk(accumulated);
    }

    // If identical to original, it was already English — hide translation row
    if (accumulated.trim().toLowerCase() === original.trim().toLowerCase()) {
      return "";
    }
    return accumulated;
  } catch (error) {
    console.error("Translation failed:", error);
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
};
