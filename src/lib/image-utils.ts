import sharp from "sharp";

const ALLOWED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "gif",
  "tiff",
  "avif",
  "heif",
]);

/**
 * Validate that a buffer contains an actual image via sharp metadata.
 * Throws if the buffer is not a recognized image format.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<void> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error(`Invalid image format: ${metadata.format ?? "unknown"}`);
  }
}

/**
 * Resize and compress an image for OpenRouter API payloads.
 * Max 2048x2048, JPEG quality 85. Prevents ECONNRESET on large base64 inputs.
 */
export async function optimizeForOpenRouter(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
