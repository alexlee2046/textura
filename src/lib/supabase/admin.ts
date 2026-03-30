import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;

  adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return adminClient;
}
