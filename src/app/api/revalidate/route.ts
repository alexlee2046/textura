import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PATH_PREFIXES = ["/v/", "/s/"];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { path, secret } = body;

  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  if (!ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 400 });
  }

  revalidatePath(path);

  return NextResponse.json({ revalidated: true, path });
}
