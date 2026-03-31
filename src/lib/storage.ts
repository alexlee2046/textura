// NOTE: Local file storage is MVP-only. Migrate to Tencent COS for production
// (see CLAUDE.md "Storage" section for the target architecture).
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";

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

async function ensureDir() {
  await mkdir(GENERATED_DIR, { recursive: true });
}

export async function saveBase64Image(base64Url: string): Promise<string> {
  await ensureDir();
  const base64Data = base64Url.includes(",")
    ? base64Url.split(",")[1]
    : base64Url;
  const buffer = Buffer.from(base64Data, "base64");
  const filename = `${nanoid(12)}.png`;
  await writeFile(join(GENERATED_DIR, filename), buffer);
  return `/generated/${filename}`;
}

export async function saveUploadedFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("File too large (max 10 MB)");
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type .${ext} not allowed`);
  }

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${nanoid(12)}.${ext}`;
  await writeFile(join(GENERATED_DIR, filename), buffer);
  return `/generated/${filename}`;
}
