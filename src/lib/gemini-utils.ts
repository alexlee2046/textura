import { z } from "zod";

/**
 * Parse Gemini's variable JSON response format.
 * Tries: raw JSON -> markdown fence -> array regex.
 */
export function parseGeminiJSON<T>(raw: string, schema: z.ZodType<T>): T {
  try {
    return schema.parse(JSON.parse(raw));
  } catch { /* continue */ }

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return schema.parse(JSON.parse(fenceMatch[1]));
    } catch { /* continue */ }
  }

  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return schema.parse(JSON.parse(arrMatch[0]));
    } catch { /* fall through */ }
  }

  throw new Error("Failed to parse Gemini response as valid JSON");
}

/** Structured JSON logger with timestamp. */
export function structuredLog(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }));
}

/** Retry an async function with fixed delay between attempts. */
export async function retryWithDelay<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number;
    delayMs?: number;
    onError?: (err: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  const { maxAttempts = 2, delayMs = 2000, onError } = opts;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      onError?.(lastError, attempt);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError!;
}
