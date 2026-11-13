import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * SERVICE ROLE client. Bypasses RLS. Server-only (the `server-only` import fails the build if a client
 * component ever pulls this in, and ESLint forbids importing it from src/components).
 * Use ONLY after validating input with Zod and, for admin work, after requireRole().
 */
export function adminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
