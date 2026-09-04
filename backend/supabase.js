// Compatibility shim for Node.js < 22 environments where native WebSocket is not present globally
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class WebSocket {};
}

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
export const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
  if (process.env.NODE_ENV !== "test") {
    console.warn("Warning: Supabase URL or keys are not set in backend environment variables.");
  }
}

// Base admin/auth client (used strictly for server-side auth operations such as token verification)
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

/**
 * Returns a Supabase client configured with the authenticated user's access token.
 * This ensures PostgREST forwards auth.uid() to PostgreSQL, strictly enforcing Row Level Security (RLS).
 */
export function getSupabaseForUser(token) {
  // Use anon key for user-scoped PostgREST requests so Postgres RLS policies (auth.uid() = user_id) are enforced
  const apiKey = supabaseAnonKey || supabaseServiceKey || "placeholder-key";

  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    apiKey,
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
