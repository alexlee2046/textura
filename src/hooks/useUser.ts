"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type User = { id: string; email?: string };

/**
 * Client-side hook to get the current Supabase user.
 * Returns { user, loading }. In /my/ routes, user is guaranteed non-null
 * because middleware redirects unauthenticated users to /login.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
