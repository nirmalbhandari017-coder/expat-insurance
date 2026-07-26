import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client — BYPASSES RLS. Use only in trusted server code for
// operations that legitimately need it (e.g. triggering the notification scan,
// admin maintenance). Never import this into client components.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
