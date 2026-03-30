import fs from "fs/promises";
import path from "path";

/**
 * Download an image from a local path or remote URL and return as Buffer.
 * Local paths (starting with "/") are resolved relative to `public/`.
 */
export async function getImageBuffer(
  imageUrl: string,
  timeoutMs = 5000,
): Promise<Buffer> {
  if (imageUrl.startsWith("/")) {
    const localPath = path.join(process.cwd(), "public", imageUrl);
    return fs.readFile(localPath);
  }
  const res = await fetch(imageUrl, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
