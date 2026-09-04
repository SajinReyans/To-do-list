import { supabase, getSupabaseForUser } from "../supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired access token" });
    }

    req.userId = user.id;
    req.user = user;
    // Attach scoped Supabase client with user credentials for PostgREST RLS compliance
    req.supabase = getSupabaseForUser(token);
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Auth verification error:`, err.message);
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
}
