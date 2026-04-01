import { createAdminClient } from "@/lib/supabase/admin";

export const isSupabaseStorageConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "textura";

export async function uploadToSupabase(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
