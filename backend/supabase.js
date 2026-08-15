import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
export const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
  console.warn("Warning: Supabase URL or keys are not set in backend environment variables.");
}

// Base admin/auth client
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Returns a client configured with user's access token so PostgREST passes auth.uid() to Postgres RLS
export function getSupabaseForUser(token) {
  if (supabaseServiceKey) {
    // If Service Role Key is configured, use admin client
    return supabase;
  }
  // If only Anon Key is available, pass user JWT so RLS policy auth.uid() = user_id matches
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}
