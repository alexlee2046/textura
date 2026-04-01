import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import sharp from "sharp";
import {
  isSupabaseStorageConfigured,
  uploadToSupabase,
} from "./supabase-storage";
import { isCosConfigured, uploadToCos } from "./cos-storage";

const GENERATED_DIR = join(process.cwd(), "public", "generated");

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
]);
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

/**
 * Save a base64 data URL image. Converts to WebP, quality 85.
 * Storage priority: Supabase -> COS -> Local filesystem.
 */
export async function saveBase64Image(base64Url: string): Promise<string> {
  const commaIdx = base64Url.indexOf(",");
  const rawBuffer = Buffer.from(
    commaIdx === -1 ? base64Url : base64Url.slice(commaIdx + 1),
    "base64",
  );
  const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer();
  const filename = `${nanoid(12)}.webp`;

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(`results/${filename}`, webpBuffer, "image/webp");
  }
  if (isCosConfigured) {
    return uploadToCos(`results/${filename}`, webpBuffer, "image/webp");
  }

  const dir = join(GENERATED_DIR, "results");
  await ensureDir(dir);
  await writeFile(join(dir, filename), webpBuffer);
  return `/generated/results/${filename}`;
}

/**
 * Save an uploaded File preserving original format.
 * Validates extension and file size. Used for logos, QR codes, material swatches.
 * Storage priority: Supabase -> COS -> Local filesystem.
 */
export async function saveUploadedFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("File too large (max 10 MB)");
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type .${ext} not allowed`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${nanoid(12)}.${ext}`;
  const contentType = file.type || "application/octet-stream";

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(`uploads/${filename}`, buffer, contentType);
  }
  if (isCosConfigured) {
    return uploadToCos(`uploads/${filename}`, buffer, contentType);
  }

  const dir = join(GENERATED_DIR, "uploads");
  await ensureDir(dir);
  await writeFile(join(dir, filename), buffer);
  return `/generated/uploads/${filename}`;
}

/**
 * Save an image buffer as WebP (quality 85). Used for AI generation inputs/outputs.
 * Storage priority: Supabase -> COS -> Local filesystem.
 */
export async function saveImageAsWebp(
  buffer: Buffer,
  subdir = "uploads",
): Promise<string> {
  const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  const filename = `${nanoid(12)}.webp`;

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(`${subdir}/${filename}`, webpBuffer, "image/webp");
  }
  if (isCosConfigured) {
    return uploadToCos(`${subdir}/${filename}`, webpBuffer, "image/webp");
  }

  const dir = join(GENERATED_DIR, subdir);
  await ensureDir(dir);
  await writeFile(join(dir, filename), webpBuffer);
  return `/generated/${subdir}/${filename}`;
}
