import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const serverClientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
} as const;

/** Public reads (RLS policies). Avoids sending service_role in headers for simple SELECTs. */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createSupabaseClient(url, anonKey, serverClientOptions);
}

/** Service role — bypasses RLS; use for writes that need it. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, serviceRoleKey, serverClientOptions);
}

