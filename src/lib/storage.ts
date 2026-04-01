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

/** Upload buffer to the first available backend: Supabase → COS → Local. */
async function uploadBuffer(
  subdir: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const key = `${subdir}/${filename}`;

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(key, buffer, contentType);
  }
  if (isCosConfigured) {
    return uploadToCos(key, buffer, contentType);
  }

  const dir = join(GENERATED_DIR, subdir);
  await ensureDir(dir);
  await writeFile(join(dir, filename), buffer);
  return `/generated/${key}`;
}

/** Save a base64 data URL image as WebP. */
export async function saveBase64Image(base64Url: string): Promise<string> {
  const commaIdx = base64Url.indexOf(",");
  const rawBuffer = Buffer.from(
    commaIdx === -1 ? base64Url : base64Url.slice(commaIdx + 1),
    "base64",
  );
  const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer();
  return uploadBuffer("results", `${nanoid(12)}.webp`, webpBuffer, "image/webp");
}

/** Save an uploaded File preserving original format. Used for logos, QR codes, material swatches. */
export async function saveUploadedFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("File too large (max 10 MB)");
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type .${ext} not allowed`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBuffer("uploads", `${nanoid(12)}.${ext}`, buffer, file.type || "application/octet-stream");
}

/** Save an image buffer as WebP (quality 85). Used for AI generation inputs/outputs. */
export async function saveImageAsWebp(
  buffer: Buffer,
  subdir = "uploads",
): Promise<string> {
  const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  return uploadBuffer(subdir, `${nanoid(12)}.webp`, webpBuffer, "image/webp");
}
