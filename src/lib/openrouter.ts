export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_IMAGES_URL =
  "https://openrouter.ai/api/v1/images/generations";

function openRouterHeaders(): HeadersInit {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
  };
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Call OpenRouter chat completions endpoint.
 * Returns the raw Response on success; throws on HTTP error or timeout.
 */
export async function callOpenRouter(
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("OpenRouter API Error:", resp.status, errText);
    throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
  }

  return resp;
}

/**
 * Call OpenRouter image generations endpoint (e.g. FLUX models).
 * Returns the raw Response on success; throws on HTTP error or timeout.
 */
export async function callOpenRouterImageGen(
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(OPENROUTER_IMAGES_URL, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("OpenRouter Image API Error:", resp.status, errText);
    throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
  }

  return resp;
}

export type OpenRouterImageResult = { image_url: { url: string } };

/** Extract image results from an OpenRouter chat response. */
export function extractImages(
  data: unknown,
): OpenRouterImageResult[] | undefined {
  return (
    data as {
      choices?: {
        message?: { images?: OpenRouterImageResult[] };
      }[];
    }
  )?.choices?.[0]?.message?.images;
}
