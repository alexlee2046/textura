// NOTE: Local file storage is MVP-only. Migrate to Tencent COS for production
// (see CLAUDE.md "Storage" section for the target architecture).
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";

const GENERATED_DIR = join(process.cwd(), "public", "generated");

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
  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${nanoid(12)}.${ext}`;
  await writeFile(join(GENERATED_DIR, filename), buffer);
  return `/generated/${filename}`;
}
